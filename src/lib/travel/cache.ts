import "server-only";

import { createHash } from "node:crypto";

import { and, asc, count, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { after } from "next/server";

import { db } from "@/db";
import { searchCaches, searchResults } from "@/db/schema";

import { offerStatus, searchFlights, type FlightSearch } from "./duffel";
import { searchHotels, type HotelSearch } from "./liteapi";
import { SEARCH_PAGE_SIZE, type FlightOption, type HotelOption } from "./types";

// Search results live in the database so loading the trip page reads them from
// there instead of calling Duffel or LiteAPI each time. Results older than
// STALE_AFTER_MS are still shown, and the next read checks the API again in the
// background: new results are added, prices updated, and results the API no
// longer has are removed.

export const STALE_AFTER_MS = 5 * 60_000;
// A background check that hasn't finished by now is assumed to have died.
const REFRESH_TIMEOUT_MS = 2 * 60_000;
// Searches nobody has looked at for this long are deleted.
const KEEP_FOR_MS = 24 * 60 * 60_000;

export type SearchQuery =
  | { kind: "flight"; params: FlightSearch }
  | { kind: "hotel"; params: HotelSearch };

type OptionOf<Q extends SearchQuery> = Q extends { kind: "flight" }
  ? FlightOption
  : HotelOption;

export type SearchPage<T> = {
  results: T[];
  page: number;
  pageCount: number;
  total: number;
  fetchedAt: Date;
  /** The results are older than STALE_AFTER_MS and a background check is running. */
  refreshing: boolean;
};

function cacheKey(query: SearchQuery) {
  return createHash("sha256")
    .update(JSON.stringify(query.params))
    .digest("hex");
}

/** Identifies a result across searches; Duffel issues new offer ids every time. */
function resultKey(query: SearchQuery, option: FlightOption | HotelOption) {
  if (query.kind === "hotel") return (option as HotelOption).resultId;
  const flight = option as FlightOption;
  return [
    flight.cabinClass,
    ...flight.slices.map(
      (s) => `${s.flightNumbers.join("+")}@${s.departingAt}`,
    ),
  ].join("|");
}

async function fetchFromApi(query: SearchQuery) {
  return query.kind === "flight"
    ? searchFlights(query.params)
    : searchHotels(query.params);
}

/**
 * Of the cached results this fetch didn't return, the ones the API confirms are
 * gone. The API can leave out results that still exist (it caps how many it
 * returns), so each is checked directly; anything it can't confirm is kept.
 */
async function findRemoved(
  query: SearchQuery,
  missing: { resultKey: string; option: unknown }[],
): Promise<{ removed: string[]; updated: (FlightOption | HotelOption)[] }> {
  if (missing.length === 0) return { removed: [], updated: [] };

  if (query.kind === "hotel") {
    const ids = missing.map((m) => m.resultKey);
    try {
      const available = await searchHotels(query.params, ids);
      const stillThere = new Set(available.map((h) => h.resultId));
      return {
        removed: ids.filter((id) => !stillThere.has(id)),
        updated: available,
      };
    } catch (error) {
      console.error("Couldn't check cached hotels", error);
      return { removed: [], updated: [] };
    }
  }

  const removed: string[] = [];
  // A few at a time, to stay under Duffel's rate limit.
  for (let i = 0; i < missing.length; i += 5) {
    const batch = missing.slice(i, i + 5);
    const statuses = await Promise.all(
      batch.map((m) => offerStatus((m.option as FlightOption).offerId)),
    );
    batch.forEach((m, j) => {
      if (statuses[j] === "gone") removed.push(m.resultKey);
    });
  }
  return { removed, updated: [] };
}

/** Fetches the search from the API and brings the cached results in line with it. */
async function refresh(query: SearchQuery) {
  const options = await fetchFromApi(query);
  const now = new Date();

  // Several offers can share an itinerary (different fares); keep the cheapest.
  const fetched = new Map<string, FlightOption | HotelOption>();
  for (const option of options) {
    const key = resultKey(query, option);
    const seen = fetched.get(key);
    if (!seen || Number(option.totalAmount) < Number(seen.totalAmount))
      fetched.set(key, option);
  }

  const [cache] = await db
    .insert(searchCaches)
    .values({
      kind: query.kind,
      key: cacheKey(query),
      params: query.params,
      fetchedAt: now,
    })
    .onConflictDoUpdate({
      target: [searchCaches.kind, searchCaches.key],
      set: { fetchedAt: now, refreshStartedAt: null },
    })
    .returning({ id: searchCaches.id });

  const cached = await db
    .select({
      resultKey: searchResults.resultKey,
      option: searchResults.option,
    })
    .from(searchResults)
    .where(eq(searchResults.cacheId, cache.id));
  const { removed, updated } = await findRemoved(
    query,
    cached.filter((c) => !fetched.has(c.resultKey)),
  );
  for (const option of updated) fetched.set(resultKey(query, option), option);

  await db.transaction(async (tx) => {
    for (const [key, option] of fetched) {
      const price = Number(option.totalAmount);
      await tx
        .insert(searchResults)
        .values({
          cacheId: cache.id,
          resultKey: key,
          option,
          price,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: [searchResults.cacheId, searchResults.resultKey],
          set: { option, price, lastSeenAt: now },
        });
    }
    if (removed.length)
      await tx
        .delete(searchResults)
        .where(
          and(
            eq(searchResults.cacheId, cache.id),
            inArray(searchResults.resultKey, removed),
          ),
        );
  });

  await deleteOldSearches();
  return cache.id;
}

async function deleteOldSearches() {
  const cutoff = new Date(Date.now() - KEEP_FOR_MS);
  const old = db
    .select({ id: searchCaches.id })
    .from(searchCaches)
    .where(lt(searchCaches.fetchedAt, cutoff));
  await db.delete(searchResults).where(inArray(searchResults.cacheId, old));
  await db.delete(searchCaches).where(lt(searchCaches.fetchedAt, cutoff));
}

/**
 * Claims the stale cache for a background check. False when it isn't stale or
 * another request is already checking it.
 */
async function claimRefresh(cacheId: string) {
  const now = Date.now();
  const claimed = await db
    .update(searchCaches)
    .set({ refreshStartedAt: new Date(now) })
    .where(
      and(
        eq(searchCaches.id, cacheId),
        lt(searchCaches.fetchedAt, new Date(now - STALE_AFTER_MS)),
        or(
          isNull(searchCaches.refreshStartedAt),
          lt(searchCaches.refreshStartedAt, new Date(now - REFRESH_TIMEOUT_MS)),
        ),
      ),
    )
    .returning({ id: searchCaches.id });
  return claimed.length > 0;
}

/**
 * One page of results for a search, from the cache when there is one. The API
 * is called right away only for a search nobody has run yet, or when `force`
 * is set (the refresh button). Throws the API's error in those cases; when a
 * forced refresh fails, the cached page comes back with `error` instead.
 */
export async function getSearchPage<Q extends SearchQuery>(
  query: Q,
  { page, force = false }: { page: number; force?: boolean },
): Promise<SearchPage<OptionOf<Q>> & { error?: unknown }> {
  const find = () =>
    db
      .select()
      .from(searchCaches)
      .where(
        and(
          eq(searchCaches.kind, query.kind),
          eq(searchCaches.key, cacheKey(query)),
        ),
      )
      .then((rows) => rows[0]);

  let cache = await find();
  let error: unknown;
  if (!cache) {
    await refresh(query);
    cache = (await find())!;
  } else if (force) {
    try {
      await refresh(query);
      cache = (await find())!;
    } catch (e) {
      error = e;
    }
  }

  const stale = Date.now() - cache.fetchedAt.getTime() > STALE_AFTER_MS;
  if (stale && !error && (await claimRefresh(cache.id))) {
    after(async () => {
      try {
        await refresh(query);
      } catch (e) {
        console.error("Background search refresh failed", e);
        await db
          .update(searchCaches)
          .set({ refreshStartedAt: null })
          .where(eq(searchCaches.id, cache.id));
      }
    });
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(searchResults)
    .where(eq(searchResults.cacheId, cache.id));
  const pageCount = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const rows = await db
    .select({ option: searchResults.option })
    .from(searchResults)
    .where(eq(searchResults.cacheId, cache.id))
    .orderBy(asc(searchResults.price), asc(searchResults.resultKey))
    .limit(SEARCH_PAGE_SIZE)
    .offset((current - 1) * SEARCH_PAGE_SIZE);

  return {
    results: rows.map((r) => r.option as OptionOf<Q>),
    page: current,
    pageCount,
    total,
    fetchedAt: cache.fetchedAt,
    refreshing: stale && !error,
    error,
  };
}
