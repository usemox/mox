CREATE TABLE `linked_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email_address` text NOT NULL,
	`last_history_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `linked_accounts_email_address_unique` ON `linked_accounts` (`email_address`);--> statement-breakpoint
ALTER TABLE `emails` ADD `linked_account_id` text NOT NULL REFERENCES linked_accounts(id);--> statement-breakpoint
CREATE INDEX `email_account_idx` ON `emails` (`linked_account_id`);--> statement-breakpoint
DROP VIEW `threads`;--> statement-breakpoint
CREATE VIEW `threads` AS WITH latest_emails AS (
  SELECT
    e.*,
    (SELECT MIN(value) FROM json_each(e.label_ids) WHERE value LIKE 'CATEGORY_%') AS category,
    ROW_NUMBER() OVER (PARTITION BY e.linked_account_id, e.thread_id ORDER BY e.date DESC) AS rn
  FROM emails e
  WHERE e.folder = 'INBOX'
)
SELECT
  id,
  linked_account_id,
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
  folder,
  category
FROM latest_emails
WHERE rn = 1
ORDER BY date DESC
;