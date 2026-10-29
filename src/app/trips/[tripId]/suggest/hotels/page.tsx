import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { HotelSearch } from "@/components/travel/hotel-search";

import { loadTripForSuggest } from "../trip-guard";

export const metadata: Metadata = { title: "Suggest a hotel" };

export default function SuggestHotelPage({
  params,
}: PageProps<"/trips/[tripId]/suggest/hotels">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ tripId: string }> }) {
  const trip = await loadTripForSuggest(params);
  return (
    <>
      <div className="grid gap-2">
        <Link
          href={`/trips/${trip.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {trip.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          Suggest a hotel
        </h1>
        <p className="text-muted-foreground">
          Search, then suggest the options you like. Everyone on the trip can
          vote and comment.
        </p>
      </div>
      <HotelSearch
        tripId={trip.id}
        defaults={{
          placeQuery: trip.destination ?? undefined,
          checkInDate: trip.startDate ?? undefined,
          checkOutDate: trip.endDate ?? undefined,
        }}
      />
    </>
  );
}
