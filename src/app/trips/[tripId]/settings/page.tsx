import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  cancelInviteAction,
  leaveTripAction,
  removeMemberAction,
  transferOwnershipAction,
} from "@/app/actions/trip-settings";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { getTripForMember } from "@/lib/trips";

import { ConfirmAction } from "./confirm-action";
import { DeleteTripForm } from "./delete-trip-form";
import { EditTripForm } from "./edit-trip-form";

export const metadata: Metadata = { title: "Trip settings" };

export default function TripSettingsPage({
  params,
}: PageProps<"/trips/[tripId]/settings">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense
        fallback={<p className="text-muted-foreground">Loading settings…</p>}
      >
        <Settings params={params} />
      </Suspense>
    </div>
  );
}

async function Settings({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await requireUser();
  if (!z.uuid().safeParse(tripId).success) notFound();
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const isOwner = trip.ownerId === user.id;
  const others = trip.members.filter((m) => m.id !== user.id);

  return (
    <>
      <div className="grid gap-2">
        <Link
          href={`/trips/${trip.id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {trip.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Trip settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          {!isOwner && (
            <CardDescription>
              Only the trip&apos;s owner can change these.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <EditTripForm trip={trip} />
          ) : (
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd>{trip.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Destination</dt>
                <dd>{trip.destination ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dates</dt>
                <dd>
                  {formatDateRange(trip.startDate, trip.endDate) ?? "Not set"}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({trip.members.length})</CardTitle>
          <CardDescription>
            People who leave or are removed lose their votes. Their suggestions,
            comments and expenses stay so the group&apos;s plans and balances
            don&apos;t change.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {trip.members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <span className="flex items-center gap-2">
                  @{member.username}
                  {member.id === user.id && (
                    <span className="text-muted-foreground">(you)</span>
                  )}
                  {member.role === "owner" && (
                    <Badge variant="secondary">Owner</Badge>
                  )}
                </span>
                {isOwner && member.id !== user.id && (
                  <div className="flex flex-wrap justify-end gap-1">
                    <ConfirmAction
                      action={transferOwnershipAction}
                      fields={{ tripId: trip.id, userId: member.id }}
                      label="Make owner"
                      question={`Make @${member.username} the owner? You'll become a member.`}
                      confirmLabel="Make owner"
                      pendingText="Saving…"
                    />
                    <ConfirmAction
                      action={removeMemberAction}
                      fields={{ tripId: trip.id, userId: member.id }}
                      label="Remove"
                      question={`Remove @${member.username}?`}
                      confirmLabel="Remove"
                      pendingText="Removing…"
                      destructive
                    />
                  </div>
                )}
              </li>
            ))}
            {trip.pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-muted-foreground"
              >
                <span className="flex items-center gap-2">
                  @{invite.username}
                  <Badge variant="outline">Invited</Badge>
                </span>
                {(isOwner || invite.inviterId === user.id) && (
                  <ConfirmAction
                    action={cancelInviteAction}
                    fields={{ inviteId: invite.id }}
                    label="Cancel invite"
                    question={`Cancel @${invite.username}'s invite?`}
                    confirmLabel="Cancel invite"
                    pendingText="Cancelling…"
                    destructive
                  />
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Delete trip</CardTitle>
            <CardDescription>
              Deletes the trip for everyone, with all its suggestions, votes,
              comments and expenses. This can&apos;t be undone.
              {others.length > 0 &&
                " To leave but keep the trip for the group, make someone else the owner first."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteTripForm tripId={trip.id} name={trip.name} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Leave trip</CardTitle>
            <CardDescription>
              You&apos;ll lose access until someone invites you again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-start">
            <ConfirmAction
              action={leaveTripAction}
              fields={{ tripId: trip.id }}
              label="Leave this trip"
              question="Leave this trip?"
              confirmLabel="Leave"
              pendingText="Leaving…"
              destructive
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
