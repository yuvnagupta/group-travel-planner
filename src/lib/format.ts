const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats ISO dates (YYYY-MM-DD) as a readable range, e.g. "Jun 3, 2027 – Jun 10, 2027". */
export function formatDateRange(start: string | null, end: string | null) {
  const fmt = (d: string) => dateFormat.format(new Date(`${d}T00:00:00Z`));
  if (start && end)
    return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Until ${fmt(end)}`;
  return null;
}

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** Formats a timestamp as a short day, e.g. "Oct 29". */
export function formatDay(date: Date) {
  return dayFormat.format(date);
}
