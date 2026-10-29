"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createExpense, deleteExpense, updateExpense } from "@/lib/expenses";
import { expenseSchema, issuesByPath, type FormState } from "@/lib/validation";

function parseExpense(formData: FormData) {
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    items = null;
  }
  return expenseSchema.safeParse({
    tripId: formData.get("tripId"),
    title: String(formData.get("title") ?? ""),
    paidById: formData.get("paidById"),
    items,
  });
}

export async function addExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseExpense(formData);
  if (!parsed.success) return { fieldErrors: issuesByPath(parsed.error) };

  const result = await createExpense(user.id, parsed.data);
  if (!result.ok) return { error: result.error };

  refresh();
  return { success: `Added “${parsed.data.title}”.` };
}

export async function editExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const expenseId = z.uuid().safeParse(formData.get("expenseId"));
  if (!expenseId.success) return { error: "That expense doesn't exist." };
  const parsed = parseExpense(formData);
  if (!parsed.success) return { fieldErrors: issuesByPath(parsed.error) };

  const result = await updateExpense(expenseId.data, user.id, parsed.data);
  if (!result.ok) return { error: result.error };

  // Leave edit mode; the trip page re-renders with the saved expense.
  redirect(`/trips/${parsed.data.tripId}`);
}

export async function removeExpense(formData: FormData) {
  const user = await requireUser();
  const parsed = z.uuid().safeParse(formData.get("expenseId"));
  if (!parsed.success) return;

  if (await deleteExpense(parsed.data, user.id)) refresh();
}
