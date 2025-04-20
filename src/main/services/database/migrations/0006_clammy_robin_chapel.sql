PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_email_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email_id` text,
	`embedding` F32_BLOB(384),
	FOREIGN KEY (`email_id`) REFERENCES `emails`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_email_embeddings`("id", "email_id", "embedding") SELECT "id", "email_id", "embedding" FROM `email_embeddings`;--> statement-breakpoint
DROP TABLE `email_embeddings`;--> statement-breakpoint
ALTER TABLE `__new_email_embeddings` RENAME TO `email_embeddings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `email_embeddings_email_id_unique` ON `email_embeddings` (`email_id`);