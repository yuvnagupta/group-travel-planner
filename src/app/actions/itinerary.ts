"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createItem, deleteItem, moveItem, updateItem } from "@/lib/itinerary";
import {
  fieldErrorsOf,
  itineraryItemSchema,
  type FormState,
} from "@/lib/validation";

const FIELDS = [
  "day",
  "title",
  "category",
  "startTime",
  "endTime",
  "location",
  "notes",
] as const;

function parseItem(formData: FormData) {
  const values = Object.fromEntries(
    FIELDS.map((k) => [k, String(formData.get(k) ?? "")]),
  );
  return { values, parsed: itineraryItemSchema.safeParse(values) };
}

export async function addItineraryItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const tripId = z.uuid().safeParse(formData.get("tripId"));
  if (!tripId.success) return { error: "That trip doesn't exist." };
  const { values, parsed } = parseItem(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const error = await createItem(tripId.data, user.id, parsed.data);
  if (error) return { error, values };
  refresh();
  return { success: `Added “${parsed.data.title}”.` };
}

export async function editItineraryItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const itemId = z.uuid().safeParse(formData.get("itemId"));
  if (!itemId.success) return { error: "That item doesn't exist." };
  const { values, parsed } = parseItem(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values };
  }

  const error = await updateItem(itemId.data, user.id, parsed.data);
  if (error) return { error, values };
  refresh();
  return { success: "Saved." };
}

const moveSchema = z.object({
  itemId: z.uuid(),
  day: z.iso.date().nullable(),
  index: z.number().int().min(0).max(1000),
});

/** Called from drag-and-drop with plain arguments rather than a form. */
export async function moveItineraryItem(input: {
  itemId: string;
  day: string | null;
  index: number;
}) {
  const user = await requireUser();
  const parsed = moveSchema.safeParse(input);
  const ok =
    parsed.success &&
    (await moveItem(
      parsed.data.itemId,
      user.id,
      parsed.data.day,
      parsed.data.index,
    ));
  refresh();
  return { ok };
}

export async function deleteItineraryItem(formData: FormData) {
  const user = await requireUser();
  const itemId = z.uuid().safeParse(formData.get("itemId"));
  if (!itemId.success) return;
  await deleteItem(itemId.data, user.id);
  refresh();
}
