export interface Email {
  id: string
  threadId: string
  historyId?: number | null
  labels?: string[] | null
  labelIds?: string[] | null
  fromAddress: string
  toAddress: string
  subject: string | null
  date: number
  snippet: string | null
  unread: boolean
  body?: EmailBody | null
  headers?: EmailHeader[] | null
  attachments?: Attachment[]
  syncedAt?: number
  folder?: EmailFolder

  // Used by local store only
  selected?: boolean
}

export const emailFolderEnum = [
  'INBOX',
  'SENT',
  'DRAFTS',
  'ARCHIVE',
  'TRASH',
  'SPAM',
  'OUTBOX'
] as const

export type EmailFolder = (typeof emailFolderEnum)[number]

export interface AttachmentFileData {
  name: string
  content: Buffer
  type: string
}

export interface EmailOptions {
  cc?: string | string[]
  bcc?: string | string[]
  headers?: EmailHeader[] | null
  threadId?: string
}

export interface EmailHeader {
  name?: string | null
  value?: string | null
}

export interface Attachment {
  mimeType: string
  fileName: string
  data?: Buffer | null
  contentId?: string | null
  attachmentId: string
}

export interface EmailBody {
  html: string
  plain: string
}

export interface NearestNeighbor {
  html: string
  plain: string
  emailId: string
}

export interface EmailThread {
  id: string
  messages: Email[]
}

export interface HistoryBatch {
  added: Email[]
  removedIds: string[]
}

export interface Profile {
  email?: string
  unreadEmails?: number
}

export const nonNullEmail = (email: Email | null): email is Email => email !== null
