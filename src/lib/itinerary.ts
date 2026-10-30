import "server-only";

import { and, asc, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  itineraryItems,
  trips,
  users,
  type itineraryCategories,
} from "@/db/schema";

import { isMember } from "./trips";

// Data access for trip itineraries. Any member can add, edit, move or delete any
// item; every function checks membership itself.

export type ItineraryCategory = (typeof itineraryCategories)[number];

export type ItineraryItemInput = {
  day: string | null;
  title: string;
  category: ItineraryCategory;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
};

export type ItineraryItem = ItineraryItemInput & {
  id: string;
  position: number;
  createdBy: string;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** All items for a trip in day and position order, or null if the user isn't a member. */
export async function getItineraryForMember(
  tripId: string,
  userId: string,
): Promise<ItineraryItem[] | null> {
  if (!(await isMember(tripId, userId))) return null;
  const rows = await db
    .select({
      id: itineraryItems.id,
      day: itineraryItems.day,
      position: itineraryItems.position,
      title: itineraryItems.title,
      category: itineraryItems.category,
      startTime: itineraryItems.startTime,
      endTime: itineraryItems.endTime,
      location: itineraryItems.location,
      notes: itineraryItems.notes,
      createdBy: users.username,
    })
    .from(itineraryItems)
    .innerJoin(users, eq(itineraryItems.createdById, users.id))
    .where(eq(itineraryItems.tripId, tripId))
    .orderBy(asc(itineraryItems.day), asc(itineraryItems.position));
  return rows;
}

/** Items can sit on any day of the trip, or on no day at all. */
async function dayAllowed(tripId: string, day: string | null) {
  if (day === null) return true;
  const [trip] = await db
    .select({ startDate: trips.startDate, endDate: trips.endDate })
    .from(trips)
    .where(eq(trips.id, tripId));
  return Boolean(
    trip?.startDate &&
    trip.endDate &&
    day >= trip.startDate &&
    day <= trip.endDate,
  );
}

const sameDay = (day: string | null) =>
  day === null ? isNull(itineraryItems.day) : eq(itineraryItems.day, day);

/** Ids of the items on one day of a trip, in order, optionally leaving one out. */
async function dayOrder(
  tx: Tx,
  tripId: string,
  day: string | null,
  excludeId?: string,
) {
  const rows = await tx
    .select({ id: itineraryItems.id, startTime: itineraryItems.startTime })
    .from(itineraryItems)
    .where(
      and(
        eq(itineraryItems.tripId, tripId),
        sameDay(day),
        excludeId ? ne(itineraryItems.id, excludeId) : undefined,
      ),
    )
    .orderBy(asc(itineraryItems.position));
  return rows;
}

async function writeOrder(tx: Tx, ids: string[], day: string | null) {
  for (const [position, id] of ids.entries()) {
    await tx
      .update(itineraryItems)
      .set({ position, day })
      .where(eq(itineraryItems.id, id));
  }
}

/** Where a new item goes: before the first item that starts later, else at the end. */
function timedIndex(
  order: { startTime: string | null }[],
  startTime: string | null,
) {
  if (!startTime) return order.length;
  const index = order.findIndex(
    (o) => o.startTime !== null && o.startTime > startTime,
  );
  return index === -1 ? order.length : index;
}

/** Returns an error message, or null on success. */
export async function createItem(
  tripId: string,
  userId: string,
  input: ItineraryItemInput,
) {
  if (!(await isMember(tripId, userId))) return "You're not on this trip.";
  if (!(await dayAllowed(tripId, input.day)))
    return "Pick a day within the trip.";
  await db.transaction(async (tx) => {
    const order = await dayOrder(tx, tripId, input.day);
    const index = timedIndex(order, input.startTime);
    const [item] = await tx
      .insert(itineraryItems)
      .values({ ...input, tripId, position: order.length, createdById: userId })
      .returning({ id: itineraryItems.id });
    const ids = order.map((o) => o.id);
    ids.splice(index, 0, item.id);
    await writeOrder(tx, ids, input.day);
  });
  return null;
}

/** The item's trip and day if the user is a member of that trip, otherwise null. */
async function itemForMember(itemId: string, userId: string) {
  const [item] = await db
    .select({ tripId: itineraryItems.tripId, day: itineraryItems.day })
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId));
  if (!item || !(await isMember(item.tripId, userId))) return null;
  return item;
}

/** Returns an error message, or null on success. */
export async function updateItem(
  itemId: string,
  userId: string,
  input: ItineraryItemInput,
) {
  const item = await itemForMember(itemId, userId);
  if (!item) return "That item doesn't exist.";
  if (!(await dayAllowed(item.tripId, input.day))) {
    return "Pick a day within the trip.";
  }

  await db.transaction(async (tx) => {
    await tx
      .update(itineraryItems)
      .set(input)
      .where(eq(itineraryItems.id, itemId));
    if (input.day === item.day) return;

    // Moved to another day: close the gap it left and slot it in by time.
    const oldOrder = await dayOrder(tx, item.tripId, item.day, itemId);
    await writeOrder(
      tx,
      oldOrder.map((o) => o.id),
      item.day,
    );
    const newOrder = await dayOrder(tx, item.tripId, input.day, itemId);
    const ids = newOrder.map((o) => o.id);
    ids.splice(timedIndex(newOrder, input.startTime), 0, itemId);
    await writeOrder(tx, ids, input.day);
  });
  return null;
}

/** Moves an item to `index` within `day` (null for unscheduled ideas). */
export async function moveItem(
  itemId: string,
  userId: string,
  day: string | null,
  index: number,
) {
  const item = await itemForMember(itemId, userId);
  if (!item || !(await dayAllowed(item.tripId, day))) return false;

  await db.transaction(async (tx) => {
    if (day !== item.day) {
      const oldOrder = await dayOrder(tx, item.tripId, item.day, itemId);
      await writeOrder(
        tx,
        oldOrder.map((o) => o.id),
        item.day,
      );
    }
    const ids = (await dayOrder(tx, item.tripId, day, itemId)).map((o) => o.id);
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, itemId);
    await writeOrder(tx, ids, day);
  });
  return true;
}

export async function deleteItem(itemId: string, userId: string) {
  const item = await itemForMember(itemId, userId);
  if (!item) return false;

  await db.transaction(async (tx) => {
    await tx.delete(itineraryItems).where(eq(itineraryItems.id, itemId));
    const order = await dayOrder(tx, item.tripId, item.day);
    await writeOrder(
      tx,
      order.map((o) => o.id),
      item.day,
    );
  });
  return true;
}
