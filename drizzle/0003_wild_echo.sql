CREATE TABLE `itinerary_items` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`day` text,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'activity' NOT NULL,
	`start_time` text,
	`end_time` text,
	`location` text,
	`notes` text,
	`created_by_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `itinerary_items_trip_day_idx` ON `itinerary_items` (`trip_id`,`day`,`position`);