"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";

// Dates are ISO strings (YYYY-MM-DD), which compare correctly as strings.
// All arithmetic happens in UTC so DST shifts never skip or repeat a day.

type Month = { year: number; month: number }; // month is 0-11
type Edge = "start" | "end";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoOf = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoOf(d);
};
const daysBetween = (a: string, b: string) =>
  Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
const monthOf = (iso: string): Month => {
  const d = utc(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
};
const addMonths = ({ year, month }: Month, n: number): Month => {
  const d = new Date(Date.UTC(year, month + n, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
};
const monthIndex = ({ year, month }: Month) => year * 12 + month;
const firstOfMonth = ({ year, month }: Month) =>
  isoOf(new Date(Date.UTC(year, month, 1)));
const lastOfMonth = ({ year, month }: Month) =>
  isoOf(new Date(Date.UTC(year, month + 1, 0)));
const todayISO = () => {
  const now = new Date();
  return isoOf(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );
};

/** The day cells of a month, padded with nulls so day 1 lands on its weekday. */
function monthGrid(month: Month) {
  const first = firstOfMonth(month);
  const cells: (string | null)[] = Array(utc(first).getUTCDay()).fill(null);
  for (let d = first; d <= lastOfMonth(month); d = addDays(d, 1)) cells.push(d);
  return cells;
}

type DateRangeFieldProps = {
  startName: string;
  endName: string;
  startLabel?: string;
  endLabel?: string;
  defaultStart?: string;
  defaultEnd?: string;
  errors?: string[];
};

/**
 * A travel-site style date range picker: two fields that share one calendar.
 * Picking a start date moves straight on to the end date, and while choosing
 * the end date every day before the start is disabled.
 */
export function DateRangeField({
  startName,
  endName,
  startLabel = "Start date",
  endLabel = "End date",
  defaultStart,
  defaultEnd,
  errors,
}: DateRangeFieldProps) {
  const id = useId();
  const [start, setStart] = useState<string | null>(defaultStart || null);
  const [end, setEnd] = useState<string | null>(defaultEnd || null);
  const [active, setActive] = useState<Edge | null>(null);
  const [view, setView] = useState<Month>({ year: 2000, month: 0 });
  const [today, setToday] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRefs = {
    start: useRef<HTMLButtonElement>(null),
    end: useRef<HTMLButtonElement>(null),
  };
  const moveFocus = useRef(false);

  const open = active !== null;
  const invalid = Boolean(errors?.length);
  const errorId = `${id}-error`;
  // While picking the end date, nothing before the start can be chosen.
  const minSelectable =
    active === "end" && start && start > today ? start : today;

  function openAt(edge: Edge) {
    const now = todayISO();
    if (!open) {
      setToday(now);
      setView(monthOf((edge === "end" ? end : start) ?? start ?? now));
    }
    setFocused((edge === "end" ? end : start) ?? start ?? null);
    setActive(edge);
  }

  function close(returnFocus = false) {
    if (returnFocus && active) triggerRefs[active].current?.focus();
    setActive(null);
    setHovered(null);
  }

  function select(day: string) {
    if (active === "start" || !start) {
      setStart(day);
      if (end && end < day) setEnd(null);
      setActive("end");
    } else {
      setEnd(day);
      close(true);
    }
    setFocused(day);
  }

  const inField = (node: unknown) =>
    node instanceof Node &&
    (rootRef.current?.contains(node) || panelRef.current?.contains(node));

  const months = [view, addMonths(view, 1)];
  const visibleFrom = firstOfMonth(months[0]);
  const visibleTo = lastOfMonth(months[1]);
  const isVisible = (d: string | null) =>
    !!d && d >= visibleFrom && d <= visibleTo && d >= minSelectable;
  // Exactly one day is in the tab order (roving tabindex).
  const tabbable = isVisible(focused)
    ? focused
    : ([start, end].find(isVisible) ??
      (minSelectable > visibleFrom ? minSelectable : visibleFrom));

  const tabbableButton = () =>
    panelRef.current?.querySelector<HTMLButtonElement>(
      `[data-date="${tabbable}"]`,
    ) ?? null;

  // After keyboard navigation, move DOM focus to the newly focused day.
  // (Opening the calendar is handled by the popup's initialFocus, since the
  // portal isn't mounted yet when this effect first runs.)
  useEffect(() => {
    const button = moveFocus.current && tabbableButton();
    if (!button) return;
    moveFocus.current = false;
    button.focus();
  });

  // While choosing the end date, preview the range up to the hovered day.
  const rangeEnd =
    active === "end" && start && hovered && hovered >= start ? hovered : end;

  function onDayKeyDown(event: React.KeyboardEvent, day: string) {
    const weekday = utc(day).getUTCDay();
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    let next: string | null = null;
    if (event.key in steps) next = addDays(day, steps[event.key]);
    else if (event.key === "PageUp" || event.key === "PageDown") {
      const d = utc(day);
      d.setUTCMonth(d.getUTCMonth() + (event.key === "PageUp" ? -1 : 1));
      next = isoOf(d);
    }
    if (!next) return;
    event.preventDefault();
    if (next < minSelectable) next = minSelectable;
    if (next < visibleFrom) setView(monthOf(next));
    else if (next > visibleTo) setView(addMonths(monthOf(next), -1));
    moveFocus.current = true;
    setFocused(next);
  }

  const canGoBack =
    today !== "" && monthIndex(view) > monthIndex(monthOf(today));
  const nights = start && end ? daysBetween(start, end) : null;

  return (
    <div
      ref={rootRef}
      className="grid gap-2"
      onBlur={(event) => {
        // Tabbing away closes the calendar. A null relatedTarget means focus
        // was lost to a re-render (e.g. paging months), so stay open then.
        if (event.relatedTarget && !inField(event.relatedTarget)) close();
      }}
    >
      <input type="hidden" name={startName} value={start ?? ""} />
      <input type="hidden" name={endName} value={end ?? ""} />

      <div
        ref={anchorRef}
        className={cn(
          "grid grid-cols-2 rounded-lg border border-input dark:bg-input/30",
          invalid && "border-destructive ring-3 ring-destructive/20",
        )}
      >
        {(["start", "end"] as const).map((edge) => {
          const value = edge === "start" ? start : end;
          const label = edge === "start" ? startLabel : endLabel;
          return (
            <button
              key={edge}
              ref={triggerRefs[edge]}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={active === edge}
              aria-label={`${label}: ${value ? longLabel.format(utc(value)) : "not set"}`}
              aria-describedby={invalid ? errorId : undefined}
              onClick={(event) => {
                // detail is 0 for Enter/Space, so keyboard users land in the grid.
                if (event.detail === 0) moveFocus.current = true;
                if (active === edge) close();
                else openAt(edge);
              }}
              className={cn(
                "grid gap-1 px-3 py-2 text-left transition-colors outline-none first:rounded-l-[calc(var(--radius-lg)-1px)] last:rounded-r-[calc(var(--radius-lg)-1px)] last:border-l last:border-input hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                active === edge &&
                  "bg-muted ring-2 ring-ring ring-inset hover:bg-muted",
              )}
            >
              <span className="text-xs font-medium">{label}</span>
              <span
                className={cn(
                  "text-sm",
                  value ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {value ? shortLabel.format(utc(value)) : "Add date"}
              </span>
            </button>
          );
        })}
      </div>

      {invalid && (
        <p id={errorId} className="text-sm text-destructive">
          {errors![0]}
        </p>
      )}

      <Popover.Root
        open={open}
        onOpenChange={(next, { reason, event }) => {
          if (next) return;
          // Presses on (or focus moving to) the date fields themselves are
          // handled by their own click handlers, not treated as dismissals.
          const target =
            event instanceof FocusEvent ? event.relatedTarget : event.target;
          if (reason !== "escape-key" && inField(target)) return;
          close(reason === "escape-key");
        }}
      >
        <Popover.Portal>
          <Popover.Positioner
            anchor={anchorRef}
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={16}
            className="z-50"
          >
            <Popover.Popup
              ref={panelRef}
              initialFocus={() => {
                if (!moveFocus.current) return false;
                moveFocus.current = false;
                return tabbableButton();
              }}
              finalFocus={false}
              aria-label={
                active === "start"
                  ? `Choose ${startLabel.toLowerCase()}`
                  : `Choose ${endLabel.toLowerCase()}`
              }
              className="w-[calc(100vw-2rem)] max-w-sm rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none sm:w-max sm:max-w-none"
            >
              <div className="relative grid gap-6 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Previous month"
                  disabled={!canGoBack}
                  onClick={() => setView(addMonths(view, -1))}
                  className="absolute top-0 left-0"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Next month"
                  onClick={() => setView(addMonths(view, 1))}
                  className="absolute top-0 right-0"
                >
                  <ChevronRight />
                </Button>

                {months.map((month, i) => (
                  <div
                    key={monthIndex(month)}
                    // The second month only fits side by side on wider screens.
                    className={cn(i === 1 && "hidden sm:block")}
                  >
                    <p className="mb-3 flex h-7 items-center justify-center text-sm font-medium">
                      {monthLabel.format(utc(firstOfMonth(month)))}
                    </p>
                    <div
                      role="grid"
                      aria-label={monthLabel.format(utc(firstOfMonth(month)))}
                      className="grid grid-cols-7 gap-y-1"
                      onMouseLeave={() => setHovered(null)}
                    >
                      {WEEKDAYS.map((d) => (
                        <span
                          key={d}
                          className="flex h-8 items-center justify-center text-xs text-muted-foreground"
                        >
                          {d}
                        </span>
                      ))}
                      {monthGrid(month).map((day, j) => {
                        if (!day) return <span key={`pad-${j}`} />;
                        const disabled = day < minSelectable;
                        const isStart = day === start;
                        const isEnd = day === rangeEnd;
                        const inRange =
                          !!start &&
                          !!rangeEnd &&
                          day >= start &&
                          day <= rangeEnd;
                        const column = j % 7;
                        return (
                          <div
                            key={day}
                            className={cn(
                              "flex justify-center",
                              inRange && start !== rangeEnd && "bg-muted",
                              inRange &&
                                (isStart || column === 0) &&
                                "rounded-l-full",
                              inRange &&
                                (isEnd || column === 6) &&
                                "rounded-r-full",
                            )}
                          >
                            <button
                              type="button"
                              data-date={day}
                              tabIndex={day === tabbable ? 0 : -1}
                              disabled={disabled}
                              aria-pressed={isStart || day === end}
                              aria-label={longLabel.format(utc(day))}
                              onClick={() => select(day)}
                              onMouseEnter={() => setHovered(day)}
                              onFocus={() => setFocused(day)}
                              onKeyDown={(event) => onDayKeyDown(event, day)}
                              className={cn(
                                "relative flex size-9 items-center justify-center rounded-full text-sm outline-none hover:ring-1 hover:ring-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:text-muted-foreground/40 disabled:line-through",
                                (isStart || isEnd) &&
                                  "bg-primary font-medium text-primary-foreground hover:ring-0",
                                day === today &&
                                  "after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-current",
                              )}
                            >
                              {Number(day.slice(8))}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-t pt-3">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {nights !== null
                    ? nights === 0
                      ? "Day trip"
                      : `${nights} night${nights === 1 ? "" : "s"}`
                    : active === "start"
                      ? `Select ${startLabel.toLowerCase()}`
                      : `Select ${endLabel.toLowerCase()}`}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!start && !end}
                    onClick={() => {
                      setStart(null);
                      setEnd(null);
                      setActive("start");
                      triggerRefs.start.current?.focus();
                    }}
                  >
                    Clear dates
                  </Button>
                  <Button type="button" size="sm" onClick={() => close(true)}>
                    Done
                  </Button>
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
