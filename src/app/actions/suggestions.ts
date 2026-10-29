"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import {
  addComment,
  addSuggestion,
  deleteComment,
  deleteSuggestion,
  vote,
} from "@/lib/suggestions";
import { DuffelError, searchFlights, searchHotels } from "@/lib/travel/duffel";
import { signOption, verifyOption } from "@/lib/travel/signing";
import type { FlightOption, HotelOption, Signed } from "@/lib/travel/types";
import { isMember } from "@/lib/trips";
import {
  commentSchema,
  fieldErrorsOf,
  flightSearchSchema,
  hotelSearchSchema,
  suggestSchema,
  type FormState,
} from "@/lib/validation";

export type SearchState<T> = FormState & { results?: Signed<T>[] };

const tripIdSchema = z.uuid();

async function requireTripMember(formData: FormData) {
  const user = await requireUser();
  const tripId = tripIdSchema.safeParse(formData.get("tripId"));
  if (!tripId.success || !(await isMember(tripId.data, user.id))) {
    return { user, error: "You're not a member of this trip." };
  }
  return { user };
}

function searchError(error: unknown, values: Record<string, string>) {
  if (error instanceof DuffelError) return { error: error.message, values };
  throw error;
}

export async function searchFlightsAction(
  _prev: SearchState<FlightOption>,
  formData: FormData,
): Promise<SearchState<FlightOption>> {
  const values = Object.fromEntries(
    [...formData].map(([k, v]) => [k, String(v)]),
  );
  const { error } = await requireTripMember(formData);
  if (error) return { error, values };

  const parsed = flightSearchSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  try {
    const options = await searchFlights(parsed.data);
    return { values, results: options.map((o) => signOption("flight", o)) };
  } catch (e) {
    return searchError(e, values);
  }
}

export async function searchHotelsAction(
  _prev: SearchState<HotelOption>,
  formData: FormData,
): Promise<SearchState<HotelOption>> {
  const values = Object.fromEntries(
    [...formData].map(([k, v]) => [k, String(v)]),
  );
  const { error } = await requireTripMember(formData);
  if (error) return { error, values };

  const parsed = hotelSearchSchema.safeParse(values);
  if (!parsed.success)
    return { fieldErrors: fieldErrorsOf(parsed.error), values };

  try {
    const options = await searchHotels(parsed.data);
    return { values, results: options.map((o) => signOption("hotel", o)) };
  } catch (e) {
    return searchError(e, values);
  }
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

  redirect(`/trips/${tripId}#${kind === "flight" ? "flights" : "hotels"}`);
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
