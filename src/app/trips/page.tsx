import { CalendarDays, MapPin, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { respondInvite } from "@/app/actions/trips";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { getPendingInvitesForUser, getTripsForUser } from "@/lib/trips";

export const metadata: Metadata = { title: "My trips" };

export default function TripsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">My trips</h1>
        <Link href="/trips/new" className={buttonVariants()}>
          <Plus aria-hidden />
          New trip
        </Link>
      </div>
      <Suspense
        fallback={<p className="text-muted-foreground">Loading your trips…</p>}
      >
        <Dashboard />
      </Suspense>
    </div>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const [invites, trips] = await Promise.all([
    getPendingInvitesForUser(user.id),
    getTripsForUser(user.id),
  ]);

  return (
    <>
      {invites.length > 0 && (
        <section className="grid gap-3" aria-labelledby="invites-heading">
          <h2 id="invites-heading" className="text-lg font-medium">
            Invites
          </h2>
          <ul className="grid gap-3">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
              >
                <div>
                  <p className="font-medium">{invite.tripName}</p>
                  <p className="text-sm text-muted-foreground">
                    @{invite.inviterUsername} invited you
                    {invite.destination ? ` · ${invite.destination}` : ""}
                  </p>
                </div>
                <form action={respondInvite} className="flex gap-2">
                  <input type="hidden" name="inviteId" value={invite.id} />
                  <Button
                    type="submit"
                    name="response"
                    value="decline"
                    variant="outline"
                    size="sm"
                  >
                    Decline
                  </Button>
                  <Button
                    type="submit"
                    name="response"
                    value="accept"
                    size="sm"
                  >
                    Accept
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3" aria-label="Trips">
        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">No trips yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a trip and invite your group, or accept an invite to join
              one.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => {
              const dates = formatDateRange(trip.startDate, trip.endDate);
              return (
                <li key={trip.id}>
                  <Link
                    href={`/trips/${trip.id}`}
                    className="block h-full rounded-xl focus-visible:outline-none"
                  >
                    <Card className="h-full transition-colors hover:bg-muted/50">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle>{trip.name}</CardTitle>
                          {trip.role === "owner" && (
                            <Badge variant="secondary">Owner</Badge>
                          )}
                        </div>
                        <CardDescription className="grid gap-1">
                          {trip.destination && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3.5" aria-hidden />
                              {trip.destination}
                            </span>
                          )}
                          {dates && (
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="size-3.5" aria-hidden />
                              {dates}
                            </span>
                          )}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
