"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { trips } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  cancelInvite,
  deleteTrip,
  leaveTrip,
  removeMember,
  transferOwnership,
  updateTripDetails,
} from "@/lib/trip-settings";
import { fieldErrorsOf, tripSchema, type FormState } from "@/lib/validation";

const ids = z.object({ tripId: z.uuid(), userId: z.uuid().optional() });

function parseIds(formData: FormData) {
  return ids.safeParse({
    tripId: formData.get("tripId"),
    userId: formData.get("userId") ?? undefined,
  });
}

export async function editTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const tripId = z.uuid().safeParse(formData.get("tripId"));
  if (!tripId.success) return { error: "That trip doesn't exist." };

  const values = Object.fromEntries(
    ["name", "destination", "startDate", "endDate"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );
  const parsed = tripSchema.safeParse(values);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const error = await updateTripDetails(tripId.data, user.id, parsed.data);
  if (error) return { error, values };
  refresh();
  return { success: "Saved." };
}

/** Result for the member buttons, shown next to the members list. */
export type MemberActionState = { error?: string };

export async function removeMemberAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const user = await requireUser();
  const parsed = parseIds(formData);
  if (!parsed.success || !parsed.data.userId) return { error: "Try again." };

  const error = await removeMember(
    parsed.data.tripId,
    user.id,
    parsed.data.userId,
  );
  if (error) return { error };
  refresh();
  return {};
}

export async function transferOwnershipAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const user = await requireUser();
  const parsed = parseIds(formData);
  if (!parsed.success || !parsed.data.userId) return { error: "Try again." };

  const error = await transferOwnership(
    parsed.data.tripId,
    user.id,
    parsed.data.userId,
  );
  if (error) return { error };
  refresh();
  return {};
}

export async function cancelInviteAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const user = await requireUser();
  const inviteId = z.uuid().safeParse(formData.get("inviteId"));
  if (!inviteId.success) return { error: "Try again." };

  const error = await cancelInvite(inviteId.data, user.id);
  if (error) return { error };
  refresh();
  return {};
}

export async function leaveTripAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const user = await requireUser();
  const parsed = parseIds(formData);
  if (!parsed.success) return { error: "Try again." };

  const error = await leaveTrip(parsed.data.tripId, user.id);
  if (error) return { error };
  redirect("/trips");
}

export async function deleteTripAction(
  _prev: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const user = await requireUser();
  const parsed = parseIds(formData);
  if (!parsed.success) return { error: "Try again." };

  // Typing the name guards against deleting the wrong trip from a stale tab.
  const [trip] = await db
    .select({ name: trips.name })
    .from(trips)
    .where(eq(trips.id, parsed.data.tripId));
  if (!trip) return { error: "That trip doesn't exist." };
  if (String(formData.get("confirmName") ?? "").trim() !== trip.name) {
    return { error: `Type “${trip.name}” exactly to confirm.` };
  }

  const error = await deleteTrip(parsed.data.tripId, user.id);
  if (error) return { error };
  redirect("/trips");
}
