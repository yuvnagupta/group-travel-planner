CREATE TABLE `expense_items` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text,
	`amount_cents` integer NOT NULL,
	`split_type` text NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expense_items_expense_id_idx` ON `expense_items` (`expense_id`,`position`);--> statement-breakpoint
CREATE TABLE `expense_shares` (
	`item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`weight` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	PRIMARY KEY(`item_id`, `user_id`),
	FOREIGN KEY (`item_id`) REFERENCES `expense_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expense_shares_user_id_idx` ON `expense_shares` (`user_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`title` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_by_id` text NOT NULL,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paid_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expenses_trip_id_idx` ON `expenses` (`trip_id`,`created_at`);