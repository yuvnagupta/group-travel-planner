import { BedDouble, Star } from "lucide-react";

import { formatDateRange, formatMoney } from "@/lib/format";
import type { HotelOption } from "@/lib/travel/types";

export function HotelSummary({ hotel }: { hotel: HotelOption }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {hotel.photoUrl ? (
        // Hotel photos are third-party URLs from LiteAPI; plain <img> avoids configuring remote image hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hotel.photoUrl}
          alt=""
          loading="lazy"
          className="aspect-[4/3] w-full rounded-lg object-cover sm:w-36"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-muted sm:w-36">
          <BedDouble className="size-8 text-muted-foreground" aria-hidden />
        </div>
      )}

      <div className="grid flex-1 gap-1">
        <p className="font-medium">{hotel.name}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {hotel.rating ? (
            <span
              className="flex items-center gap-0.5"
              aria-label={`${hotel.rating} star hotel`}
            >
              {Array.from({ length: hotel.rating }, (_, i) => (
                <Star key={i} className="size-3.5 fill-current" aria-hidden />
              ))}
            </span>
          ) : null}
          {hotel.reviewScore ? (
            <span>{hotel.reviewScore.toFixed(1)}/10 reviews</span>
          ) : null}
        </div>
        {hotel.address && (
          <p className="text-sm text-muted-foreground">{hotel.address}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDateRange(hotel.checkInDate, hotel.checkOutDate)} ·{" "}
          {hotel.guests} guest{hotel.guests > 1 ? "s" : ""} · {hotel.rooms} room
          {hotel.rooms > 1 ? "s" : ""}
        </p>
      </div>

      <div className="sm:min-w-28 sm:text-right">
        <p className="text-lg font-semibold tabular-nums">
          {formatMoney(hotel.totalAmount, hotel.totalCurrency)}
        </p>
        <p className="text-xs text-muted-foreground">total stay</p>
      </div>
    </div>
  );
}
