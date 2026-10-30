"use client";

import { useActionState } from "react";

import { editTrip } from "@/app/actions/trip-settings";
import { DateRangeField } from "@/components/forms/date-range-field";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";

type EditTripFormProps = {
  trip: {
    id: string;
    name: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
  };
};

export function EditTripForm({ trip }: EditTripFormProps) {
  const [state, action] = useActionState(editTrip, {});
  const v = state.values;
  const e = state.fieldErrors;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="tripId" value={trip.id} />
      <FormMessage error={state.error} success={state.success} />
      <Field
        name="name"
        label="Trip name"
        required
        defaultValue={v?.name ?? trip.name}
        errors={e?.name}
      />
      <Field
        name="destination"
        label="Destination (optional)"
        defaultValue={v?.destination ?? trip.destination ?? ""}
        errors={e?.destination}
      />
      <DateRangeField
        startName="startDate"
        endName="endDate"
        defaultStart={v?.startDate ?? trip.startDate ?? undefined}
        defaultEnd={v?.endDate ?? trip.endDate ?? undefined}
        errors={[...(e?.startDate ?? []), ...(e?.endDate ?? [])]}
      />
      <SubmitButton className="justify-self-start" pendingText="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}
