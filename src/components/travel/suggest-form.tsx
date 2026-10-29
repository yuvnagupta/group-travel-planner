"use client";

import { useActionState } from "react";

import { suggestOptionAction } from "@/app/actions/suggestions";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";

type SuggestFormProps = {
  tripId: string;
  kind: "flight" | "hotel";
  payload: string;
  signature: string;
};

export function SuggestForm({
  tripId,
  kind,
  payload,
  signature,
}: SuggestFormProps) {
  const [state, action] = useActionState(suggestOptionAction, {});

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="tripId" value={tripId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="payload" value={payload} />
      <input type="hidden" name="signature" value={signature} />
      <FormMessage error={state.error ?? state.fieldErrors?.note?.[0]} />
      <div className="flex gap-2">
        <Input
          name="note"
          placeholder="Add a note for the group (optional)"
          maxLength={500}
          aria-label="Note"
        />
        <SubmitButton pendingText="Suggesting…">Suggest</SubmitButton>
      </div>
    </form>
  );
}
