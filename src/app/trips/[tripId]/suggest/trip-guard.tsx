import { notFound } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { getTripForMember } from "@/lib/trips";

/** Loads the trip for the signed-in member, or 404s. */
export async function loadTripForSuggest(params: Promise<{ tripId: string }>) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!z.uuid().safeParse(tripId).success) notFound();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();
  return trip;
}
