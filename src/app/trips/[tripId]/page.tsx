import { CalendarDays, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { getTripForMember } from "@/lib/trips";

import { InviteForm } from "./invite-form";

export default function TripPage({ params }: PageProps<"/trips/[tripId]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <Link
        href="/trips"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← My trips
      </Link>
      <Suspense
        fallback={<p className="text-muted-foreground">Loading trip…</p>}
      >
        <TripDetails params={params} />
      </Suspense>
    </div>
  );
}

async function TripDetails({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!z.uuid().safeParse(tripId).success) notFound();

  // Non-members get a 404 so trip ids can't be probed.
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <>
      <title>{`${trip.name} · Group Travel Planner`}</title>
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{trip.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          {trip.destination && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {trip.destination}
            </span>
          )}
          {dates && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden />
              {dates}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Members ({trip.members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {trip.members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <span>
                    @{member.username}
                    {member.id === user.id && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </span>
                  {member.role === "owner" && (
                    <Badge variant="secondary">Owner</Badge>
                  )}
                </li>
              ))}
              {trip.pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between py-2.5 text-muted-foreground"
                >
                  <span>@{invite.username}</span>
                  <Badge variant="outline">Invited</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm tripId={trip.id} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
