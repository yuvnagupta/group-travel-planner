"use client";

import { useActionState } from "react";

import { deleteTripAction } from "@/app/actions/trip-settings";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeleteTripForm({
  tripId,
  name,
}: {
  tripId: string;
  name: string;
}) {
  const [state, action] = useActionState(deleteTripAction, {});

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="tripId" value={tripId} />
      <FormMessage error={state.error} />
      <div className="grid gap-2">
        <Label htmlFor="confirmName">
          Type <span className="font-semibold">{name}</span> to confirm
        </Label>
        <Input id="confirmName" name="confirmName" autoComplete="off" />
      </div>
      <SubmitButton
        variant="destructive"
        className="justify-self-start"
        pendingText="Deleting…"
      >
        Delete this trip
      </SubmitButton>
    </form>
  );
}
