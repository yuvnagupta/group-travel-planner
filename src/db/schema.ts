import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
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

export const suggestions = sqliteTable(
  "suggestions",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["flight", "hotel"] }).notNull(),
    // Snapshot of the search result when it was suggested; offers expire, so we keep our own copy.
    details: text("details", { mode: "json" }).notNull(),
    priceAmount: text("price_amount").notNull(),
    priceCurrency: text("price_currency").notNull(),
    note: text("note"),
    // Set on the one flight and one hotel the trip owner picks as the plan.
    chosenAt: integer("chosen_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("suggestions_trip_kind_idx").on(t.tripId, t.kind)],
);

export const suggestionVotes = sqliteTable(
  "suggestion_votes",
  {
    suggestionId: text("suggestion_id")
      .notNull()
      .references(() => suggestions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // 1 for an upvote, -1 for a downvote.
    value: integer("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.suggestionId, t.userId] })],
);

export const suggestionComments = sqliteTable(
  "suggestion_comments",
  {
    id: id(),
    suggestionId: text("suggestion_id")
      .notNull()
      .references(() => suggestions.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("suggestion_comments_suggestion_idx").on(t.suggestionId, t.createdAt),
  ],
);

// Search results are cached so the trip page doesn't call the flight and hotel
// APIs on every load. One row per distinct search, shared by everyone who runs it.
export const searchCaches = sqliteTable(
  "search_caches",
  {
    id: id(),
    kind: text("kind", { enum: ["flight", "hotel"] }).notNull(),
    // SHA-256 of the normalized search parameters.
    key: text("key").notNull(),
    params: text("params", { mode: "json" }).notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
    // Set while a background check runs, so concurrent loads don't start another.
    refreshStartedAt: integer("refresh_started_at", { mode: "timestamp" }),
  },
  (t) => [uniqueIndex("search_caches_kind_key_idx").on(t.kind, t.key)],
);

export const searchResults = sqliteTable(
  "search_results",
  {
    cacheId: text("cache_id")
      .notNull()
      .references(() => searchCaches.id, { onDelete: "cascade" }),
    // Stays the same across searches: the hotel id, or the flights and times
    // for an itinerary (Duffel issues new offer ids on every search).
    resultKey: text("result_key").notNull(),
    option: text("option", { mode: "json" }).notNull(),
    price: real("price").notNull(),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cacheId, t.resultKey] }),
    index("search_results_cache_price_idx").on(t.cacheId, t.price),
  ],
);
