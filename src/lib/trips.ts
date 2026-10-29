import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

import { db } from "@/db";
import { tripInvites, tripMembers, trips, users } from "@/db/schema";

// Data access for trips and invites. Every function takes the acting user's id
// and checks access itself, so callers can't reach trips they don't belong to.

export async function getTripsForUser(userId: string) {
  return db
    .select({
      id: trips.id,
      name: trips.name,
      destination: trips.destination,
      startDate: trips.startDate,
      endDate: trips.endDate,
      role: tripMembers.role,
    })
    .from(tripMembers)
    .innerJoin(trips, eq(tripMembers.tripId, trips.id))
    .where(eq(tripMembers.userId, userId))
    .orderBy(desc(trips.createdAt));
}

export async function getPendingInvitesForUser(userId: string) {
  const inviter = alias(users, "inviter");
  return db
    .select({
      id: tripInvites.id,
      tripName: trips.name,
      destination: trips.destination,
      inviterUsername: inviter.username,
      createdAt: tripInvites.createdAt,
    })
    .from(tripInvites)
    .innerJoin(trips, eq(tripInvites.tripId, trips.id))
    .innerJoin(inviter, eq(tripInvites.inviterId, inviter.id))
    .where(
      and(eq(tripInvites.inviteeId, userId), eq(tripInvites.status, "pending")),
    )
    .orderBy(desc(tripInvites.createdAt));
}

export async function isMember(tripId: string, userId: string) {
  const [row] = await db
    .select({ userId: tripMembers.userId })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
  return Boolean(row);
}

/** The trip with its members and pending invites, or null if the user isn't a member. */
export async function getTripForMember(tripId: string, userId: string) {
  if (!(await isMember(tripId, userId))) return null;

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip) return null;

  const members = await db
    .select({ id: users.id, username: users.username, role: tripMembers.role })
    .from(tripMembers)
    .innerJoin(users, eq(tripMembers.userId, users.id))
    .where(eq(tripMembers.tripId, tripId))
    .orderBy(asc(tripMembers.joinedAt));

  const pendingInvites = await db
    .select({ id: tripInvites.id, username: users.username })
    .from(tripInvites)
    .innerJoin(users, eq(tripInvites.inviteeId, users.id))
    .where(
      and(eq(tripInvites.tripId, tripId), eq(tripInvites.status, "pending")),
    )
    .orderBy(asc(tripInvites.createdAt));

  return { ...trip, members, pendingInvites };
}

export async function createTrip(
  userId: string,
  data: {
    name: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
  },
) {
  return db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({ ...data, ownerId: userId })
      .returning({ id: trips.id });
    await tx
      .insert(tripMembers)
      .values({ tripId: trip.id, userId, role: "owner" });
    return trip.id;
  });
}

export type InviteResult =
  { ok: true; username: string } | { ok: false; error: string };

/** Invites a user to a trip by username. Any member of the trip can invite. */
export async function inviteToTrip(
  tripId: string,
  inviterId: string,
  username: string,
): Promise<InviteResult> {
  if (!(await isMember(tripId, inviterId))) {
    return { ok: false, error: "You're not a member of this trip." };
  }

  const [invitee] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username));
  if (!invitee) return { ok: false, error: `No user named "${username}".` };
  if (await isMember(tripId, invitee.id)) {
    return { ok: false, error: `${invitee.username} is already on this trip.` };
  }

  const [existing] = await db
    .select({ id: tripInvites.id, status: tripInvites.status })
    .from(tripInvites)
    .where(
      and(
        eq(tripInvites.tripId, tripId),
        eq(tripInvites.inviteeId, invitee.id),
      ),
    );

  if (existing?.status === "pending") {
    return {
      ok: false,
      error: `${invitee.username} already has a pending invite.`,
    };
  }

  if (existing) {
    // Re-invite after a decline (or after leaving): reopen the same invite.
    await db
      .update(tripInvites)
      .set({
        status: "pending",
        inviterId,
        createdAt: new Date(),
        respondedAt: null,
      })
      .where(eq(tripInvites.id, existing.id));
  } else {
    await db
      .insert(tripInvites)
      .values({ tripId, inviteeId: invitee.id, inviterId });
  }
  return { ok: true, username: invitee.username };
}

/** Accepts or declines one of the user's pending invites. Returns the trip id, or null if not found. */
export async function respondToInvite(
  inviteId: string,
  userId: string,
  accept: boolean,
) {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({ tripId: tripInvites.tripId })
      .from(tripInvites)
      .where(
        and(
          eq(tripInvites.id, inviteId),
          eq(tripInvites.inviteeId, userId),
          eq(tripInvites.status, "pending"),
        ),
      );
    if (!invite) return null;

    await tx
      .update(tripInvites)
      .set({
        status: accept ? "accepted" : "declined",
        respondedAt: new Date(),
      })
      .where(eq(tripInvites.id, inviteId));

    if (accept) {
      await tx
        .insert(tripMembers)
        .values({ tripId: invite.tripId, userId, role: "member" })
        .onConflictDoNothing();
    }
    return invite.tripId;
  });
}
