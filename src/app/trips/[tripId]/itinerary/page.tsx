import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { daysBetween, formatDateRange } from "@/lib/format";
import { getItineraryForMember } from "@/lib/itinerary";
import { getTripForMember } from "@/lib/trips";

import { ItineraryBoard } from "./itinerary-board";

export const metadata: Metadata = { title: "Itinerary" };

export default function ItineraryPage({
  params,
}: PageProps<"/trips/[tripId]/itinerary">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense
        fallback={<p className="text-muted-foreground">Loading itinerary…</p>}
      >
        <Itinerary params={params} />
      </Suspense>
    </div>
  );
}

async function Itinerary({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!z.uuid().safeParse(tripId).success) notFound();

  const [trip, items] = await Promise.all([
    getTripForMember(tripId, user.id),
    getItineraryForMember(tripId, user.id),
  ]);
  if (!trip || !items) notFound();

  const days =
    trip.startDate && trip.endDate
      ? daysBetween(trip.startDate, trip.endDate)
      : [];

  return (
    <>
      <div className="grid gap-2">
        <Link
          href={`/trips/${trip.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {trip.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Itinerary</h1>
        <p className="text-muted-foreground">
          {days.length > 0
            ? `${formatDateRange(trip.startDate, trip.endDate)} · ${days.length} day${days.length > 1 ? "s" : ""}. Drag to reorder or move between days.`
            : "This trip has no dates yet. Add ideas below, then set the trip's dates to plan them day by day."}
        </p>
      </div>
      <ItineraryBoard tripId={trip.id} days={days} items={items} />
    </>
  );
}
