import "server-only";

import { and, count, eq, inArray, notExists, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import {
  expenseItems,
  expenseShares,
  expenses,
  suggestions,
  suggestionVotes,
  tripMembers,
} from "@/db/schema";

import { getTripsForUser } from "./trips";

// Data for the signed-in home page. Trip ids come from the user's own
// memberships, so every aggregate below is scoped to trips they belong to.

export type TripSummary = Awaited<
  ReturnType<typeof getTripSummariesForUser>
>[number];

/** The user's trips with member, decision and expense totals for each. */
export async function getTripSummariesForUser(userId: string) {
  const trips = await getTripsForUser(userId);
  if (trips.length === 0) return [];
  const ids = trips.map((t) => t.id);

  const [members, decisions, spent, paid, owed] = await Promise.all([
    db
      .select({ tripId: tripMembers.tripId, n: count() })
      .from(tripMembers)
      .where(inArray(tripMembers.tripId, ids))
      .groupBy(tripMembers.tripId),
    db
      .select({
        tripId: suggestions.tripId,
        n: count(),
        // Suggestions the user hasn't voted on yet.
        awaiting: sql<number>`sum(case when ${notExists(
          db
            .select({ one: sql`1` })
            .from(suggestionVotes)
            .where(
              and(
                eq(suggestionVotes.suggestionId, suggestions.id),
                eq(suggestionVotes.userId, userId),
              ),
            ),
        )} then 1 else 0 end)`,
      })
      .from(suggestions)
      .where(inArray(suggestions.tripId, ids))
      .groupBy(suggestions.tripId),
    db
      .select({ tripId: expenses.tripId, cents: sum(expenses.amountCents) })
      .from(expenses)
      .where(inArray(expenses.tripId, ids))
      .groupBy(expenses.tripId),
    db
      .select({ tripId: expenses.tripId, cents: sum(expenses.amountCents) })
      .from(expenses)
      .where(and(inArray(expenses.tripId, ids), eq(expenses.paidById, userId)))
      .groupBy(expenses.tripId),
    db
      .select({
        tripId: expenses.tripId,
        cents: sum(expenseShares.amountCents),
      })
      .from(expenseShares)
      .innerJoin(expenseItems, eq(expenseShares.itemId, expenseItems.id))
      .innerJoin(expenses, eq(expenseItems.expenseId, expenses.id))
      .where(
        and(inArray(expenses.tripId, ids), eq(expenseShares.userId, userId)),
      )
      .groupBy(expenses.tripId),
  ]);

  const byTrip = <T extends { tripId: string }>(rows: T[]) =>
    new Map(rows.map((r) => [r.tripId, r]));
  const memberCounts = byTrip(members);
  const decisionCounts = byTrip(decisions);
  const spentTotals = byTrip(spent);
  const paidTotals = byTrip(paid);
  const owedTotals = byTrip(owed);

  return trips.map((trip) => ({
    ...trip,
    memberCount: memberCounts.get(trip.id)?.n ?? 1,
    suggestionCount: decisionCounts.get(trip.id)?.n ?? 0,
    awaitingVoteCount: Number(decisionCounts.get(trip.id)?.awaiting ?? 0),
    spentCents: Number(spentTotals.get(trip.id)?.cents ?? 0),
    // Positive means the group owes the user; negative means the user owes.
    netCents:
      Number(paidTotals.get(trip.id)?.cents ?? 0) -
      Number(owedTotals.get(trip.id)?.cents ?? 0),
  }));
}
