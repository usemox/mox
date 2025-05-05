import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import { AuthClient } from '../auth'
import {
  nonNullEmail,
  type AttachmentFileData,
  type Email,
  type EmailOptions,
  type HistoryBatch
} from '@/types/email'
import {
  parseGmailMessage,
  parseEmailHeaders,
  decodeBase64,
  getFolderFromGmailLabels
} from './utils'
import { CustomEmailError } from './error'
import { format } from 'date-fns'
import { packageEmailContent } from '../utils/package-mail'

export class EmailService {
  id: string
  emailAddress: string
  client: gmail_v1.Gmail

  constructor(id: string, emailAddress: string, authClient: AuthClient) {
    if (!emailAddress || !id) {
      throw new Error('EmailService requires a valid email address and id.')
    }
    this.id = id
    this.emailAddress = emailAddress
    this.client = google.gmail({ version: 'v1', auth: authClient })
    console.log(`EmailService instance created for: ${this.emailAddress}`)
  }

  /**
   * Retry an operation
   * @param operation - The operation to retry
   * @param retries - The number of retries
   * @param delay - The delay between retries
   * @returns The result of the operation
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        return this.retryOperation(operation, retries - 1, delay * 2)
      }
      console.error(error)
      throw new CustomEmailError('Operation failed after retries', { cause: error })
    }
  }

  /**
   * Check if an error is retryable
   * @param error - The error
   * @returns True if the error is retryable, false otherwise
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      return error.message.includes('429') || error.message.includes('503')
    }
    return false
  }

  /**
   * Initialize a history watch for this account's inbox.
   */
  async initializeHistoryWatch(
    topicName: string
  ): Promise<{ historyId?: string; expiration?: string }> {
    return this.retryOperation(async () => {
      const watchResponse = await this.client.users.watch({
        userId: 'me',
        requestBody: {
          labelFilterBehavior: 'include',
          topicName
        }
      })

      const { historyId, expiration } = watchResponse.data
      return {
        historyId: historyId ?? undefined,
        expiration: expiration ?? undefined
      }
    })
  }

  /**
   * List history records for this account.
   * @param startHistoryId - The ID of the history record to start from for this account.
   */
  async *listHistory(startHistoryId: number): AsyncGenerator<HistoryBatch, void, void> {
    const LIST_TIMEOUT = 5000
    let pageToken: string | undefined = undefined

    try {
      do {
        const response = await this.retryOperation(() =>
          this.client.users.history.list({
            userId: 'me',
            startHistoryId: startHistoryId.toString(),
            pageToken
          })
        )

        const historyRecords = response.data.history ?? []

        const batchResults = await Promise.all(
          historyRecords.map((record) => this.processHistoryRecord(record))
        )

        const batch: HistoryBatch = { added: [], removedIds: [] }

        for (const result of batchResults) {
          batch.added.push(...result.added)
          batch.removedIds.push(...result.removedIds)
        }

        batch.added.sort((a, b) => b.date - a.date)

        console.info(
          `[${this.emailAddress}] Processed history page, ${historyRecords.length} records`
        )

        yield batch

        pageToken = response.data.nextPageToken ?? undefined

        if (pageToken) {
          await new Promise((resolve) => setTimeout(resolve, LIST_TIMEOUT))
        }
      } while (pageToken)
    } catch (error) {
      console.error(`[${this.emailAddress}] Failed to list history:`, error)
      yield { added: [], removedIds: [] }
    }
  }

  /**
   * Send an email from this account.
   * The 'from' address is implicitly this account's email.
   */
  async sendEmailWithAttachments(
    to: string | string[],
    subject: string,
    htmlBody: string,
    attachments: AttachmentFileData[] = [],
    options: EmailOptions = {}
  ): Promise<string | null | undefined> {
    try {
      const toAddresses = Array.isArray(to) ? to.join(', ') : to

      const cc = options.cc
        ? Array.isArray(options.cc)
          ? options.cc.join(', ')
          : options.cc
        : undefined

      const bcc = options.bcc
        ? Array.isArray(options.bcc)
          ? options.bcc.join(', ')
          : options.bcc
        : undefined

      const references =
        options.headers?.find((header) => header.name === 'References')?.value ?? undefined
      const inReplyTo =
        options.headers?.find((header) => header.name === 'In-Reply-To')?.value ?? undefined

      const from = this.emailAddress

      const rawContent = packageEmailContent({
        to: toAddresses,
        from,
        cc,
        bcc,
        subject,
        references,
        inReplyTo,
        htmlBody,
        attachments
      })

      const response = await this.retryOperation(() =>
        this.client.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawContent, threadId: options.threadId }
        })
      )

      return response.data.id
    } catch (error) {
      console.error(`[${this.emailAddress}] Error sending email:`, error)
      throw new CustomEmailError('Failed to send email with attachments', error as Error)
    }
  }

  /**
   * Process a history record for this account.
   */
  private async processHistoryRecord(record: gmail_v1.Schema$History): Promise<HistoryBatch> {
    const commit: HistoryBatch = { added: [], removedIds: [] }

    if (record.messagesAdded) {
      const validMessages = record.messagesAdded
        .map(({ message }) => message)
        .filter((message): message is NonNullable<typeof message> => message?.id != null)

      const emails = await Promise.all(validMessages.map((message) => this.getEmail(message)))
      commit.added = emails.filter(nonNullEmail)
    }

    if (record.messagesDeleted) {
      commit.removedIds = record.messagesDeleted
        .map(({ message }) => message?.id)
        .filter((id): id is string => id != null)
    }

    return commit
  }

  /**
   * Get attachment data for an email in this account.
   */
  async getAttachmentData({ id, messageId }: { id: string; messageId: string }): Promise<Buffer> {
    const response = await this.client.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id
    })

    const data = response.data.data ?? ''

    return decodeBase64(data)
  }

  /**
   * Get email details for this account.
   */
  private async getEmail({
    id,
    threadId
  }: Pick<gmail_v1.Schema$Message, 'id' | 'threadId'>): Promise<Email | null> {
    if (!id) return null

    try {
      const response = await this.retryOperation(() =>
        this.client.users.messages.get({
          userId: 'me',
          id,
          format: 'full'
        })
      )

      const message = response.data
      if (!message) return null

      const body = parseGmailMessage(message)

      const attachments = await Promise.all(
        body.attachments.map(async (att) => {
          att.data = await this.getAttachmentData({ id: att.attachmentId, messageId: id })
          return att
        })
      )

      const { labelIds, historyId, payload } = message
      const headers = payload?.headers ?? []
      const { from, subject, date, to } = parseEmailHeaders(headers)
      const unread = !!labelIds?.includes('UNREAD')

      const folder = getFolderFromGmailLabels(labelIds)

      return {
        id,
        fromAddress: from,
        toAddress: to,
        subject,
        historyId: historyId ? parseInt(historyId) : null,
        labelIds,
        headers,
        threadId: threadId ?? id,
        date: new Date(date).getTime(),
        snippet: message.snippet?.trim() ?? '',
        unread,
        folder,
        attachments,
        body: {
          html: body.html,
          plain: body.text
        }
      }
    } catch (error) {
      console.error(`[${this.emailAddress}] Failed to get email ${id}:`, error)
      return null
    }
  }

  /**
   * Get approximate email count for this account.
   */
  async emailCount(): Promise<number> {
    const response = await this.client.users.getProfile({ userId: 'me' })
    return response.data.messagesTotal ?? 0
  }

  /**
   * List emails for this account.
   */
  async listEmails(
    maxResults = 50,
    pageToken?: string,
    startDate?: number
  ): Promise<{ emails: Email[]; nextPageToken?: string }> {
    return this.retryOperation(async () => {
      const response = await this.client.users.messages.list({
        userId: 'me',
        q: startDate ? `after:${format(startDate, 'yyyy/MM/dd')}` : undefined,
        maxResults,
        pageToken
      })

      if (!response.data.messages?.length) return { emails: [] }

      const emails = await Promise.all(
        response.data.messages.map((message) => this.getEmail(message))
      ).then((emails) => emails.filter(nonNullEmail))

      return {
        emails,
        nextPageToken: response.data.nextPageToken ?? undefined
      }
    })
  }

  /**
   * Get profile info for this account.
   */
  async getProfile(): Promise<gmail_v1.Schema$Profile | null> {
    try {
      const profile = await this.client.users.getProfile({
        userId: 'me'
      })
      return profile.data
    } catch (error) {
      console.error(`[${this.emailAddress}] Failed to fetch profile:`, error)
      return null
    }
  }

  /**
   * Archive an email for this account.
   */
  async archiveEmail(emailId: string): Promise<void> {
    try {
      await this.client.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: ['INBOX']
        }
      })
    } catch (error) {
      console.error(`[${this.emailAddress}] Error archiving email:`, error)
      throw error
    }
  }
}
