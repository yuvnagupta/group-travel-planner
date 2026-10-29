"use client";

import { useActionState } from "react";

import { createTrip } from "@/app/actions/trips";
import { DateRangeField } from "@/components/forms/date-range-field";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

export function NewTripForm() {
  const [state, action] = useActionState(createTrip, {});
  const v = state.values;
  const e = state.fieldErrors;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage error={state.error} />
      <Field
        name="name"
        label="Trip name"
        placeholder="Summer in Lisbon"
        required
        defaultValue={v?.name}
        errors={e?.name}
      />
      <Field
        name="destination"
        label="Destination (optional)"
        placeholder="Lisbon, Portugal"
        defaultValue={v?.destination}
        errors={e?.destination}
      />
      <DateRangeField
        startName="startDate"
        endName="endDate"
        defaultStart={v?.startDate}
        defaultEnd={v?.endDate}
        errors={[...(e?.startDate ?? []), ...(e?.endDate ?? [])]}
      />
      <SubmitButton pendingText="Creating…">Create trip</SubmitButton>
    </form>
  );
}
