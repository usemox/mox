CREATE TABLE `action_items` (
	`id` text PRIMARY KEY NOT NULL,
	`email_id` text NOT NULL,
	`description` text NOT NULL,
	`due_date` text,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `configuration` (
	`id` text PRIMARY KEY NOT NULL,
	`is_initialized` integer DEFAULT false NOT NULL,
	`last_full_sync` integer
);
--> statement-breakpoint
CREATE TABLE `email_addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`person_id` text,
	`email` text NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_addresses_email_unique` ON `email_addresses` (`email`);--> statement-breakpoint
CREATE TABLE `email_attachments` (
	`email_id` text,
	`attachment_id` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`file_name` text NOT NULL,
	`content_id` text,
	`data` blob,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_attachments_file_name_unique` ON `email_attachments` (`file_name`);--> statement-breakpoint
CREATE TABLE `email_bodies` (
	`email_id` text PRIMARY KEY NOT NULL,
	`html` text NOT NULL,
	`plain` text NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `email_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_id` text,
	`embedding` F32_BLOB(1536),
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_embeddings_email_id_unique` ON `email_embeddings` (`email_id`);--> statement-breakpoint
CREATE TABLE `email_labels` (
	`email_id` text,
	`label_id` text NOT NULL,
	`description` text,
	PRIMARY KEY(`email_id`, `label_id`),
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `email_summaries` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`from_address` text NOT NULL,
	`headers` text,
	`to_address` text NOT NULL,
	`subject` text,
	`snippet` text,
	`history_id` integer,
	`label_ids` text,
	`date` integer NOT NULL,
	`unread` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`synced_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `middleware_results` (
	`id` text PRIMARY KEY NOT NULL,
	`middleware_id` text NOT NULL,
	`email_id` text,
	`result` text NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`photo_url` text,
	`notes` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE VIEW `categories` AS 
  WITH extracted_categories AS (
    SELECT DISTINCT value as category
    FROM "emails", json_each("emails".label_ids)
    WHERE label_ids IS NOT NULL
      AND value LIKE 'CATEGORY_%'
  )
  SELECT category
  FROM extracted_categories
;--> statement-breakpoint
CREATE VIEW `threads` AS WITH latest_emails AS (
  SELECT 
    e.*,
    MIN(CASE WHEN je.value LIKE 'CATEGORY_%' THEN je.value END) AS category,
    ROW_NUMBER() OVER (PARTITION BY e.thread_id ORDER BY e.date DESC) AS rn
  FROM emails e
  JOIN json_each(e.label_ids) AS je
  WHERE EXISTS (
    SELECT 1 FROM json_each(e.label_ids) WHERE value = 'INBOX'
  )
  GROUP BY e.id  -- group per email to aggregate categories
)
SELECT
  id,
  thread_id,
  headers,
  from_address,
  to_address,
  subject,
  snippet,
  date,
  unread,
  synced_at,
  label_ids,
  draft,
  archived,
  category
FROM latest_emails
WHERE rn = 1
ORDER BY date DESC
;