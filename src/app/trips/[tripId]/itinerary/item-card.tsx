"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { GripVertical, MapPin, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/format";
import type { ItineraryItem } from "@/lib/itinerary";

import { CATEGORY_ICONS, CATEGORY_LABELS } from "./categories";

function timeRange(item: ItineraryItem) {
  if (!item.startTime) return null;
  const start = formatClock(item.startTime);
  return item.endTime ? `${start} – ${formatClock(item.endTime)}` : start;
}

type ItemCardProps = {
  item: ItineraryItem;
  onEdit?: () => void;
  /** Rendered in the drag overlay: no drag handlers, lifted look. */
  overlay?: boolean;
};

export function ItemCardView({
  item,
  onEdit,
  overlay,
  handle,
}: ItemCardProps & { handle?: React.ReactNode }) {
  const Icon = CATEGORY_ICONS[item.category];
  const time = timeRange(item);

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border bg-card p-3",
        overlay && "shadow-lg ring-2 ring-ring/40",
      )}
    >
      {handle ?? (
        <span className="mt-0.5 p-1 text-muted-foreground">
          <GripVertical className="size-4" aria-hidden />
        </span>
      )}
      <div
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted"
        title={CATEGORY_LABELS[item.category]}
      >
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {time && (
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              {time}
            </span>
          )}
          <span className="font-medium break-words">{item.title}</span>
        </div>
        {item.location && (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{item.location}</span>
          </span>
        )}
        {item.notes && (
          <p className="line-clamp-2 text-sm whitespace-pre-wrap text-muted-foreground">
            {item.notes}
          </p>
        )}
        <span className="text-xs text-muted-foreground">
          Added by @{item.createdBy}
        </span>
      </div>
      {onEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${item.title}`}
          onClick={onEdit}
        >
          <Pencil aria-hidden />
        </Button>
      )}
    </div>
  );
}

/** A card that can be dragged by its handle (pointer, touch, or keyboard: Space then arrows). */
export function SortableItemCard({ item, onEdit }: ItemCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
    >
      <ItemCardView
        item={item}
        onEdit={onEdit}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`Move ${item.title}`}
            className="mt-0.5 cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        }
      />
    </li>
  );
}
