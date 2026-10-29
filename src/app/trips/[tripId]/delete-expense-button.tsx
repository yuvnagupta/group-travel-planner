"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { removeExpense } from "@/app/actions/expenses";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";

/** Asks once before deleting, since deleting can't be undone. */
export function DeleteExpenseButton({
  expenseId,
  title,
}: {
  expenseId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete “${title}”`}
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden />
      </Button>
    );
  }
  return (
    <form action={removeExpense} className="flex items-center gap-1">
      <input type="hidden" name="expenseId" value={expenseId} />
      <SubmitButton variant="destructive" size="sm" pendingText="Deleting…">
        Delete
      </SubmitButton>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(false)}
      >
        Cancel
      </Button>
    </form>
  );
}
