import { google } from 'googleapis'
import type { gmail_v1 } from 'googleapis'
import { authService } from '../auth'
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

class GmailService {
  private gmail: gmail_v1.Gmail | null = null
  private readonly CACHE_TTL = 5 * 60 * 1000

  private clientExpiryTime: number = 0

  /**
   * Get a Gmail client
   * @returns The Gmail client
   */
  private async getGmailClient(): Promise<gmail_v1.Gmail> {
    const now = Date.now()
    if (!this.gmail || now > this.clientExpiryTime) {
      const auth = await authService.getAuthenticatedClient()
      this.gmail = google.gmail({ version: 'v1', auth })
      this.clientExpiryTime = now + this.CACHE_TTL
    }
    return this.gmail
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
   * Initialize a history watch for the user's inbox
   * @returns The history ID and expiration time
   */
  async initializeHistoryWatch(
    topicName: string
  ): Promise<{ historyId?: string; expiration?: string }> {
    const gmail = await this.getGmailClient()

    return this.retryOperation(async () => {
      const watchResponse = await gmail.users.watch({
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
   * List history records from the user's inbox
   * @param startHistoryId - The ID of the history record to start from
   * @returns An array of history records
   */
  async *listHistory(startHistoryId: number): AsyncGenerator<HistoryBatch, void, void> {
    const LIST_TIMEOUT = 5000
    const gmail = await this.getGmailClient()
    let pageToken: string | undefined = undefined

    try {
      do {
        const response = await this.retryOperation(() =>
          gmail.users.history.list({
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

        console.info(`Processed a page with ${historyRecords.length} records`)

        yield batch

        pageToken = response.data.nextPageToken ?? undefined

        if (pageToken) {
          await new Promise((resolve) => setTimeout(resolve, LIST_TIMEOUT))
        }
      } while (pageToken)
    } catch (error) {
      console.error('Failed to list history:', error)
      yield { added: [], removedIds: [] }
    }
  }

  /**
   * Send an email with attachments using Gmail API
   * @param to - Recipient email address(es)
   * @param subject - Email subject
   * @param htmlBody - HTML content of the email
   * @param attachments - Array of file attachments
   * @param options - Additional email options (cc, bcc, from, replyTo, threadId, etc.)
   * @returns The sent message ID
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

      const gmail = await this.getGmailClient()
      const profile = await gmail.users.getProfile({ userId: 'me' })
      const from = profile.data.emailAddress

      if (!from) {
        throw new CustomEmailError('Failed to get from address')
      }

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
        gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawContent, threadId: options.threadId }
        })
      )

      return response.data.id
    } catch (error) {
      console.error('Error sending email with attachments:', error)
      throw new CustomEmailError('Failed to send email with attachments', error as Error)
    }
  }

  /**
   * Process a history record and return the emails
   * @param record - The history record
   * @returns The emails
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

  async getAttachmentData({ id, messageId }: { id: string; messageId: string }): Promise<Buffer> {
    const gmail = await this.getGmailClient()
    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id
    })

    const data = response.data.data ?? ''

    return decodeBase64(data)
  }

  /**
   * Get an email from the user's inbox
   * @param id - The ID of the email
   * @param threadId - The ID of the thread the email belongs to
   * @returns The email
   */
  private async getEmail({
    id,
    threadId
  }: Pick<gmail_v1.Schema$Message, 'id' | 'threadId'>): Promise<Email | null> {
    if (!id) throw new CustomEmailError('Invalid message ID')

    try {
      const gmail = await this.getGmailClient()

      const email = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full'
      })

      const { labelIds, historyId, payload } = email.data
      const headers = payload?.headers ?? []
      const { from, subject, date, to } = parseEmailHeaders(headers)
      const unread = !!labelIds?.includes('UNREAD')

      const folder = getFolderFromGmailLabels(labelIds)
      const body = parseGmailMessage(email.data)

      // Fetch attachment data
      const attachments = await Promise.all(
        body.attachments.map(async (att) => {
          att.data = await this.getAttachmentData({ id: att.attachmentId, messageId: id })
          return att
        })
      )

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
        snippet: email.data.snippet?.trim() ?? '',
        unread,
        folder,
        attachments,
        body: {
          html: body.html,
          plain: body.text
        }
      }
    } catch (error) {
      console.error('Error getting email:', error)
      return null
    }
  }

  /**
   * Get the total number of emails in the user's inbox
   * @returns The total number of emails
   */
  async emailCount(): Promise<number> {
    const gmail = await this.getGmailClient()
    const response = await gmail.users.getProfile({ userId: 'me' })
    return response.data.messagesTotal ?? 0
  }

  /**
   * List emails from the user's inbox
   * @param maxResults - Maximum number of emails to return
   * @param pageToken - Token to continue listing emails from a specific point
   * @returns An array of emails and a nextPageToken if there are more emails to fetch
   */
  async listEmails(
    maxResults = 50,
    pageToken?: string,
    startDate?: number
  ): Promise<{ emails: Email[]; nextPageToken?: string }> {
    const gmail = await this.getGmailClient()

    return this.retryOperation(async () => {
      const response = await gmail.users.messages.list({
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

  async getProfile(): Promise<gmail_v1.Schema$Profile | null> {
    try {
      const gmail = await this.getGmailClient()
      const profile = await gmail.users.getProfile({
        userId: 'me'
      })
      return profile.data
    } catch (e) {
      console.error('Failed to fetch profile', e)
      return null
    }
  }

  /**
   * Archive an email from the user's inbox
   * @param emailId - The ID of the email to archive
   */
  async archiveEmail(emailId: string): Promise<void> {
    try {
      const gmail = await this.getGmailClient()

      await gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: {
          removeLabelIds: ['INBOX']
        }
      })
    } catch (error) {
      console.error('Error archiving email:', (error as Error).message)
      throw error
    }
  }
}

export const emailService = new GmailService()
