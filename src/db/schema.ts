import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { SPLIT_TYPES } from "../lib/splits";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: id(),
  // Stored lowercase so usernames are case-insensitive.
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    // SHA-256 hash of the session token; the raw token only lives in the cookie.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const trips = sqliteTable("trips", {
  id: id(),
  name: text("name").notNull(),
  destination: text("destination"),
  // ISO dates (YYYY-MM-DD).
  startDate: text("start_date"),
  endDate: text("end_date"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const tripMembers = sqliteTable(
  "trip_members",
  {
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull(),
    joinedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.userId] }),
    index("trip_members_user_id_idx").on(t.userId),
  ],
);

export const tripInvites = sqliteTable(
  "trip_invites",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    inviteeId: text("invitee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "declined"] })
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
    respondedAt: integer("responded_at", { mode: "timestamp" }),
  },
  // One invite row per person per trip; re-inviting after a decline reuses it.
  (t) => [
    uniqueIndex("trip_invites_trip_invitee_idx").on(t.tripId, t.inviteeId),
    index("trip_invites_invitee_idx").on(t.inviteeId, t.status),
  ],
);

export const expenses = sqliteTable(
  "expenses",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    // Money is stored as integer cents. Always the sum of the expense's items.
    amountCents: integer("amount_cents").notNull(),
    paidById: text("paid_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_trip_id_idx").on(t.tripId, t.createdAt)],
);

export const splitTypes = [
  "even",
  "full",
  "exact",
  "percent",
  "shares",
] as const;

// Every expense has at least one item; an expense that isn't itemized has a
// single item with no description. Each item carries its own split.
export const expenseItems = sqliteTable(
  "expense_items",
  {
    id: id(),
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description"),
    amountCents: integer("amount_cents").notNull(),
    splitType: text("split_type", { enum: SPLIT_TYPES }).notNull(),
  },
  (t) => [index("expense_items_expense_id_idx").on(t.expenseId, t.position)],
);

export const expenseShares = sqliteTable(
  "expense_shares",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => expenseItems.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // What was entered for this person: 1 for even/full splits, cents for
    // exact amounts, basis points for percentages, or a share count.
    weight: integer("weight").notNull(),
    // What this person owes for the item; an item's shares sum to its amount.
    amountCents: integer("amount_cents").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.userId] }),
    index("expense_shares_user_id_idx").on(t.userId),
  ],
);
