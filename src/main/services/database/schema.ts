import { EmailHeader } from '@/types/email'
import { sql } from 'drizzle-orm'
import {
  sqliteTable,
  text,
  integer,
  sqliteView,
  blob,
  customType,
  primaryKey,
  index
} from 'drizzle-orm/sqlite-core'

const float32Array = customType<{
  data: number[]
  config: { dimensions: number }
  configRequired: true
  driverData: Buffer
}>({
  dataType(config) {
    return `F32_BLOB(${config.dimensions})`
  },
  fromDriver(value: Buffer) {
    return Array.from(new Float32Array(value.buffer))
  },
  toDriver(value: number[]) {
    return sql`vector32(${JSON.stringify(value)})`
  }
})

export const emailFolderEnum = [
  'INBOX',
  'SENT',
  'DRAFTS',
  'ARCHIVE',
  'TRASH',
  'SPAM',
  'OUTBOX'
] as const

export const emails = sqliteTable(
  'emails',
  {
    id: text('id').primaryKey(),
    threadId: text('thread_id').notNull(),
    fromAddress: text('from_address').notNull(),
    headers: text('headers', { mode: 'json' }).$type<EmailHeader[] | null>(),
    toAddress: text('to_address').notNull(),
    subject: text('subject'),
    snippet: text('snippet'),
    historyId: integer('history_id'),
    labelIds: text('label_ids', { mode: 'json' }).$type<string[] | null>(),
    date: integer('date').notNull(),
    unread: integer('unread', { mode: 'boolean' }).notNull().default(true),
    draft: integer('draft', { mode: 'boolean' }).notNull().default(false),
    folder: text('folder', { enum: emailFolderEnum }).notNull().default('INBOX'),
    syncedAt: integer('synced_at').notNull()
  },
  (table) => [index('email_folder_idx').on(table.folder)]
)

export const emailLabels = sqliteTable(
  'email_labels',
  {
    emailId: text('email_id').references(() => emails.id, { onDelete: 'cascade' }),
    labelId: text('label_id').notNull(),
    description: text('description')
  },
  (table) => [primaryKey({ columns: [table.emailId, table.labelId] })]
)

export const syncState = sqliteTable('sync_state', {
  id: text('id')
    .primaryKey()
    .$default(() => 'gmail_sync'),
  initialSyncComplete: integer('initial_sync_complete', { mode: 'boolean' }).default(false),
  lastSyncPageToken: text('last_sync_page_token'),
  lastSyncDate: integer('last_sync_date'),
  syncInProgress: integer('sync_in_progress', { mode: 'boolean' }).default(false),
  updatedAt: integer('updated_at')
    .notNull()
    .$default(() => Date.now())
})

export const emailEmbeddings = sqliteTable('email_embeddings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  emailId: text('email_id')
    .unique()
    .references(() => emails.id, { onDelete: 'cascade' }),
  embedding: float32Array('embedding', { dimensions: 384 })
})

export const emailBodies = sqliteTable('email_bodies', {
  emailId: text('email_id')
    .primaryKey()
    .references(() => emails.id, { onDelete: 'cascade' }),
  html: text('html').notNull(),
  plain: text('plain').notNull()
})

export const emailSummaries = sqliteTable('email_summaries', {
  threadId: text('thread_id').primaryKey(),
  summary: text('summary').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
})

export const actionItems = sqliteTable('action_items', {
  id: text('id').primaryKey(),
  emailId: text('email_id')
    .references(() => emails.id, { onDelete: 'cascade' })
    .notNull(),
  description: text('description').notNull(),
  dueDate: text('due_date'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
})

export const middlewareResults = sqliteTable('middleware_results', {
  id: text('id').primaryKey(),
  middlewareId: text('middleware_id').notNull(),
  emailId: text('email_id').references(() => emails.id, { onDelete: 'cascade' }),
  result: text('result', { mode: 'json' }).notNull()
})

export const emailAttachments = sqliteTable('email_attachments', {
  emailId: text('email_id').references(() => emails.id, { onDelete: 'cascade' }),
  attachmentId: text('attachment_id').primaryKey().notNull(),
  mimeType: text('mime_type').notNull(),
  fileName: text('file_name').unique().notNull(),
  contentId: text('content_id'),
  data: blob('data').$type<Buffer>()
})

export const configuration = sqliteTable('configuration', {
  id: text('id').primaryKey(),
  isInitialized: integer('is_initialized', { mode: 'boolean' }).notNull().default(false),
  lastFullSync: integer('last_full_sync')
})

export const people = sqliteTable('people', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  photoUrl: text('photo_url'),
  notes: text('notes'),
  createdAt: integer('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
})

export const emailAddresses = sqliteTable('email_addresses', {
  id: text('id').primaryKey(),
  personId: text('person_id').references(() => people.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique()
})

export const categories = sqliteView('categories', {
  category: text('category')
}).as(sql`
  WITH extracted_categories AS (
    SELECT DISTINCT value as category
    FROM ${emails}, json_each(${emails}.label_ids)
    WHERE label_ids IS NOT NULL
      AND value LIKE 'CATEGORY_%'
  )
  SELECT category
  FROM extracted_categories
`)

export const threads = sqliteView('threads', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull(),
  headers: text('headers', { mode: 'json' }).$type<EmailHeader[] | null>(),
  fromAddress: text('from_address').notNull(),
  toAddress: text('to_address').notNull(),
  subject: text('subject'),
  snippet: text('snippet'),
  date: integer('date').notNull(),
  unread: integer('unread', { mode: 'boolean' }).notNull(),
  syncedAt: integer('synced_at').notNull(),
  labelIds: text('label_ids', { mode: 'json' }).$type<string[] | null>(),
  category: text('category'),
  draft: integer('draft', { mode: 'boolean' }).notNull().default(false),
  folder: text('folder', { enum: emailFolderEnum }).notNull().default('INBOX')
}).as(sql`WITH latest_emails AS (
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
  folder,
  category
FROM latest_emails
WHERE rn = 1
ORDER BY date DESC
`)
