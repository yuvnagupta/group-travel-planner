"use client";

import { useActionState } from "react";

import {
  addItineraryItem,
  deleteItineraryItem,
  editItineraryItem,
} from "@/app/actions/itinerary";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatWeekday } from "@/lib/format";
import type { ItineraryItem } from "@/lib/itinerary";
import type { FormState } from "@/lib/validation";

import { CATEGORY_LABELS } from "./categories";

type ItemFormProps = {
  tripId: string;
  days: string[];
  /** The day a new item starts on (null for ideas). Ignored when editing. */
  defaultDay: string | null;
  item?: ItineraryItem;
  onDone: () => void;
};

export function ItemForm({
  tripId,
  days,
  defaultDay,
  item,
  onDone,
}: ItemFormProps) {
  const [state, action] = useActionState<FormState, FormData>(
    async (prev, formData) => {
      const result = await (item ? editItineraryItem : addItineraryItem)(
        prev,
        formData,
      );
      if (result.success) onDone();
      return result;
    },
    {},
  );
  const v = state.values;
  const e = state.fieldErrors;
  const idPrefix = item?.id ?? `new-${defaultDay ?? "ideas"}`;
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const day = v?.day ?? item?.day ?? defaultDay ?? "";
  // Keep an out-of-range day selectable so editing doesn't silently move the item.
  const dayOptions =
    item?.day && !days.includes(item.day) ? [...days, item.day] : days;

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4">
      <form action={action} className="grid gap-3" noValidate>
        <input type="hidden" name="tripId" value={tripId} />
        {item && <input type="hidden" name="itemId" value={item.id} />}
        <FormMessage error={state.error} />
        <Field
          id={fieldId("title")}
          name="title"
          label="What"
          placeholder="Tram 28 across the old town"
          required
          autoFocus
          defaultValue={v?.title ?? item?.title}
          errors={e?.title}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="grid content-start gap-2 sm:col-span-2">
            <Label htmlFor={fieldId("day")}>Day</Label>
            <NativeSelect id={fieldId("day")} name="day" defaultValue={day}>
              <option value="">Ideas (no day yet)</option>
              {dayOptions.map((d, i) => (
                <option key={d} value={d}>
                  {days.includes(d)
                    ? `Day ${i + 1} · ${formatWeekday(d)}`
                    : `${formatWeekday(d)} (outside trip dates)`}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Field
            id={fieldId("startTime")}
            name="startTime"
            label="Start"
            type="time"
            defaultValue={v?.startTime ?? item?.startTime ?? ""}
            errors={e?.startTime}
          />
          <Field
            id={fieldId("endTime")}
            name="endTime"
            label="End"
            type="time"
            defaultValue={v?.endTime ?? item?.endTime ?? ""}
            errors={e?.endTime}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Field
            id={fieldId("location")}
            name="location"
            label="Where (optional)"
            placeholder="Praça Martim Moniz"
            defaultValue={v?.location ?? item?.location ?? ""}
            errors={e?.location}
          />
          <div className="grid content-start gap-2">
            <Label htmlFor={fieldId("category")}>Type</Label>
            <NativeSelect
              id={fieldId("category")}
              name="category"
              defaultValue={v?.category ?? item?.category ?? "activity"}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={fieldId("notes")}>Notes (optional)</Label>
          <textarea
            id={fieldId("notes")}
            name="notes"
            rows={2}
            maxLength={2000}
            defaultValue={v?.notes ?? item?.notes ?? ""}
            placeholder="Booking reference, what to bring, links…"
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          {e?.notes && <p className="text-sm text-destructive">{e.notes[0]}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingText="Saving…">
            {item ? "Save" : "Add to itinerary"}
          </SubmitButton>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
      {item && (
        <form action={deleteItineraryItem} className="justify-self-end">
          <input type="hidden" name="itemId" value={item.id} />
          <Button type="submit" variant="destructive" size="sm">
            Delete
          </Button>
        </form>
      )}
    </div>
  );
}
