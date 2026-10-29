"use client";

import { useActionState } from "react";

import { inviteMember } from "@/app/actions/trips";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function InviteForm({ tripId }: { tripId: string }) {
  const [state, action] = useActionState(inviteMember, {});

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="tripId" value={tripId} />
      <FormMessage error={state.error} success={state.success} />
      <Field
        name="username"
        label="Username"
        placeholder="their_username"
        autoCapitalize="none"
        spellCheck={false}
        autoComplete="off"
        required
        defaultValue={state.values?.username}
        errors={state.fieldErrors?.username}
      />
      <SubmitButton pendingText="Inviting…">Send invite</SubmitButton>
    </form>
  );
}
