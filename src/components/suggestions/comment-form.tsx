"use client";

import { useActionState } from "react";

import { commentAction } from "@/app/actions/suggestions";
import { SubmitButton } from "@/components/forms/submit-button";

export function CommentForm({ suggestionId }: { suggestionId: string }) {
  const [state, action] = useActionState(commentAction, {});
  const error = state.error ?? state.fieldErrors?.body?.[0];

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="suggestionId" value={suggestionId} />
      <textarea
        name="body"
        rows={2}
        maxLength={1000}
        required
        placeholder="Add a comment…"
        aria-label="Comment"
        defaultValue={state.values?.body}
        aria-invalid={Boolean(error) || undefined}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <SubmitButton
        size="sm"
        variant="secondary"
        className="justify-self-end"
        pendingText="Posting…"
      >
        Comment
      </SubmitButton>
    </form>
  );
}
