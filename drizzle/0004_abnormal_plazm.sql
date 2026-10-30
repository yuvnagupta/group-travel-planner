CREATE TABLE `search_caches` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`params` text NOT NULL,
	`fetched_at` integer NOT NULL,
	`refresh_started_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `search_caches_kind_key_idx` ON `search_caches` (`kind`,`key`);--> statement-breakpoint
CREATE TABLE `search_results` (
	`cache_id` text NOT NULL,
	`result_key` text NOT NULL,
	`option` text NOT NULL,
	`price` real NOT NULL,
	`first_seen_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_seen_at` integer NOT NULL,
	PRIMARY KEY(`cache_id`, `result_key`),
	FOREIGN KEY (`cache_id`) REFERENCES `search_caches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_results_cache_price_idx` ON `search_results` (`cache_id`,`price`);