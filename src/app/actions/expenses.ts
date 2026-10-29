"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createExpense, deleteExpense } from "@/lib/expenses";
import { expenseSchema, issuesByPath, type FormState } from "@/lib/validation";

export async function addExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Something went wrong reading the items. Try again." };
  }
  const parsed = expenseSchema.safeParse({
    tripId: formData.get("tripId"),
    title: String(formData.get("title") ?? ""),
    paidById: formData.get("paidById"),
    items,
  });
  if (!parsed.success) return { fieldErrors: issuesByPath(parsed.error) };

  const result = await createExpense(user.id, parsed.data);
  if (!result.ok) return { error: result.error };

  refresh();
  return { success: `Added “${parsed.data.title}”.` };
}

export async function removeExpense(formData: FormData) {
  const user = await requireUser();
  const parsed = z.uuid().safeParse(formData.get("expenseId"));
  if (!parsed.success) return;

  if (await deleteExpense(parsed.data, user.id)) refresh();
}
