"use client";

import { useActionState } from "react";

import {
  searchHotelsAction,
  type SearchState,
} from "@/app/actions/suggestions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import type { HotelOption } from "@/lib/travel/types";

import { HotelSummary } from "./hotel-summary";
import { PlaceInput } from "./place-input";
import { SearchResults } from "./search-results";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type HotelSearchProps = {
  tripId: string;
  defaults: {
    placeQuery?: string;
    checkInDate?: string;
    checkOutDate?: string;
  };
};

export function HotelSearch({ tripId, defaults }: HotelSearchProps) {
  const [state, action, pending] = useActionState<
    SearchState<HotelOption>,
    FormData
  >(searchHotelsAction, {});
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
        <PlaceInput
          label="Where"
          placeholder="City"
          citiesOnly
          submit={{ mode: "coords" }}
          defaultQuery={v?.placeQuery ?? defaults.placeQuery}
          defaultValue={{ latitude: v?.latitude, longitude: v?.longitude }}
          errors={e?.latitude ?? e?.longitude}
        />
        <div className="grid gap-4 sm:grid-cols-4">
          <Field
            name="checkInDate"
            label="Check in"
            type="date"
            defaultValue={v?.checkInDate ?? defaults.checkInDate}
            errors={e?.checkInDate}
          />
          <Field
            name="checkOutDate"
            label="Check out"
            type="date"
            defaultValue={v?.checkOutDate ?? defaults.checkOutDate}
            errors={e?.checkOutDate}
          />
          <div className="grid gap-2">
            <Label htmlFor="adults">Guests</Label>
            <select
              id="adults"
              name="adults"
              defaultValue={v?.adults ?? "2"}
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
            <Label htmlFor="rooms">Rooms</Label>
            <select
              id="rooms"
              name="rooms"
              defaultValue={v?.rooms ?? "1"}
              className={selectClass}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} room{i ? "s" : ""}
                </option>
              ))}
            </select>
            {e?.rooms && (
              <p className="text-sm text-destructive">{e.rooms[0]}</p>
            )}
          </div>
        </div>
        <SubmitButton
          className="sm:justify-self-start"
          pendingText="Searching…"
        >
          Search hotels
        </SubmitButton>
      </form>

      {pending ? (
        <p className="text-muted-foreground" role="status">
          Searching hotels…
        </p>
      ) : (
        state.results && (
          <SearchResults
            tripId={tripId}
            kind="hotel"
            results={state.results}
            renderOption={(hotel) => <HotelSummary hotel={hotel} />}
            emptyText="No hotels found. Try different dates or a nearby city."
          />
        )
      )}
    </div>
  );
}
