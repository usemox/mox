CREATE TABLE `sync_state` (
	`id` text PRIMARY KEY NOT NULL,
	`initial_sync_complete` integer DEFAULT false,
	`last_sync_page_token` text,
	`last_sync_date` integer,
	`sync_in_progress` integer DEFAULT false,
	`updated_at` integer NOT NULL
);
