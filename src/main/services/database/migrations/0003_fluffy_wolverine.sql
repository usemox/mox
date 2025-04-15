DROP VIEW `threads`;--> statement-breakpoint
CREATE VIEW `threads` AS WITH latest_emails AS (
  SELECT 
    e.*,
    (SELECT MIN(value) FROM json_each(e.label_ids) WHERE value LIKE 'CATEGORY_%') AS category,
    ROW_NUMBER() OVER (PARTITION BY e.thread_id ORDER BY e.date DESC) AS rn
  FROM emails e
  WHERE e.folder = 'INBOX' 
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