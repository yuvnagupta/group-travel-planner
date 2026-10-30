"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "cn";
import { Plus } from "lucide-react";
import { startTransition, useLayoutEffect, useRef, useState } from "react";

import { moveItineraryItem } from "@/app/actions/itinerary";
import { Button } from "@/components/ui/button";
import { formatWeekday } from "@/lib/format";
import type { ItineraryItem } from "@/lib/itinerary";

import { ItemCardView, SortableItemCard } from "./item-card";
import { ItemForm } from "./item-form";

const IDEAS = "ideas";
type Board = Record<string, ItineraryItem[]>;

const keyOf = (day: string | null) => day ?? IDEAS;
const dayOf = (key: string) => (key === IDEAS ? null : key);

function group(items: ItineraryItem[], days: string[]): Board {
  const board: Board = { [IDEAS]: [] };
  for (const day of days) board[day] = [];
  for (const item of items) (board[keyOf(item.day)] ??= []).push(item);
  return board;
}

type ItineraryBoardProps = {
  tripId: string;
  days: string[];
  items: ItineraryItem[];
};

export function ItineraryBoard({ tripId, days, items }: ItineraryBoardProps) {
  const [board, setBoard] = useState(() => group(items, days));
  const [synced, setSynced] = useState(items);
  // Server data changed (after a save, move, or someone else's edit): start from it again.
  if (items !== synced) {
    setSynced(items);
    setBoard(group(items, days));
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const sensors = useSensors(
    // A small distance lets the handle still be clicked or focused without starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Days outside the trip's dates (left over after the dates changed) can be dragged from, not to.
  const outside = Object.keys(board)
    .filter((k) => k !== IDEAS && !days.includes(k))
    .sort();
  const droppable = (key: string) => key === IDEAS || days.includes(key);

  // Drag events can arrive faster than React re-renders, so handlers read and
  // write this ref instead of the `board` captured by their closure.
  const boardRef = useRef(board);
  useLayoutEffect(() => {
    boardRef.current = board;
  }, [board]);
  const commit = (next: Board) => {
    boardRef.current = next;
    setBoard(next);
  };

  const containerOf = (b: Board, id: string) =>
    id in b ? id : Object.keys(b).find((k) => b[k].some((i) => i.id === id));

  const active = activeId
    ? Object.values(board)
        .flat()
        .find((i) => i.id === activeId)
    : undefined;

  function onDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
    setDragFrom(containerOf(boardRef.current, String(active.id)) ?? null);
    setEditing(null);
  }

  // Moving across days happens while dragging, so the card shows where it'll land.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const b = boardRef.current;
    const from = containerOf(b, String(active.id));
    const to = containerOf(b, String(over.id));
    if (!from || !to || from === to || !droppable(to)) return;

    const moving = b[from].find((i) => i.id === active.id);
    if (!moving) return;
    const target = b[to];
    const overIndex = target.findIndex((i) => i.id === over.id);
    const index = overIndex === -1 ? target.length : overIndex;
    commit({
      ...b,
      [from]: b[from].filter((i) => i.id !== active.id),
      [to]: [
        ...target.slice(0, index),
        { ...moving, day: dayOf(to) },
        ...target.slice(index),
      ],
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const b = boardRef.current;
    const id = String(active.id);
    const container = containerOf(b, id);
    if (!over || !container) {
      commit(group(items, days));
      return;
    }

    let list = b[container];
    if (containerOf(b, String(over.id)) === container) {
      const from = list.findIndex((i) => i.id === id);
      const to = list.findIndex((i) => i.id === over.id);
      if (to !== -1 && from !== to) list = arrayMove(list, from, to);
    }
    const index = list.findIndex((i) => i.id === id);
    const unchanged =
      container === dragFrom &&
      items
        .filter((i) => keyOf(i.day) === container)
        .findIndex((i) => i.id === id) === index;

    commit({ ...b, [container]: list });
    if (unchanged) return;
    startTransition(async () => {
      await moveItineraryItem({ itemId: id, day: dayOf(container), index });
    });
  }

  const sections = [
    ...days.map((day, i) => ({
      key: day,
      title: `Day ${i + 1}`,
      subtitle: formatWeekday(day),
    })),
    ...outside.map((day) => ({
      key: day,
      title: formatWeekday(day),
      subtitle: "Outside the trip's dates",
    })),
    { key: IDEAS, title: "Ideas", subtitle: "Not on a day yet" },
  ];

  return (
    <DndContext
      id="itinerary"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        commit(group(items, days));
      }}
    >
      <div className="grid gap-8">
        {sections.map((section) => (
          <DaySection
            key={section.key}
            id={section.key}
            title={section.title}
            subtitle={section.subtitle}
            items={board[section.key] ?? []}
            isDropTarget={droppable(section.key)}
            adding={adding === section.key}
            onAdd={() => {
              setAdding(section.key);
              setEditing(null);
            }}
            renderForm={() => (
              <ItemForm
                tripId={tripId}
                days={days}
                defaultDay={dayOf(section.key)}
                onDone={() => setAdding(null)}
              />
            )}
            renderItem={(item) =>
              editing === item.id ? (
                <li key={item.id}>
                  <ItemForm
                    tripId={tripId}
                    days={days}
                    defaultDay={item.day}
                    item={item}
                    onDone={() => setEditing(null)}
                  />
                </li>
              ) : (
                <SortableItemCard
                  key={item.id}
                  item={item}
                  onEdit={() => {
                    setEditing(item.id);
                    setAdding(null);
                  }}
                />
              )
            }
          />
        ))}
      </div>
      <DragOverlay>
        {active ? <ItemCardView item={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

type DaySectionProps = {
  id: string;
  title: string;
  subtitle: string;
  items: ItineraryItem[];
  isDropTarget: boolean;
  adding: boolean;
  onAdd: () => void;
  renderForm: () => React.ReactNode;
  renderItem: (item: ItineraryItem) => React.ReactNode;
};

function DaySection({
  id,
  title,
  subtitle,
  items,
  isDropTarget,
  adding,
  onAdd,
  renderForm,
  renderItem,
}: DaySectionProps) {
  // Registers the section itself as a drop target, so empty days still accept cards.
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !isDropTarget });

  return (
    <section aria-labelledby={`${id}-heading`} className="grid gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-lg font-semibold">
          {title}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · {subtitle}
          </span>
        </h2>
        {isDropTarget && !adding && (
          <Button variant="ghost" size="sm" onClick={onAdd}>
            <Plus aria-hidden />
            Add
          </Button>
        )}
      </div>
      <SortableContext
        id={id}
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul
          ref={setNodeRef}
          className={cn(
            "grid min-h-14 gap-2 rounded-xl transition-colors",
            items.length === 0 && "border border-dashed p-2",
            isOver && "bg-muted/60",
          )}
        >
          {items.length === 0 && !adding && (
            <li className="flex items-center justify-center py-2 text-sm text-muted-foreground">
              {isDropTarget
                ? "Nothing planned. Add something or drag a card here."
                : "Empty"}
            </li>
          )}
          {items.map(renderItem)}
        </ul>
      </SortableContext>
      {adding && renderForm()}
    </section>
  );
}
