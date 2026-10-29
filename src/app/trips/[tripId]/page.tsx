import { CalendarDays, MapPin } from "lucide-react";
import { cn } from "cn";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import {
  Card,
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
import { getTripForMember } from "@/lib/trips";

import { DeleteExpenseButton } from "./delete-expense-button";
import { ExpenseForm } from "./expense-form";
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
  const expenses = (await getExpensesForMember(trip.id, user.id)) ?? [];
  const balances = balancesOf(expenses);

  // Expenses can name people who are no longer on the trip; look them up too.
  const names = new Map(trip.members.map((m) => [m.id, m.username]));
  const missing = [...balances.keys()].filter((id) => !names.has(id));
  for (const [id, username] of await usernamesOf(missing))
    names.set(id, username);
  const nameOf = (id: string) => `@${names.get(id) ?? "unknown"}`;

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

      <section aria-labelledby="expenses-heading" className="grid gap-4">
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
                        canDelete={expense.createdById === user.id}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Add an expense</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseForm
                tripId={trip.id}
                members={trip.members}
                currentUserId={user.id}
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
  canDelete,
}: {
  expense: TripExpense;
  nameOf: (id: string) => string;
  canDelete: boolean;
}) {
  const itemized = expense.items.length > 1;
  return (
    <li className="grid gap-2 py-3">
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
          {canDelete && (
            <DeleteExpenseButton expenseId={expense.id} title={expense.title} />
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
