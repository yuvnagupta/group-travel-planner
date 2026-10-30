"use client";

import { useEffect, useId, useRef } from "react";

import { searchHotelsAction } from "@/app/actions/suggestions";
import { DateRangeField } from "@/components/forms/date-range-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import type { HotelOption } from "@/lib/travel/types";

import { HotelSummary } from "./hotel-summary";
import { PlaceInput } from "./place-input";
import { SearchResults } from "./search-results";
import { useCachedSearch } from "./use-cached-search";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type HotelSearchProps = {
  tripId: string;
  defaults: {
    placeQuery?: string;
    checkInDate?: string;
    checkOutDate?: string;
    adults?: number;
  };
  /** Search the trip's destination and dates as soon as the form loads. */
  prefill?: boolean;
};

export function HotelSearch({ tripId, defaults, prefill }: HotelSearchProps) {
  const { state, pending, mode, search, searchWith, goToPage, refresh } =
    useCachedSearch<HotelOption>(searchHotelsAction);
  const v = state.values;
  const e = state.fieldErrors;
  const id = useId();

  const prefillStarted = useRef(false);
  useEffect(() => {
    if (!prefill || prefillStarted.current) return;
    prefillStarted.current = true;
    searchWith({ tripId, prefill: "1" });
  }, [prefill, tripId, searchWith]);

  return (
    <div className="grid gap-6">
      <form
        // Remount once the prefilled search resolves the destination, so the
        // fields show the place and dates it searched.
        key={v?.prefilled ? "prefilled" : "initial"}
        action={search}
        className="grid gap-4 rounded-xl border bg-card p-4 sm:p-6"
        noValidate
      >
        <input type="hidden" name="tripId" value={tripId} />
        <input type="hidden" name="prefilled" value={v?.prefilled ?? ""} />
        <FormMessage error={state.error} />
        <PlaceInput
          label="Where"
          placeholder="City"
          citiesOnly
          submit={{ mode: "coords" }}
          defaultQuery={v?.placeQuery ?? defaults.placeQuery}
          defaultValue={{
            code: v?.placeCode,
            latitude: v?.latitude,
            longitude: v?.longitude,
          }}
          errors={e?.latitude ?? e?.longitude}
        />
        <div className="grid gap-4 sm:grid-cols-4">
          <DateRangeField
            className="sm:col-span-2"
            startName="checkInDate"
            endName="checkOutDate"
            startLabel="Check in"
            endLabel="Check out"
            minNights={1}
            defaultStart={v?.checkInDate ?? defaults.checkInDate}
            defaultEnd={v?.checkOutDate ?? defaults.checkOutDate}
            errors={[...(e?.checkInDate ?? []), ...(e?.checkOutDate ?? [])]}
          />
          <div className="grid gap-2">
            <Label htmlFor={`${id}-adults`}>Guests</Label>
            <select
              id={`${id}-adults`}
              name="adults"
              defaultValue={v?.adults ?? String(defaults.adults ?? 2)}
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
            <Label htmlFor={`${id}-rooms`}>Rooms</Label>
            <select
              id={`${id}-rooms`}
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

      {pending && mode === "search" ? (
        <p className="text-muted-foreground" role="status">
          {v || !defaults.placeQuery
            ? "Searching hotels…"
            : `Finding hotels in ${defaults.placeQuery}…`}
        </p>
      ) : (
        state.results && (
          <SearchResults
            tripId={tripId}
            kind="hotel"
            results={state.results}
            page={state.page ?? 1}
            pageCount={state.pageCount ?? 1}
            total={state.total ?? state.results.length}
            fetchedAt={state.fetchedAt}
            loading={pending ? mode : null}
            onPage={goToPage}
            onRefresh={refresh}
            renderOption={(hotel) => <HotelSummary hotel={hotel} />}
            emptyText="No hotels found. Try different dates or a nearby city."
          />
        )
      )}
    </div>
  );
}
