"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { formatPlace } from "@/lib/format";
import {
  addComment,
  addSuggestion,
  chooseSuggestion,
  deleteComment,
  deleteSuggestion,
  vote,
} from "@/lib/suggestions";
import { getSearchPage, type SearchQuery } from "@/lib/travel/cache";
import { DuffelError, suggestPlacesCached } from "@/lib/travel/duffel";
import { LiteApiError } from "@/lib/travel/liteapi";
import { signOption, verifyOption } from "@/lib/travel/signing";
import type {
  FlightOption,
  HotelOption,
  Place,
  Signed,
} from "@/lib/travel/types";
import { getTripForMember, isMember } from "@/lib/trips";
import {
  commentSchema,
  fieldErrorsOf,
  flightSearchSchema,
  hotelSearchSchema,
  suggestSchema,
  type FormState,
} from "@/lib/validation";

export type SearchState<T> = FormState & {
  results?: Signed<T>[];
  page?: number;
  pageCount?: number;
  total?: number;
  /** ISO time the results were last fetched from the API. */
  fetchedAt?: string;
  /** The results were stale and the server is checking the API for new ones. */
  refreshing?: boolean;
};

const tripIdSchema = z.uuid();

async function requireTripMember(formData: FormData) {
  const user = await requireUser();
  const tripId = tripIdSchema.safeParse(formData.get("tripId"));
  if (!tripId.success || !(await isMember(tripId.data, user.id))) {
    return { user, error: "You're not a member of this trip." };
  }
  return { user };
}

/**
 * Search values for a trip that has a destination and upcoming dates, so the
 * trip page can show options before anyone fills in the form. Null otherwise.
 */
async function tripSearchDefaults(
  formData: FormData,
  userId: string,
  pick: (places: Place[]) => Place | undefined,
) {
  const trip = await getTripForMember(String(formData.get("tripId")), userId);
  const today = new Date().toISOString().slice(0, 10);
  if (!trip?.destination || !trip.startDate || trip.startDate < today)
    return null;

  const place = pick(await suggestPlacesCached(trip.destination));
  if (!place) return null;

  const travelers = Math.min(trip.members.length, 9);
  return {
    trip: { ...trip, startDate: trip.startDate },
    place,
    travelers,
  };
}

function searchError(error: unknown, values: Record<string, string>) {
  if (error instanceof DuffelError || error instanceof LiteApiError)
    return { error: error.message, values };
  throw error;
}

/**
 * Reads a page of cached results. `page` and `force` (the refresh button) are
 * per request, so they're left out of the values the form sends back.
 */
async function cachedSearch<T>(
  query: SearchQuery,
  values: Record<string, string>,
): Promise<SearchState<T>> {
  const { page, force, ...rest } = values;
  try {
    const result = await getSearchPage(query, {
      page: Number(page) || 1,
      force: force === "1",
    });
    return {
      ...(result.error ? searchError(result.error, rest) : {}),
      values: rest,
      results: result.results.map((o) => signOption(query.kind, o as T)),
      page: result.page,
      pageCount: result.pageCount,
      total: result.total,
      fetchedAt: result.fetchedAt.toISOString(),
      refreshing: result.refreshing,
    };
  } catch (e) {
    return searchError(e, rest);
  }
}

export async function searchFlightsAction(
  _prev: SearchState<FlightOption>,
  formData: FormData,
): Promise<SearchState<FlightOption>> {
  let values = Object.fromEntries(
    [...formData].map(([k, v]) => [k, String(v)]),
  );
  const { user, error } = await requireTripMember(formData);
  if (error) return { error, values };

  // `prefill` comes from the trip page on load, with the departure the browser
  // remembered from an earlier search.
  if (values.prefill) {
    try {
      const defaults = await tripSearchDefaults(
        formData,
        user.id,
        // A city covers all of its airports.
        (places) => places.find((p) => p.type === "city") ?? places[0],
      );
      if (!defaults) return {};
      const { trip, place, travelers } = defaults;
      values = {
        tripId: trip.id,
        prefilled: "1",
        originQuery: values.originQuery,
        origin: values.origin,
        destinationQuery: formatPlace(place),
        destination: place.iataCode,
        departureDate: trip.startDate,
        returnDate: trip.endDate ?? "",
        adults: String(travelers),
        cabinClass: "economy",
      };
    } catch (e) {
      return searchError(e, {});
    }
    // No remembered departure: fill in the destination and leave "From" to the user.
    if (!values.origin) return { values };
  }

  const parsed = flightSearchSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  return cachedSearch({ kind: "flight", params: parsed.data }, values);
}

export async function searchHotelsAction(
  _prev: SearchState<HotelOption>,
  formData: FormData,
): Promise<SearchState<HotelOption>> {
  let values = Object.fromEntries(
    [...formData].map(([k, v]) => [k, String(v)]),
  );
  const { user, error } = await requireTripMember(formData);
  if (error) return { error, values };

  // `prefill` comes from the trip page on load: search the trip's destination and dates.
  if (values.prefill) {
    try {
      const defaults = await tripSearchDefaults(
        formData,
        user.id,
        // Prefer the city over its airports; coordinates search more precisely.
        (places) =>
          places.find((p) => p.type === "city" && p.latitude !== null) ??
          places.find((p) => p.type === "city") ??
          places.find((p) => p.latitude !== null),
      );
      if (!defaults) return {};
      const { trip, place, travelers } = defaults;
      if (!trip.endDate || trip.endDate <= trip.startDate) return {};
      values = {
        tripId: trip.id,
        prefilled: "1",
        placeQuery: formatPlace(place),
        placeCode: place.iataCode,
        latitude: place.latitude?.toString() ?? "",
        longitude: place.longitude?.toString() ?? "",
        checkInDate: trip.startDate,
        checkOutDate: trip.endDate,
        adults: String(travelers),
        rooms: String(Math.min(Math.ceil(travelers / 2), 5)),
      };
    } catch (e) {
      return searchError(e, {});
    }
  }

  const parsed = hotelSearchSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  return cachedSearch({ kind: "hotel", params: parsed.data }, values);
}

export async function suggestOptionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = suggestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { tripId, kind, payload, signature, note } = parsed.data;
  const option = verifyOption<FlightOption | HotelOption>(
    kind,
    payload,
    signature,
  );
  if (!option)
    return {
      error:
        "This result has expired. Search again and pick it from the new results.",
    };

  const ok = await addSuggestion(
    tripId,
    user.id,
    kind === "flight"
      ? { kind, option: option as FlightOption, note }
      : { kind, option: option as HotelOption, note },
  );
  if (!ok) return { error: "You're not a member of this trip." };

  refresh();
  return { success: "Suggested to the group." };
}

const chooseSchema = z.object({
  id: z.uuid(),
  chosen: z.enum(["1", "0"]),
});

export async function chooseSuggestionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = chooseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await chooseSuggestion(parsed.data.id, user.id, parsed.data.chosen === "1");
  refresh();
}

const voteSchema = z.object({
  suggestionId: z.uuid(),
  value: z.enum(["1", "-1"]),
});

export async function voteAction(formData: FormData) {
  const user = await requireUser();
  const parsed = voteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await vote(
    parsed.data.suggestionId,
    user.id,
    parsed.data.value === "1" ? 1 : -1,
  );
  refresh();
}

export async function commentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      fieldErrors: fieldErrorsOf(parsed.error),
      values: { body: String(formData.get("body") ?? "") },
    };

  if (
    !(await addComment(parsed.data.suggestionId, user.id, parsed.data.body))
  ) {
    return { error: "You can't comment on this suggestion." };
  }
  refresh();
  return {};
}

const idSchema = z.object({ id: z.uuid() });

export async function deleteSuggestionAction(formData: FormData) {
  const user = await requireUser();
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await deleteSuggestion(parsed.data.id, user.id);
  refresh();
}

export async function deleteCommentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = idSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await deleteComment(parsed.data.id, user.id);
  refresh();
}
