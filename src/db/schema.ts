import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
