"use client";

import { useActionState } from "react";

import { signup } from "@/app/actions/auth";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function SignupForm() {
  const [state, action] = useActionState(signup, {});

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage error={state.error} />
      <Field
        name="username"
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.values?.username}
        errors={state.fieldErrors?.username}
        hint="3–20 characters: letters, numbers and underscores."
      />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.password}
        hint="At least 8 characters."
      />
      <Field
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
