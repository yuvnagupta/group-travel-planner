import { Plane } from "lucide-react";

import {
  formatDuration,
  formatLocalDate,
  formatLocalTime,
  formatMoney,
} from "@/lib/format";
import type { FlightOption } from "@/lib/travel/types";

const cabinLabels: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First",
};

export function FlightSummary({ flight }: { flight: FlightOption }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex min-w-40 items-center gap-3">
        {flight.airline.logoUrl ? (
          // Airline logos come from Duffel's CDN as small SVGs; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={flight.airline.logoUrl}
            alt=""
            className="size-8 shrink-0"
          />
        ) : (
          <Plane
            className="size-6 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <div>
          <p className="font-medium">{flight.airline.name}</p>
          <p className="text-xs text-muted-foreground">
            {[
              flight.cabinClass && cabinLabels[flight.cabinClass],
              `${flight.passengers} traveler${flight.passengers > 1 ? "s" : ""}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <ul className="grid flex-1 gap-3">
        {flight.slices.map((slice, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3"
          >
            <div className="text-right">
              <p className="font-medium tabular-nums">
                {formatLocalTime(slice.departingAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                {slice.origin.code}
              </p>
            </div>
            <div className="flex flex-col items-center text-xs text-muted-foreground">
              <span>{formatDuration(slice.duration)}</span>
              <span className="my-1 h-px w-full bg-border" aria-hidden />
              <span>
                {slice.stops === 0
                  ? "Nonstop"
                  : `${slice.stops} stop${slice.stops > 1 ? "s" : ""}`}{" "}
                · {formatLocalDate(slice.departingAt)}
              </span>
            </div>
            <div>
              <p className="font-medium tabular-nums">
                {formatLocalTime(slice.arrivingAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                {slice.destination.code}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-lg font-semibold tabular-nums sm:min-w-28 sm:text-right">
        {formatMoney(flight.totalAmount, flight.totalCurrency)}
      </p>
    </div>
  );
}
