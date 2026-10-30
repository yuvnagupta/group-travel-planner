"use client";

import { useEffect, useId, useRef } from "react";

import { searchFlightsAction } from "@/app/actions/suggestions";
import { DateRangeField } from "@/components/forms/date-range-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import type { FlightOption } from "@/lib/travel/types";

import { FlightSummary } from "./flight-summary";
import { PlaceInput } from "./place-input";
import { SearchResults } from "./search-results";
import { useCachedSearch } from "./use-cached-search";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

// The last departure this browser searched from, so the trip page can search
// flights for you on load.
const ORIGIN_KEY = "flight-search-origin";

function readOrigin(): { originQuery: string; origin: string } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(ORIGIN_KEY) ?? "null");
    return typeof saved?.origin === "string" ? saved : null;
  } catch {
    return null;
  }
}

type FlightSearchProps = {
  tripId: string;
  defaults: {
    destinationQuery?: string;
    departureDate?: string;
    returnDate?: string;
    adults?: number;
  };
  /** Search the trip's destination and dates as soon as the form loads. */
  prefill?: boolean;
};

export function FlightSearch({ tripId, defaults, prefill }: FlightSearchProps) {
  const { state, pending, mode, search, searchWith, goToPage, refresh } =
    useCachedSearch<FlightOption>(searchFlightsAction);
  const v = state.values;
  const e = state.fieldErrors;
  const id = useId();

  const prefillStarted = useRef(false);
  useEffect(() => {
    if (!prefill || prefillStarted.current) return;
    prefillStarted.current = true;
    searchWith({ tripId, prefill: "1", ...readOrigin() });
  }, [prefill, tripId, searchWith]);

  useEffect(() => {
    if (!state.results || !v?.origin) return;
    try {
      localStorage.setItem(
        ORIGIN_KEY,
        JSON.stringify({ originQuery: v.originQuery, origin: v.origin }),
      );
    } catch {}
  }, [state.results, v?.origin, v?.originQuery]);

  return (
    <div className="grid gap-6">
      <form
        // Remount once the prefilled search resolves the destination, so the
        // fields show the airports and dates it searched.
        key={v?.prefilled ? "prefilled" : "initial"}
        action={search}
        className="grid gap-4 rounded-xl border bg-card p-4 sm:p-6"
        noValidate
      >
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="prefilled" value={v?.prefilled ?? ""} />
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
          <DateRangeField
            className="sm:col-span-2"
            startName="departureDate"
            endName="returnDate"
            startLabel="Depart"
            endLabel="Return (optional)"
            defaultStart={v?.departureDate ?? defaults.departureDate}
            defaultEnd={v?.returnDate ?? defaults.returnDate}
            errors={[...(e?.departureDate ?? []), ...(e?.returnDate ?? [])]}
          />
          <div className="grid gap-2">
            <Label htmlFor={`${id}-adults`}>Travelers</Label>
            <select
              id={`${id}-adults`}
              name="adults"
              defaultValue={v?.adults ?? String(defaults.adults ?? 1)}
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
            <Label htmlFor={`${id}-cabinClass`}>Cabin</Label>
            <select
              id={`${id}-cabinClass`}
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

      {pending && mode === "search" ? (
        <p className="text-muted-foreground" role="status">
          Searching airlines… this can take up to 15 seconds.
        </p>
      ) : (
        state.results && (
          <SearchResults
            tripId={tripId}
            kind="flight"
            results={state.results}
            page={state.page ?? 1}
            pageCount={state.pageCount ?? 1}
            total={state.total ?? state.results.length}
            fetchedAt={state.fetchedAt}
            loading={pending ? mode : null}
            onPage={goToPage}
            onRefresh={refresh}
            renderOption={(flight) => <FlightSummary flight={flight} />}
            emptyText="No flights found. Try different dates or nearby airports."
          />
        )
      )}
    </div>
  );
}
