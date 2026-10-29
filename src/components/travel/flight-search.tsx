"use client";

import { useActionState } from "react";

import {
  searchFlightsAction,
  type SearchState,
} from "@/app/actions/suggestions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import type { FlightOption } from "@/lib/travel/types";

import { FlightSummary } from "./flight-summary";
import { PlaceInput } from "./place-input";
import { SearchResults } from "./search-results";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type FlightSearchProps = {
  tripId: string;
  defaults: {
    destinationQuery?: string;
    departureDate?: string;
    returnDate?: string;
  };
};

export function FlightSearch({ tripId, defaults }: FlightSearchProps) {
  const [state, action, pending] = useActionState<
    SearchState<FlightOption>,
    FormData
  >(searchFlightsAction, {});
  const v = state.values;
  const e = state.fieldErrors;

  return (
    <div className="grid gap-8">
      <form
        action={action}
        className="grid gap-4 rounded-xl border bg-card p-4 sm:p-6"
        noValidate
      >
        <input type="hidden" name="tripId" value={tripId} />
        <FormMessage error={state.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceInput
            label="From"
            placeholder="City or airport"
            submit={{ mode: "code", name: "origin" }}
            defaultQuery={v?.originQuery}
            defaultValue={{ code: v?.origin }}
            errors={e?.origin}
          />
          <PlaceInput
            label="To"
            placeholder="City or airport"
            submit={{ mode: "code", name: "destination" }}
            defaultQuery={v?.destinationQuery ?? defaults.destinationQuery}
            defaultValue={{ code: v?.destination }}
            errors={e?.destination}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field
            name="departureDate"
            label="Depart"
            type="date"
            defaultValue={v?.departureDate ?? defaults.departureDate}
            errors={e?.departureDate}
          />
          <Field
            name="returnDate"
            label="Return (optional)"
            type="date"
            defaultValue={v?.returnDate ?? defaults.returnDate}
            errors={e?.returnDate}
          />
          <div className="grid gap-2">
            <Label htmlFor="adults">Travelers</Label>
            <select
              id="adults"
              name="adults"
              defaultValue={v?.adults ?? "1"}
              className={selectClass}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} adult{i ? "s" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cabinClass">Cabin</Label>
            <select
              id="cabinClass"
              name="cabinClass"
              defaultValue={v?.cabinClass ?? "economy"}
              className={selectClass}
            >
              <option value="economy">Economy</option>
              <option value="premium_economy">Premium economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </div>
        </div>
        <SubmitButton
          className="sm:justify-self-start"
          pendingText="Searching…"
        >
          Search flights
        </SubmitButton>
      </form>

      {pending ? (
        <p className="text-muted-foreground" role="status">
          Searching airlines… this can take up to 15 seconds.
        </p>
      ) : (
        state.results && (
          <SearchResults
            tripId={tripId}
            kind="flight"
            results={state.results}
            renderOption={(flight) => <FlightSummary flight={flight} />}
            emptyText="No flights found. Try different dates or nearby airports."
          />
        )
      )}
    </div>
  );
}
