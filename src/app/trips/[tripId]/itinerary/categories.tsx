import {
  BedDouble,
  StickyNote,
  Ticket,
  TrainFront,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import type { ItineraryCategory } from "@/lib/itinerary";

export const CATEGORY_LABELS: Record<ItineraryCategory, string> = {
  activity: "Activity",
  food: "Food & drink",
  transport: "Getting around",
  lodging: "Lodging",
  other: "Other",
};

export const CATEGORY_ICONS: Record<ItineraryCategory, LucideIcon> = {
  activity: Ticket,
  food: Utensils,
  transport: TrainFront,
  lodging: BedDouble,
  other: StickyNote,
};
