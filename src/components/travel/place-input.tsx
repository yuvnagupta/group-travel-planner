"use client";

import { Building2, Plane } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPlace } from "@/lib/format";
import type { Place } from "@/lib/travel/types";

type PlaceInputProps = {
  label: string;
  placeholder?: string;
  /**
   * "code" submits `name` as an IATA code; "coords" submits `latitude` and `longitude`,
   * plus `placeCode` for places Duffel has no coordinates for (e.g. some cities).
   */
  submit: { mode: "code"; name: string } | { mode: "coords" };
  /** Only offer cities (for hotel search, where airports aren't useful). */
  citiesOnly?: boolean;
  defaultQuery?: string;
  defaultValue?: { code?: string; latitude?: string; longitude?: string };
  errors?: string[];
};

export function PlaceInput({
  label,
  placeholder,
  submit,
  citiesOnly,
  defaultQuery = "",
  defaultValue,
  errors,
}: PlaceInputProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState(defaultQuery);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState(defaultValue ?? {});
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Skip the first lookup when the field starts with a picked place; a prefilled name
  // with nothing picked (e.g. the trip's destination) still loads matches to choose from.
  const skipNextFetch = useRef(
    Boolean(defaultValue?.code || defaultValue?.latitude),
  );

  useEffect(() => {
    // Don't search for the text we just filled in from a pick (or from the initial value).
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Couldn't load places.");
        const results: Place[] = citiesOnly
          ? json.places.filter(
              (p: Place) => p.type === "city" || p.latitude !== null,
            )
          : json.places;
        setPlaces(results);
        setActive(0);
        setOpen(document.activeElement === inputRef.current);
        setLoadError(null);
      } catch (error) {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error ? error.message : "Couldn't load places.",
          );
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, citiesOnly]);

  function pick(place: Place) {
    skipNextFetch.current = true;
    setQuery(formatPlace(place));
    setSelected({
      code: place.iataCode,
      latitude: place.latitude?.toString(),
      longitude: place.longitude?.toString(),
    });
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || places.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % places.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + places.length) % places.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(places[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const invalid = Boolean(errors?.length);
  const errorId = `${id}-error`;

  return (
    <div className="relative grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && places[active] ? `${listId}-${active}` : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        autoComplete="off"
        placeholder={placeholder}
        // Saved so the typed text survives a search round trip.
        name={submit.mode === "code" ? `${submit.name}Query` : "placeQuery"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected({});
          if (e.target.value.trim().length < 2) setPlaces([]);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => places.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {submit.mode === "code" ? (
        <input type="hidden" name={submit.name} value={selected.code ?? ""} />
      ) : (
        <>
          <input
            type="hidden"
            name="latitude"
            value={selected.latitude ?? ""}
          />
          <input
            type="hidden"
            name="longitude"
            value={selected.longitude ?? ""}
          />
          <input type="hidden" name="placeCode" value={selected.code ?? ""} />
        </>
      )}

      {open && places.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {places.map((place, i) => (
            <li
              key={`${place.type}-${place.iataCode}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(place)}
              onMouseEnter={() => setActive(i)}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-muted"
            >
              {place.type === "airport" ? (
                <Plane
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : (
                <Building2
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              )}
              <span className="truncate">{formatPlace(place)}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {place.type === "airport"
                  ? "Airport"
                  : citiesOnly
                    ? "City"
                    : "All airports"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      {invalid && (
        <p id={errorId} className="text-sm text-destructive">
          {errors![0]}
        </p>
      )}
    </div>
  );
}
