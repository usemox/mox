PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_email_attachments` (
	`email_id` text,
	`attachment_id` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_name` text NOT NULL,
	`content_id` text,
	`data` blob,
	PRIMARY KEY(`email_id`, `file_name`),
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_email_attachments`("email_id", "attachment_id", "mime_type", "file_name", "content_id", "data") SELECT "email_id", "attachment_id", "mime_type", "file_name", "content_id", "data" FROM `email_attachments`;--> statement-breakpoint
DROP TABLE `email_attachments`;--> statement-breakpoint
ALTER TABLE `__new_email_attachments` RENAME TO `email_attachments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;