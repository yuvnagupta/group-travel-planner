import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  expenseItems,
  expenseShares,
  expenses,
  tripMembers,
  users,
} from "@/db/schema";

import { shareAmounts } from "./splits";
import { isMember } from "./trips";
import type { ExpenseInput } from "./validation";

// Data access for trip expenses. Like `trips.ts`, every function takes the
// acting user's id and checks trip membership itself.

/** The trip's expenses (newest first) with their items and who owes what. */
export async function getExpensesForMember(tripId: string, userId: string) {
  if (!(await isMember(tripId, userId))) return null;

  const rows = await db
    .select({
      id: expenses.id,
      title: expenses.title,
      amountCents: expenses.amountCents,
      paidById: expenses.paidById,
      createdById: expenses.createdById,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .where(eq(expenses.tripId, tripId))
    .orderBy(desc(expenses.createdAt), desc(expenses.id));
  if (rows.length === 0) return [];

  const items = await db
    .select()
    .from(expenseItems)
    .where(
      inArray(
        expenseItems.expenseId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(expenseItems.position));

  const shares = await db
    .select({
      itemId: expenseShares.itemId,
      userId: expenseShares.userId,
      weight: expenseShares.weight,
      amountCents: expenseShares.amountCents,
    })
    .from(expenseShares)
    .innerJoin(expenseItems, eq(expenseShares.itemId, expenseItems.id))
    .innerJoin(expenses, eq(expenseItems.expenseId, expenses.id))
    .where(eq(expenses.tripId, tripId))
    // Shares are inserted in the item's participant order.
    .orderBy(sql`${expenseShares}.rowid`);

  return rows.map((expense) => ({
    ...expense,
    items: items
      .filter((item) => item.expenseId === expense.id)
      .map((item) => ({
        id: item.id,
        description: item.description,
        amountCents: item.amountCents,
        splitType: item.splitType,
        shares: shares.filter((s) => s.itemId === item.id),
      })),
  }));
}

export type TripExpense = NonNullable<
  Awaited<ReturnType<typeof getExpensesForMember>>
>[number];

/**
 * Per-person totals: what they paid, what their share came to, and the net
 * (positive means they're owed money). Nets across the trip sum to zero.
 */
export function balancesOf(tripExpenses: TripExpense[]) {
  const totals = new Map<string, { paidCents: number; owedCents: number }>();
  const entry = (id: string) => {
    let t = totals.get(id);
    if (!t) totals.set(id, (t = { paidCents: 0, owedCents: 0 }));
    return t;
  };
  for (const expense of tripExpenses) {
    entry(expense.paidById).paidCents += expense.amountCents;
    for (const item of expense.items)
      for (const share of item.shares)
        entry(share.userId).owedCents += share.amountCents;
  }
  return totals;
}

export type ExpenseResult = { ok: true } | { ok: false; error: string };

/** Checks the acting user and everyone the expense names are trip members. */
async function checkMembers(
  userId: string,
  input: ExpenseInput,
): Promise<ExpenseResult> {
  const { tripId } = input;
  if (!(await isMember(tripId, userId))) {
    return { ok: false, error: "You're not a member of this trip." };
  }

  const named = new Set([
    input.paidById,
    ...input.items.flatMap((i) => i.participants.map((p) => p.userId)),
  ]);
  const members = await db
    .select({ userId: tripMembers.userId })
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, tripId),
        inArray(tripMembers.userId, [...named]),
      ),
    );
  if (members.length !== named.size) {
    return { ok: false, error: "Everyone on an expense must be on the trip." };
  }
  return { ok: true };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Inserts an expense's items and the shares computed from their splits. */
async function insertItems(tx: Tx, expenseId: string, input: ExpenseInput) {
  for (const [position, item] of input.items.entries()) {
    const [row] = await tx
      .insert(expenseItems)
      .values({
        expenseId,
        position,
        description: item.description,
        amountCents: item.amountCents,
        splitType: item.splitType,
      })
      .returning({ id: expenseItems.id });

    const amounts = shareAmounts(
      item.splitType,
      item.amountCents,
      item.participants.map((p) => p.weight),
    );
    await tx.insert(expenseShares).values(
      item.participants.map((p, i) => ({
        itemId: row.id,
        userId: p.userId,
        weight: p.weight,
        amountCents: amounts[i],
      })),
    );
  }
}

const totalOf = (input: ExpenseInput) =>
  input.items.reduce((sum, i) => sum + i.amountCents, 0);

/** Records an expense. Any member can, and everyone named must be a member. */
export async function createExpense(
  userId: string,
  input: ExpenseInput,
): Promise<ExpenseResult> {
  const check = await checkMembers(userId, input);
  if (!check.ok) return check;

  await db.transaction(async (tx) => {
    const [expense] = await tx
      .insert(expenses)
      .values({
        tripId: input.tripId,
        title: input.title,
        amountCents: totalOf(input),
        paidById: input.paidById,
        createdById: userId,
      })
      .returning({ id: expenses.id });
    await insertItems(tx, expense.id, input);
  });
  return { ok: true };
}

/**
 * Replaces an expense's details, items and splits. Only the member who added
 * it can, and it has to stay on the same trip.
 */
export async function updateExpense(
  expenseId: string,
  userId: string,
  input: ExpenseInput,
): Promise<ExpenseResult> {
  const check = await checkMembers(userId, input);
  if (!check.ok) return check;

  const where = and(
    eq(expenses.id, expenseId),
    eq(expenses.tripId, input.tripId),
    eq(expenses.createdById, userId),
  );
  const [expense] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(where);
  if (!expense) {
    return { ok: false, error: "You can only edit expenses you added." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(expenses)
      .set({
        title: input.title,
        amountCents: totalOf(input),
        paidById: input.paidById,
      })
      .where(where);
    // Shares go with their items via ON DELETE CASCADE.
    await tx.delete(expenseItems).where(eq(expenseItems.expenseId, expenseId));
    await insertItems(tx, expenseId, input);
  });
  return { ok: true };
}

/** Deletes an expense, but only for the member who added it. */
export async function deleteExpense(expenseId: string, userId: string) {
  const [expense] = await db
    .select({ tripId: expenses.tripId })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.createdById, userId)));
  if (!expense || !(await isMember(expense.tripId, userId))) return false;

  await db.delete(expenses).where(eq(expenses.id, expenseId));
  return true;
}

export async function usernamesOf(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.username]));
}
