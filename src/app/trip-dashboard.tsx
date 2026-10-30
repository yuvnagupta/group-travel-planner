import {
  ArrowRight,
  CalendarDays,
  Mail,
  MapPin,
  Plus,
  Route,
  Users,
  Vote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { User } from "@/lib/auth";
import { getTripSummariesForUser, type TripSummary } from "@/lib/dashboard";
import { formatDateRange } from "@/lib/format";
import { formatCents } from "@/lib/splits";
import { getPendingInvitesForUser } from "@/lib/trips";

/** The signed-in home page: trips still being planned, with shortcuts into each. */
export async function TripDashboard({ user }: { user: User }) {
  const [trips, invites] = await Promise.all([
    getTripSummariesForUser(user.id),
    getPendingInvitesForUser(user.id),
  ]);

  // ISO dates compare as strings. A trip is current until its end date passes.
  const today = new Date().toISOString().slice(0, 10);
  const current = trips
    .filter((t) => !t.endDate || t.endDate >= today)
    // Soonest first; trips without dates yet go last.
    .sort((a, b) =>
      (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"),
    );
  const pastCount = trips.length - current.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back, @{user.username}
          </h1>
          <p className="text-muted-foreground">
            {current.length === 0
              ? "You have no trips in the works."
              : `You're planning ${current.length} ${current.length === 1 ? "trip" : "trips"}.`}
          </p>
        </div>
        <Link href="/trips/new" className={buttonVariants()}>
          <Plus aria-hidden />
          New trip
        </Link>
      </div>

      {invites.length > 0 && (
        <Link
          href="/trips"
          className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
        >
          <span className="flex items-center gap-3">
            <Mail className="size-5 text-muted-foreground" aria-hidden />
            <span>
              <span className="font-medium">
                {invites.length} trip{" "}
                {invites.length === 1 ? "invite" : "invites"}
              </span>{" "}
              <span className="text-muted-foreground">waiting on you</span>
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <section className="grid gap-4" aria-labelledby="current-trips-heading">
        <h2
          id="current-trips-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Trips in progress
        </h2>
        {current.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">Nothing planned yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a trip and invite your group, or accept an invite to join
              one.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4">
            {current.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} today={today} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {pastCount > 0 && (
        <Link
          href="/trips"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          See all trips, including {pastCount} past{" "}
          {pastCount === 1 ? "trip" : "trips"} →
        </Link>
      )}
    </div>
  );
}

function TripCard({ trip, today }: { trip: TripSummary; today: string }) {
  const tripHref = `/trips/${trip.id}`;
  const dates = formatDateRange(trip.startDate, trip.endDate);
  const status = tripStatus(trip, today);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">
          <Link href={tripHref} className="hover:underline">
            {trip.name}
          </Link>
        </CardTitle>
        <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
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
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            {trip.memberCount} {trip.memberCount === 1 ? "member" : "members"}
          </span>
        </CardDescription>
        <CardAction className="flex gap-1.5">
          {status && <Badge variant="outline">{status}</Badge>}
          {trip.role === "owner" && <Badge variant="secondary">Owner</Badge>}
        </CardAction>
      </CardHeader>
      <CardContent>
        <nav
          aria-label={`${trip.name} shortcuts`}
          className="grid gap-2 sm:grid-cols-3"
        >
          <QuickLink
            href={`${tripHref}/suggest/flights`}
            icon={Route}
            label="Build itinerary"
            detail="Find flights and hotels"
          />
          <QuickLink
            href={`${tripHref}#flights`}
            icon={Vote}
            label="Group decisions"
            detail={decisionsDetail(trip)}
          />
          <QuickLink
            href={`${tripHref}#expenses`}
            icon={Wallet}
            label="Expenses"
            detail={expensesDetail(trip)}
          />
        </nav>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  detail,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="grid gap-1 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </Link>
  );
}

function tripStatus(trip: TripSummary, today: string) {
  if (!trip.startDate) return null;
  if (trip.startDate <= today) return "Happening now";
  const days = Math.round(
    (Date.parse(trip.startDate) - Date.parse(today)) / 86_400_000,
  );
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

function decisionsDetail(trip: TripSummary) {
  if (trip.suggestionCount === 0) return "Nothing suggested yet";
  const options = `${trip.suggestionCount} ${trip.suggestionCount === 1 ? "option" : "options"}`;
  return trip.awaitingVoteCount > 0
    ? `${options} · ${trip.awaitingVoteCount} need your vote`
    : `${options} · all voted`;
}

function expensesDetail(trip: TripSummary) {
  if (trip.spentCents === 0) return "No expenses yet";
  const spent = `${formatCents(trip.spentCents)} spent`;
  if (trip.netCents > 0)
    return `${spent} · you're owed ${formatCents(trip.netCents)}`;
  if (trip.netCents < 0)
    return `${spent} · you owe ${formatCents(-trip.netCents)}`;
  return `${spent} · you're settled`;
}
