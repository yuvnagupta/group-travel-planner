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

export function formatMoney(amount: string, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency}`;
  }
}

/** "PT7H25M" → "7h 25m". */
export function formatDuration(iso: string | null) {
  const m = iso?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  const hours = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0);
  const minutes = Number(m[3] ?? 0);
  return (
    [hours && `${hours}h`, minutes && `${minutes}m`]
      .filter(Boolean)
      .join(" ") || null
  );
}

// Flight times from Duffel are local to each airport and carry no offset, so
// format them as-is instead of converting to the viewer's time zone.
const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});
const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function asUtc(localIso: string) {
  return new Date(`${localIso.slice(0, 19)}Z`);
}

export function formatLocalTime(localIso: string) {
  return timeFormat.format(asUtc(localIso));
}

export function formatLocalDate(localIso: string) {
  return shortDateFormat.format(asUtc(localIso));
}

export function formatRelative(date: Date) {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size)
      return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
