"use client";

import { Plus, Trash2 } from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";

import { addExpense } from "@/app/actions/expenses";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  SPLIT_LABELS,
  SPLIT_TYPES,
  formatCents,
  parseBasisPoints,
  parseCents,
  shareAmounts,
  type SplitType,
} from "@/lib/splits";
import type { FormState } from "@/lib/validation";

type Member = { id: string; username: string };

type ItemDraft = {
  key: number;
  description: string;
  amount: string;
  splitType: SplitType;
  /** Who's included in an even split. */
  selected: string[];
  /** Who covers the item in a "full" split. */
  coveredBy: string;
  /** Amounts, percentages or share counts entered per person. */
  values: Record<string, string>;
};

type ExpenseFormProps = {
  tripId: string;
  members: Member[];
  currentUserId: string;
};

export function ExpenseForm(props: ExpenseFormProps) {
  const [state, action, pending] = useActionState(addExpense, {});
  // Start a blank form after each successful add. Adjusting state while
  // rendering (rather than in an effect) avoids rendering the stale form.
  const [seen, setSeen] = useState(state);
  const [resets, setResets] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.success) setResets(resets + 1);
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      // Submitted by hand rather than through `action` so React doesn't reset
      // the form afterwards: every field here is driven by state, and a reset
      // would put selects back on their first option while state disagrees.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="tripId" value={props.tripId} />
      <FormMessage error={state.error} success={state.success} />
      <ExpenseFields key={resets} {...props} errors={state.fieldErrors} />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add expense"}
      </Button>
    </form>
  );
}

function ExpenseFields({
  members,
  currentUserId,
  errors,
}: ExpenseFormProps & { errors?: FormState["fieldErrors"] }) {
  const newItem = (key: number): ItemDraft => ({
    key,
    description: "",
    amount: "",
    splitType: "even",
    selected: members.map((m) => m.id),
    coveredBy: currentUserId,
    values: {},
  });
  const [items, setItems] = useState<ItemDraft[]>(() => [newItem(0)]);
  const [itemized, setItemized] = useState(false);
  // Controlled so React's automatic form reset doesn't clear them on errors.
  const [title, setTitle] = useState("");
  const [paidById, setPaidById] = useState(currentUserId);

  const update = (key: number, patch: Partial<ItemDraft>) =>
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const totalCents = items.reduce(
    (sum, i) => sum + (parseCents(i.amount) ?? 0),
    0,
  );

  return (
    <>
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(items.map((i) => toPayload(i, members)))}
      />
      <Field
        name="title"
        label="What was it?"
        placeholder="Dinner at Time Out Market"
        required
        autoComplete="off"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        errors={errors?.title}
      />
      <div className="grid gap-2">
        <Label htmlFor="paidById">Paid by</Label>
        <NativeSelect
          id="paidById"
          name="paidById"
          value={paidById}
          onChange={(e) => setPaidById(e.target.value)}
          aria-invalid={Boolean(errors?.paidById) || undefined}
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              @{m.username}
              {m.id === currentUserId ? " (you)" : ""}
            </option>
          ))}
        </NativeSelect>
        <ErrorText errors={errors?.paidById} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={itemized}
          onChange={(e) => {
            setItemized(e.target.checked);
            if (!e.target.checked) setItems((all) => all.slice(0, 1));
          }}
        />
        Itemize into separate portions
      </label>

      {items.map((item, index) => (
        <ItemEditor
          key={item.key}
          index={index}
          item={item}
          itemized={itemized}
          members={members}
          currentUserId={currentUserId}
          errors={errors}
          onChange={(patch) => update(item.key, patch)}
          onRemove={
            itemized && items.length > 1
              ? () => setItems((all) => all.filter((i) => i.key !== item.key))
              : undefined
          }
        />
      ))}
      <ErrorText errors={errors?.items} />

      {itemized && (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setItems((all) => [
                ...all,
                newItem(Math.max(...all.map((i) => i.key)) + 1),
              ])
            }
          >
            <Plus aria-hidden />
            Add item
          </Button>
          <p className="text-sm">
            Total{" "}
            <span className="font-medium tabular-nums">
              {formatCents(totalCents)}
            </span>
          </p>
        </div>
      )}
    </>
  );
}

function ItemEditor({
  index,
  item,
  itemized,
  members,
  currentUserId,
  errors,
  onChange,
  onRemove,
}: {
  index: number;
  item: ItemDraft;
  itemized: boolean;
  members: Member[];
  currentUserId: string;
  errors?: FormState["fieldErrors"];
  onChange: (patch: Partial<ItemDraft>) => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const err = (field: string) => errors?.[`items.${index}.${field}`];
  const amountCents = parseCents(item.amount);
  const preview = previewOf(item, members, amountCents);

  const fields = (
    <>
      {itemized && (
        <div className="flex items-end gap-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor={`${id}-description`}>Item {index + 1}</Label>
            <Input
              id={`${id}-description`}
              placeholder="e.g. Drinks"
              value={item.description}
              autoComplete="off"
              aria-invalid={Boolean(err("description")) || undefined}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </div>
          {onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove item ${index + 1}`}
              onClick={onRemove}
            >
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      )}
      <ErrorText errors={err("description")} />
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-amount`}>Amount</Label>
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={item.amount}
            aria-invalid={Boolean(err("amount")) || undefined}
            onChange={(e) => onChange({ amount: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-split`}>Split</Label>
          <NativeSelect
            id={`${id}-split`}
            value={item.splitType}
            onChange={(e) =>
              onChange({ splitType: e.target.value as SplitType, values: {} })
            }
          >
            {SPLIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SPLIT_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <ErrorText errors={err("amount")} />

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-xs text-muted-foreground">
          {legendOf(item.splitType)}
        </legend>
        {members.map((m, i) => (
          <div
            key={m.id}
            className="grid grid-cols-[1fr_6rem_5rem] items-center gap-2 text-sm"
          >
            <ParticipantControl
              name={`${id}-who`}
              item={item}
              member={m}
              isYou={m.id === currentUserId}
              onChange={onChange}
            />
            <span className="text-right text-muted-foreground tabular-nums">
              {preview[i] === null ? "" : formatCents(preview[i])}
            </span>
          </div>
        ))}
        <SplitStatus item={item} amountCents={amountCents} />
      </fieldset>
      <ErrorText errors={err("split")} />
    </>
  );

  return itemized ? (
    <div className="grid gap-3 rounded-lg border p-3">{fields}</div>
  ) : (
    fields
  );
}

function ParticipantControl({
  name,
  item,
  member,
  isYou,
  onChange,
}: {
  name: string;
  item: ItemDraft;
  member: Member;
  isYou: boolean;
  onChange: (patch: Partial<ItemDraft>) => void;
}) {
  const label = (
    <>
      @{member.username}
      {isYou && <span className="text-muted-foreground"> (you)</span>}
    </>
  );

  if (item.splitType === "even" || item.splitType === "full") {
    const checked =
      item.splitType === "even"
        ? item.selected.includes(member.id)
        : item.coveredBy === member.id;
    return (
      <label className="col-span-2 flex items-center gap-2">
        <input
          type={item.splitType === "even" ? "checkbox" : "radio"}
          name={item.splitType === "full" ? name : undefined}
          className="size-4 accent-primary"
          checked={checked}
          onChange={(e) =>
            item.splitType === "even"
              ? onChange({
                  selected: e.target.checked
                    ? [...item.selected, member.id]
                    : item.selected.filter((id) => id !== member.id),
                })
              : onChange({ coveredBy: member.id })
          }
        />
        {label}
      </label>
    );
  }

  const inputId = `${name}-${member.id}`;
  return (
    <>
      <label htmlFor={inputId} className="truncate">
        {label}
      </label>
      <Input
        id={inputId}
        inputMode={item.splitType === "shares" ? "numeric" : "decimal"}
        autoComplete="off"
        placeholder={
          item.splitType === "exact"
            ? "0.00"
            : item.splitType === "percent"
              ? "0%"
              : "0"
        }
        value={item.values[member.id] ?? ""}
        onChange={(e) =>
          onChange({ values: { ...item.values, [member.id]: e.target.value } })
        }
      />
    </>
  );
}

/** For exact and percent splits, how much is still left to assign. */
function SplitStatus({
  item,
  amountCents,
}: {
  item: ItemDraft;
  amountCents: number | null;
}) {
  const entered = Object.values(item.values);
  if (item.splitType === "exact" && amountCents !== null) {
    const left =
      amountCents - entered.reduce((s, v) => s + (parseCents(v) ?? 0), 0);
    return (
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {left === 0
          ? "All assigned."
          : left > 0
            ? `${formatCents(left)} left to assign.`
            : `${formatCents(-left)} over.`}
      </p>
    );
  }
  if (item.splitType === "percent") {
    const left =
      10_000 - entered.reduce((s, v) => s + (parseBasisPoints(v) ?? 0), 0);
    return (
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {left === 0
          ? "Adds up to 100%."
          : left > 0
            ? `${left / 100}% left to assign.`
            : `${-left / 100}% over.`}
      </p>
    );
  }
  return null;
}

function ErrorText({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

function legendOf(type: SplitType) {
  switch (type) {
    case "even":
      return "Split evenly between:";
    case "full":
      return "Who covers it?";
    case "exact":
      return "Enter what each person owes (leave blank for nothing):";
    case "percent":
      return "Enter each person's percentage:";
    case "shares":
      return "Enter shares per person, e.g. 2 for someone who had twice as much:";
  }
}

/** What the server should receive for an item. Members keep their trip order. */
function toPayload(item: ItemDraft, members: Member[]) {
  const participants =
    item.splitType === "even"
      ? members
          .filter((m) => item.selected.includes(m.id))
          .map((m) => ({ userId: m.id, value: "" }))
      : item.splitType === "full"
        ? [{ userId: item.coveredBy, value: "" }]
        : members.map((m) => ({
            userId: m.id,
            value: item.values[m.id] ?? "",
          }));
  return {
    description: item.description,
    amount: item.amount,
    splitType: item.splitType,
    participants,
  };
}

/** Each member's share as the server will compute it, or null if not in it. */
function previewOf(
  item: ItemDraft,
  members: Member[],
  amountCents: number | null,
): (number | null)[] {
  const weights = members.map((m) => {
    switch (item.splitType) {
      case "even":
        return item.selected.includes(m.id) ? 1 : 0;
      case "full":
        return item.coveredBy === m.id ? 1 : 0;
      case "exact":
        return parseCents(item.values[m.id] ?? "") ?? 0;
      case "percent":
        return parseBasisPoints(item.values[m.id] ?? "") ?? 0;
      case "shares":
        return Number.parseInt(item.values[m.id] ?? "", 10) || 0;
    }
  });
  if (amountCents === null && item.splitType !== "exact")
    return members.map(() => null);

  // Only included people take part in rounding, in the same order as the payload.
  const included = weights.flatMap((w, i) => (w > 0 ? [i] : []));
  const used = included.map((i) => weights[i]);
  if (item.splitType === "percent") {
    // Until percentages reach 100%, show each person's cut of the full amount.
    const assigned = used.reduce((a, b) => a + b, 0);
    if (assigned > 10_000) return members.map(() => null);
    used.push(10_000 - assigned);
  }
  const amounts = shareAmounts(item.splitType, amountCents ?? 0, used);
  return members.map((_, i) => {
    const at = included.indexOf(i);
    return at === -1 ? null : amounts[at];
  });
}
