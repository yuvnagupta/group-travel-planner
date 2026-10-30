import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  suggestions,
  suggestionVotes,
  tripInvites,
  tripMembers,
  trips,
} from "@/db/schema";

// Changes to a trip itself and to who's on it. Each function checks the acting
// user's role and returns an error message, or null when it succeeded.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getRole(tripId: string, userId: string) {
  const [row] = await db
    .select({ role: tripMembers.role })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
  return row?.role ?? null;
}

export async function updateTripDetails(
  tripId: string,
  userId: string,
  details: {
    name: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
  },
) {
  if ((await getRole(tripId, userId)) !== "owner") {
    return "Only the trip's owner can edit it.";
  }
  await db.update(trips).set(details).where(eq(trips.id, tripId));
  return null;
}

/**
 * Takes someone off a trip. Their votes go with them so they don't keep
 * swaying the group; what they suggested, commented and paid for stays, since
 * the rest of the group still relies on it.
 */
async function removeFromTrip(tx: Tx, tripId: string, userId: string) {
  await tx
    .delete(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
  const tripSuggestions = tx
    .select({ id: suggestions.id })
    .from(suggestions)
    .where(eq(suggestions.tripId, tripId));
  await tx
    .delete(suggestionVotes)
    .where(
      and(
        eq(suggestionVotes.userId, userId),
        inArray(suggestionVotes.suggestionId, tripSuggestions),
      ),
    );
}

export async function removeMember(
  tripId: string,
  ownerId: string,
  memberId: string,
) {
  if ((await getRole(tripId, ownerId)) !== "owner") {
    return "Only the trip's owner can remove people.";
  }
  if (memberId === ownerId) {
    return "You can't remove yourself. Make someone else the owner first.";
  }
  if (!(await getRole(tripId, memberId))) return "They're not on this trip.";

  await db.transaction((tx) => removeFromTrip(tx, tripId, memberId));
  return null;
}

export async function leaveTrip(tripId: string, userId: string) {
  const role = await getRole(tripId, userId);
  if (!role) return "You're not on this trip.";
  if (role === "owner") {
    return "Make someone else the owner before you leave, or delete the trip.";
  }
  await db.transaction((tx) => removeFromTrip(tx, tripId, userId));
  return null;
}

export async function transferOwnership(
  tripId: string,
  ownerId: string,
  newOwnerId: string,
) {
  if ((await getRole(tripId, ownerId)) !== "owner") {
    return "Only the trip's owner can hand it over.";
  }
  if ((await getRole(tripId, newOwnerId)) !== "member") {
    return "They need to be on the trip first.";
  }

  // trips.owner_id and the member roles must always agree.
  await db.transaction(async (tx) => {
    await tx
      .update(trips)
      .set({ ownerId: newOwnerId })
      .where(eq(trips.id, tripId));
    await tx
      .update(tripMembers)
      .set({ role: "member" })
      .where(
        and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, ownerId)),
      );
    await tx
      .update(tripMembers)
      .set({ role: "owner" })
      .where(
        and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, newOwnerId)),
      );
  });
  return null;
}

/** The owner can cancel any pending invite; other members only ones they sent. */
export async function cancelInvite(inviteId: string, userId: string) {
  const [invite] = await db
    .select({
      tripId: tripInvites.tripId,
      inviterId: tripInvites.inviterId,
      status: tripInvites.status,
    })
    .from(tripInvites)
    .where(eq(tripInvites.id, inviteId));
  if (!invite || invite.status !== "pending")
    return "That invite isn't pending.";

  const role = await getRole(invite.tripId, userId);
  if (!role || (role !== "owner" && invite.inviterId !== userId)) {
    return "Only the owner or the person who sent it can cancel this invite.";
  }
  await db.delete(tripInvites).where(eq(tripInvites.id, inviteId));
  return null;
}

/** Deletes the trip and, through cascades, everything on it. */
export async function deleteTrip(tripId: string, ownerId: string) {
  if ((await getRole(tripId, ownerId)) !== "owner") {
    return "Only the trip's owner can delete it.";
  }
  await db.delete(trips).where(eq(trips.id, tripId));
  return null;
}
