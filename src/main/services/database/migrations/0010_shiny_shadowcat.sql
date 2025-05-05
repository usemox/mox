ALTER TABLE `linked_accounts` ADD `initial_sync_complete` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `linked_accounts` ADD `last_sync_page_token` text;--> statement-breakpoint
ALTER TABLE `linked_accounts` ADD `last_sync_date` integer;--> statement-breakpoint
ALTER TABLE `linked_accounts` ADD `sync_in_progress` integer DEFAULT false;