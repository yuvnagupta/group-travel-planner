"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  createTrip as insertTrip,
  inviteToTrip,
  respondToInvite,
} from "@/lib/trips";
import {
  fieldErrorsOf,
  inviteSchema,
  tripSchema,
  type FormState,
} from "@/lib/validation";

export async function createTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const values = Object.fromEntries(
    ["name", "destination", "startDate", "endDate"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );
  const parsed = tripSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const tripId = await insertTrip(user.id, parsed.data);
  redirect(`/trips/${tripId}`);
}

export async function inviteMember(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const values = { username: String(formData.get("username") ?? "") };
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const result = await inviteToTrip(
    parsed.data.tripId,
    user.id,
    parsed.data.username,
  );
  if (!result.ok) return { error: result.error, values };

  refresh();
  return { success: `Invited ${result.username}.` };
}

const respondSchema = z.object({
  inviteId: z.uuid(),
  response: z.enum(["accept", "decline"]),
});

export async function respondInvite(formData: FormData) {
  const user = await requireUser();
  const parsed = respondSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const accept = parsed.data.response === "accept";
  const tripId = await respondToInvite(parsed.data.inviteId, user.id, accept);
  if (tripId && accept) redirect(`/trips/${tripId}`);
  refresh();
}
