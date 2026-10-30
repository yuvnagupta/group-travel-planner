import { CalendarDays, MapPin, Pencil } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { SuggestionsSection } from "@/components/suggestions/suggestions-section";
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
import { requireUser } from "@/lib/auth";
import {
  balancesOf,
  getExpensesForMember,
  usernamesOf,
  type TripExpense,
} from "@/lib/expenses";
import { formatDateRange, formatDay } from "@/lib/format";
import { SPLIT_LABELS, formatCents } from "@/lib/splits";
import { getSuggestionsForTrip } from "@/lib/suggestions";
import { getTripForMember } from "@/lib/trips";

import { DeleteExpenseButton } from "./delete-expense-button";
import { ExpenseForm } from "./expense-form";
import { InviteForm } from "./invite-form";
import { ScrollToHash } from "./scroll-to-hash";

export default function TripPage({
  params,
  searchParams,
}: PageProps<"/trips/[tripId]">) {
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
        <TripDetails params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TripDetails({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tripId } = await params;
  const { edit } = await searchParams;
  const user = await requireUser();
  if (!z.uuid().safeParse(tripId).success) notFound();

  // Non-members get a 404 so trip ids can't be probed.
  const trip = await getTripForMember(tripId, user.id);
  if (!trip) notFound();

  const suggestions = await getSuggestionsForTrip(trip.id, user.id);
  const dates = formatDateRange(trip.startDate, trip.endDate);
  const expenses = (await getExpensesForMember(trip.id, user.id)) ?? [];
  const balances = balancesOf(expenses);

  // Expenses can name people who are no longer on the trip; look them up too.
  const names = new Map(trip.members.map((m) => [m.id, m.username]));
  const missing = [...balances.keys()].filter((id) => !names.has(id));
  for (const [id, username] of await usernamesOf(missing))
    names.set(id, username);
  const nameOf = (id: string) => `@${names.get(id) ?? "unknown"}`;

  // `?edit=<id>` turns the form into an editor for one of your own expenses.
  const editing = expenses.find(
    (e) => e.id === edit && e.createdById === user.id,
  );
  const tripHref = `/trips/${trip.id}`;

  return (
    <>
      <title>{`${trip.name} · Group Travel Planner`}</title>
      <ScrollToHash />
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

      <SuggestionsSection
        id="flights"
        title="Flights"
        addLabel="Suggest a flight"
        addHref={`/trips/${trip.id}/suggest/flights`}
        emptyText="No flights suggested yet. Search for one and suggest it to the group."
        suggestions={suggestions.filter((s) => s.kind === "flight")}
        userId={user.id}
      />
      <SuggestionsSection
        id="hotels"
        title="Hotels"
        addLabel="Suggest a hotel"
        addHref={`/trips/${trip.id}/suggest/hotels`}
        emptyText="No hotels suggested yet. Search for one and suggest it to the group."
        suggestions={suggestions.filter((s) => s.kind === "hotel")}
        userId={user.id}
      />

      <section
        id="expenses"
        aria-labelledby="expenses-heading"
        className="grid scroll-mt-20 gap-4"
      >
        <h2
          id="expenses-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Expenses
        </h2>
        <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          <div className="grid h-fit gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Balances</CardTitle>
                <CardDescription>
                  {formatCents(
                    expenses.reduce((sum, e) => sum + e.amountCents, 0),
                  )}{" "}
                  spent across {expenses.length}{" "}
                  {expenses.length === 1 ? "expense" : "expenses"}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BalancesTable
                  rows={[...trip.members.map((m) => m.id), ...missing].map(
                    (id) => ({
                      id,
                      name: nameOf(id),
                      isYou: id === user.id,
                      ...(balances.get(id) ?? { paidCents: 0, owedCents: 0 }),
                    }),
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>All expenses</CardTitle>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-muted-foreground">
                    No expenses yet. Add the first one to start tracking who
                    owes what.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {expenses.map((expense) => (
                      <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        nameOf={nameOf}
                        canManage={expense.createdById === user.id}
                        isEditing={expense.id === editing?.id}
                        editHref={`${tripHref}?edit=${expense.id}#expense-form`}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card id="expense-form" className="h-fit scroll-mt-6">
            <CardHeader>
              <CardTitle>
                {editing ? `Edit “${editing.title}”` : "Add an expense"}
              </CardTitle>
              {editing && (
                <CardAction>
                  <Link
                    href={tripHref}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Cancel
                  </Link>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <ExpenseForm
                // Remount when switching between adding and editing.
                key={editing?.id ?? "new"}
                tripId={trip.id}
                members={trip.members}
                currentUserId={user.id}
                expense={editing}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

function BalancesTable({
  rows,
}: {
  rows: {
    id: string;
    name: string;
    isYou: boolean;
    paidCents: number;
    owedCents: number;
  }[];
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th scope="col" className="pb-2 font-normal">
            Member
          </th>
          <th scope="col" className="pb-2 text-right font-normal">
            Paid
          </th>
          <th scope="col" className="pb-2 text-right font-normal">
            Share
          </th>
          <th scope="col" className="pb-2 text-right font-normal">
            Net
          </th>
        </tr>
      </thead>
      <tbody className="divide-y border-t">
        {rows.map((row) => {
          const net = row.paidCents - row.owedCents;
          return (
            <tr key={row.id}>
              <th scope="row" className="py-2.5 text-left font-normal">
                {row.name}
                {row.isYou && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </th>
              <td className="py-2.5 text-right tabular-nums">
                {formatCents(row.paidCents)}
              </td>
              <td className="py-2.5 text-right tabular-nums">
                {formatCents(row.owedCents)}
              </td>
              <td
                className={cn(
                  "py-2.5 text-right font-medium tabular-nums",
                  net > 0 && "text-emerald-700 dark:text-emerald-400",
                  net < 0 && "text-destructive",
                )}
              >
                {net === 0
                  ? "Settled"
                  : net > 0
                    ? `Owed ${formatCents(net)}`
                    : `Owes ${formatCents(-net)}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ExpenseRow({
  expense,
  nameOf,
  canManage,
  isEditing,
  editHref,
}: {
  expense: TripExpense;
  nameOf: (id: string) => string;
  canManage: boolean;
  isEditing: boolean;
  editHref: string;
}) {
  const itemized = expense.items.length > 1;
  return (
    <li
      className={cn(
        "grid gap-2 py-3",
        isEditing && "-mx-2 rounded-lg bg-muted/50 px-2",
      )}
      aria-current={isEditing || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="font-medium">{expense.title}</span>
          <span className="text-xs text-muted-foreground">
            Paid by {nameOf(expense.paidById)} · {formatDay(expense.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium tabular-nums">
            {formatCents(expense.amountCents)}
          </span>
          {canManage && (
            <>
              <Link
                href={editHref}
                aria-label={`Edit “${expense.title}”`}
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon-sm",
                })}
              >
                <Pencil aria-hidden />
              </Link>
              <DeleteExpenseButton
                expenseId={expense.id}
                title={expense.title}
              />
            </>
          )}
        </div>
      </div>
      <ul className="grid gap-1.5">
        {expense.items.map((item) => (
          <li key={item.id} className="text-xs">
            <span className="text-muted-foreground">
              {itemized && (
                <>
                  <span className="text-foreground">
                    {item.description ?? "Item"}
                  </span>{" "}
                  {formatCents(item.amountCents)} ·{" "}
                </>
              )}
              {item.splitType === "full"
                ? `Covered by ${nameOf(item.shares[0]?.userId ?? "")}`
                : SPLIT_LABELS[item.splitType]}
            </span>
            {item.splitType !== "full" && (
              <span className="block text-muted-foreground">
                {item.shares
                  .map(
                    (s) => `${nameOf(s.userId)} ${formatCents(s.amountCents)}`,
                  )
                  .join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
