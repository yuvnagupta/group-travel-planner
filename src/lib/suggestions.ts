import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  suggestionComments,
  suggestions,
  suggestionVotes,
  trips,
  users,
} from "@/db/schema";

import type { FlightOption, HotelOption } from "./travel/types";
import { isMember } from "./trips";

// Data access for trip suggestions. Like trips.ts, every function checks that the
// acting user belongs to the trip before reading or writing.

export type SuggestionKind = "flight" | "hotel";

export type SuggestionView = {
  id: string;
  kind: SuggestionKind;
  details: FlightOption | HotelOption;
  priceAmount: string;
  priceCurrency: string;
  note: string | null;
  chosen: boolean;
  createdAt: Date;
  author: { id: string; username: string };
  score: number;
  upvotes: number;
  downvotes: number;
  myVote: -1 | 0 | 1;
  comments: {
    id: string;
    body: string;
    createdAt: Date;
    author: { id: string; username: string };
  }[];
};

/** All suggestions for a trip, highest score first. Assumes the caller already checked membership. */
export async function getSuggestionsForTrip(
  tripId: string,
  userId: string,
): Promise<SuggestionView[]> {
  const rows = await db
    .select({
      id: suggestions.id,
      kind: suggestions.kind,
      details: suggestions.details,
      priceAmount: suggestions.priceAmount,
      priceCurrency: suggestions.priceCurrency,
      note: suggestions.note,
      chosenAt: suggestions.chosenAt,
      createdAt: suggestions.createdAt,
      authorId: users.id,
      authorUsername: users.username,
      upvotes: sql<number>`(select count(*) from ${suggestionVotes} v where v.suggestion_id = ${suggestions.id} and v.value = 1)`,
      downvotes: sql<number>`(select count(*) from ${suggestionVotes} v where v.suggestion_id = ${suggestions.id} and v.value = -1)`,
      myVote: sql<number>`coalesce((select v.value from ${suggestionVotes} v where v.suggestion_id = ${suggestions.id} and v.user_id = ${userId}), 0)`,
    })
    .from(suggestions)
    .innerJoin(users, eq(suggestions.authorId, users.id))
    .where(eq(suggestions.tripId, tripId));

  const ids = rows.map((r) => r.id);
  const comments = ids.length
    ? await db
        .select({
          id: suggestionComments.id,
          suggestionId: suggestionComments.suggestionId,
          body: suggestionComments.body,
          createdAt: suggestionComments.createdAt,
          authorId: users.id,
          authorUsername: users.username,
        })
        .from(suggestionComments)
        .innerJoin(users, eq(suggestionComments.authorId, users.id))
        .where(inArray(suggestionComments.suggestionId, ids))
        .orderBy(asc(suggestionComments.createdAt))
    : [];

  return rows
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      details: r.details as FlightOption | HotelOption,
      priceAmount: r.priceAmount,
      priceCurrency: r.priceCurrency,
      note: r.note,
      chosen: r.chosenAt !== null,
      createdAt: r.createdAt,
      author: { id: r.authorId, username: r.authorUsername },
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      score: r.upvotes - r.downvotes,
      myVote: Math.sign(r.myVote) as -1 | 0 | 1,
      comments: comments
        .filter((c) => c.suggestionId === r.id)
        .map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          author: { id: c.authorId, username: c.authorUsername },
        })),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime(),
    );
}

export async function addSuggestion(
  tripId: string,
  userId: string,
  suggestion:
    | { kind: "flight"; option: FlightOption; note: string | null }
    | { kind: "hotel"; option: HotelOption; note: string | null },
) {
  if (!(await isMember(tripId, userId))) return false;
  await db.insert(suggestions).values({
    tripId,
    authorId: userId,
    kind: suggestion.kind,
    details: suggestion.option,
    priceAmount: suggestion.option.totalAmount,
    priceCurrency: suggestion.option.totalCurrency,
    note: suggestion.note,
  });
  return true;
}

/** The suggestion's trip id if the user is a member of that trip, otherwise null. */
async function tripIdForMember(suggestionId: string, userId: string) {
  const [row] = await db
    .select({ tripId: suggestions.tripId, authorId: suggestions.authorId })
    .from(suggestions)
    .where(eq(suggestions.id, suggestionId));
  if (!row || !(await isMember(row.tripId, userId))) return null;
  return row;
}

/** Sets the user's vote. Voting the same way twice clears the vote. */
export async function vote(
  suggestionId: string,
  userId: string,
  value: 1 | -1,
) {
  if (!(await tripIdForMember(suggestionId, userId))) return false;

  const where = and(
    eq(suggestionVotes.suggestionId, suggestionId),
    eq(suggestionVotes.userId, userId),
  );
  const [existing] = await db
    .select({ value: suggestionVotes.value })
    .from(suggestionVotes)
    .where(where);

  if (existing?.value === value) {
    await db.delete(suggestionVotes).where(where);
  } else {
    await db
      .insert(suggestionVotes)
      .values({ suggestionId, userId, value })
      .onConflictDoUpdate({
        target: [suggestionVotes.suggestionId, suggestionVotes.userId],
        set: { value },
      });
  }
  return true;
}

export async function addComment(
  suggestionId: string,
  userId: string,
  body: string,
) {
  if (!(await tripIdForMember(suggestionId, userId))) return false;
  await db
    .insert(suggestionComments)
    .values({ suggestionId, authorId: userId, body });
  return true;
}

/**
 * Makes a suggestion the trip's plan for its kind, replacing any earlier pick,
 * or clears it. Only the trip owner decides.
 */
export async function chooseSuggestion(
  suggestionId: string,
  userId: string,
  chosen: boolean,
) {
  const [row] = await db
    .select({
      tripId: suggestions.tripId,
      kind: suggestions.kind,
      ownerId: trips.ownerId,
    })
    .from(suggestions)
    .innerJoin(trips, eq(suggestions.tripId, trips.id))
    .where(eq(suggestions.id, suggestionId));
  if (!row || row.ownerId !== userId) return false;

  await db.transaction(async (tx) => {
    await tx
      .update(suggestions)
      .set({ chosenAt: null })
      .where(
        and(eq(suggestions.tripId, row.tripId), eq(suggestions.kind, row.kind)),
      );
    if (chosen)
      await tx
        .update(suggestions)
        .set({ chosenAt: new Date() })
        .where(eq(suggestions.id, suggestionId));
  });
  return true;
}

/** Only the person who suggested something can remove it. */
export async function deleteSuggestion(suggestionId: string, userId: string) {
  const row = await tripIdForMember(suggestionId, userId);
  if (!row || row.authorId !== userId) return false;
  await db.delete(suggestions).where(eq(suggestions.id, suggestionId));
  return true;
}

/** Only a comment's author can delete it. */
export async function deleteComment(commentId: string, userId: string) {
  const result = await db
    .delete(suggestionComments)
    .where(
      and(
        eq(suggestionComments.id, commentId),
        eq(suggestionComments.authorId, userId),
      ),
    );
  return result.rowsAffected > 0;
}
