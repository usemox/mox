ALTER TABLE `emails` ADD `folder` text DEFAULT 'INBOX' NOT NULL;--> statement-breakpoint
CREATE INDEX `email_folder_idx` ON `emails` (`folder`);--> statement-breakpoint
DROP VIEW `threads`;--> statement-breakpoint
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
  GROUP BY e.id
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