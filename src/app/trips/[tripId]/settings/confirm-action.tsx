"use client";

import { useActionState, useState } from "react";

import type { MemberActionState } from "@/app/actions/trip-settings";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";

type ConfirmActionProps = {
  action: (
    prev: MemberActionState,
    formData: FormData,
  ) => Promise<MemberActionState>;
  fields: Record<string, string>;
  label: string;
  /** Shown on the second click, e.g. "Remove @sam?". */
  question: string;
  confirmLabel: string;
  pendingText: string;
  destructive?: boolean;
};

/** A button that asks once before running an action that's hard to undo. */
export function ConfirmAction({
  action,
  fields,
  label,
  question,
  confirmLabel,
  pendingText,
  destructive,
}: ConfirmActionProps) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(action, {});

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={destructive ? "text-destructive" : undefined}
          onClick={() => setConfirming(true)}
        >
          {label}
        </Button>
        {state.error && (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center justify-end gap-1"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <span className="text-sm text-muted-foreground">{question}</span>
      <SubmitButton
        size="sm"
        variant={destructive ? "destructive" : "secondary"}
        pendingText={pendingText}
      >
        {confirmLabel}
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
