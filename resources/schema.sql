CREATE TABLE `email_bodies` (
	`email_id` text PRIMARY KEY NOT NULL,
	`html` text NOT NULL,
	`plain` text NOT NULL,
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`from_address` text NOT NULL,
	`to_address` text NOT NULL,
	`subject` text,
	`snippet` text,
	`history_id` text,
	`label_ids` text,
	`date` integer NOT NULL,
	`unread` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`synced_at` integer NOT NULL
);

CREATE VIEW `threads` AS SELECT e.id,
  e.thread_id,
  e.from_address,
  e.to_address,
  e.subject,
  e.snippet,
  e.date,
  e.unread,
  e.synced_at,
  e.label_ids
FROM "emails" e
JOIN (
  SELECT COALESCE(thread_id, id) AS conversation, 
    MAX(date) AS latest_date
  FROM "emails"
  WHERE archived = 0
  GROUP BY COALESCE(thread_id, id)
) latest
  ON COALESCE(e.thread_id, e.id) = latest.conversation
  AND e.date = latest.latest_date
  WHERE e.archived = 0
;
