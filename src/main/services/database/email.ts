import { eq, desc, asc, inArray, count, sql, and } from 'drizzle-orm'
import { DatabaseService, type Database } from './index'
import {
  emails,
  emailBodies,
  threads,
  emailAttachments,
  configuration,
  emailSummaries,
  categories,
  emailEmbeddings,
  actionItems,
  emailLabels
} from './schema'
import type { Email, EmailThread, NearestNeighbor, Attachment, EmailFolder } from '@/types/email'
import { emailMiddleware } from '../middleware'
import { embeddingService } from '../email/embedding'
import { ActionItem } from '@/types/action-item'
import { BatchProcessor } from '../utils/batch-process'
import { sendEmailNotification } from '../../handlers/events'

// We will replace it with inbox id later
const CONFIG_ID = '1'

export class EmailRepository {
  private db: Database

  constructor() {
    this.db = DatabaseService.getInstance().getDb()
  }

  async markAsArchived(threadIds: string[]): Promise<void> {
    await this.db
      .update(emails)
      .set({ folder: 'ARCHIVE' })
      .where(inArray(emails.threadId, threadIds))
  }

  async markAsRead(emailIds: string[]): Promise<void> {
    await this.db.update(emails).set({ unread: false }).where(inArray(emails.id, emailIds))
  }

  async insertEmails(emailsData: Email[]): Promise<void> {
    if (!emailsData.length) return

    const emailValues = emailsData.map((email) => ({
      ...email,
      syncedAt: Date.now()
    }))

    const bodyValues = emailsData
      .filter((email): email is Email & { body: NonNullable<Email['body']> } => !!email.body)
      .map((email) => {
        emailMiddleware.processEmailBody(email.id, email.body)
        return { ...email.body, emailId: email.id }
      })

    const attachmentValues = emailsData.flatMap(
      (email) =>
        email.attachments?.map((attachment) => ({ emailId: email.id, ...attachment })) ?? []
    )

    try {
      await this.db
        .transaction(async (tx) => {
          const threadIds = [...new Set(emailsData.map((email) => email.threadId))]

          // NOTE: Remove existing summaries for these threads because they are stale
          if (threadIds.length) {
            await tx.delete(emailSummaries).where(inArray(emailSummaries.threadId, threadIds))
          }

          const insertedEmails = await tx
            .insert(emails)
            .values(emailValues)
            .onConflictDoUpdate({
              target: emails.id,
              set: { syncedAt: sql`CURRENT_TIMESTAMP` }
            })
            .returning({ id: emails.id })

          if (bodyValues.length) {
            await tx.insert(emailBodies).values(bodyValues).onConflictDoNothing()
          }

          if (attachmentValues.length) {
            await tx.insert(emailAttachments).values(attachmentValues).onConflictDoNothing()
          }

          return insertedEmails
        })
        .then((emails) => {
          const existingIds = new Set(emails.map((e) => e.id))
          const newEmails = emailsData.filter((email) => existingIds.has(email.id))

          sendEmailNotification(newEmails)
          void this.generateAndStoreEmbeddings(newEmails)
        })
    } catch (error) {
      console.error('Error inserting emails:', error)
    }
  }

  async getAttachment(id: string): Promise<Attachment | null> {
    const result = await this.db
      .select()
      .from(emailAttachments)
      .where(eq(emailAttachments.attachmentId, id))

    return result[0] ?? null
  }

  private async generateAndStoreEmbeddings(emailsData: Email[]): Promise<void> {
    const emailsWithBodies = emailsData.filter(
      (email): email is Email & { body: NonNullable<Email['body']> } => !!email.body
    )

    await BatchProcessor.process(
      emailsWithBodies,
      async (email) => {
        try {
          const embedding = await embeddingService.generateEmailEmbedding(
            email.subject ?? null,
            email.body.html ?? email.body.plain
          )

          if (!embedding.length) return null

          await this.db
            .insert(emailEmbeddings)
            .values({
              emailId: email.id,
              embedding: sql`vector32(${JSON.stringify(embedding)})`
            })
            .onConflictDoUpdate({
              target: emailEmbeddings.emailId,
              set: { embedding }
            })

          console.info(`Generated embedding for email: ${email.id}`)
          return email.id
        } catch (error) {
          console.error(`Error generating embedding for email ${email.id}:`, error)
          return null
        }
      },
      {
        batchSize: 10,
        concurrentBatches: 1,
        onBatchComplete: (results, batchIndex) => {
          console.info(
            `Completed batch ${batchIndex + 1} with ${results.filter(Boolean).length} successful embeddings`
          )
        },
        onItemError: (error, email, index) => {
          console.error(`Error processing email ${email.id} at index ${index}:`, error)
        }
      }
    )
  }

  async emailCount(): Promise<number> {
    const result = await this.db.select({ count: count() }).from(emails)
    return result[0].count ?? 0
  }

  async getActionItems(emailId: string): Promise<ActionItem[]> {
    const result = await this.db.select().from(actionItems).where(eq(actionItems.emailId, emailId))
    return result
  }

  async getLastFullSync(): Promise<number | null> {
    const result = await this.db
      .select({ date: emails.date })
      .from(emails)
      .orderBy(desc(emails.date))
      .limit(1)

    return result[0]?.date ?? null
  }

  async addLabels(emailIds: string[], labelIds: string[]): Promise<void> {
    const values = emailIds.flatMap((emailId) =>
      labelIds.map((labelId) => ({
        emailId,
        labelId
      }))
    )

    if (values.length > 0) {
      await this.db.insert(emailLabels).values(values).onConflictDoNothing()
    }
  }

  async removeLabels(emailIds: string[], labelIds: string[]): Promise<void> {
    await this.db
      .delete(emailLabels)
      .where(and(inArray(emailLabels.emailId, emailIds), inArray(emailLabels.labelId, labelIds)))
  }

  async initialize(): Promise<void> {
    await this.db
      .insert(configuration)
      .values({
        id: CONFIG_ID,
        isInitialized: true
      })
      .onConflictDoUpdate({
        target: configuration.id,
        set: { isInitialized: true }
      })
  }

  async getCategories(): Promise<string[]> {
    const results = await this.db.select({ category: categories.category }).from(categories)
    return results
      .map((result) => result.category)
      .filter((category): category is string => category !== null)
  }

  async getRecentEmails(
    limit: number = 50,
    offset: number = 0,
    folder: EmailFolder | null = null
  ): Promise<Email[]> {
    if (folder && folder !== 'INBOX') {
      const results = await this.db
        .select()
        .from(emails)
        .where(eq(emails.folder, folder))
        .orderBy(desc(emails.date))
        .limit(limit)
        .offset(offset)
      return results
    }

    const results = await this.db
      .select({
        id: threads.id,
        threadId: threads.threadId,
        date: threads.date,
        fromAddress: threads.fromAddress,
        toAddress: threads.toAddress,
        subject: threads.subject,
        snippet: threads.snippet,
        unread: threads.unread,
        category: threads.category,
        labels: sql<string>`GROUP_CONCAT(${emailLabels.labelId})`
      })
      .from(threads)
      .leftJoin(emailLabels, eq(threads.id, emailLabels.emailId))
      .orderBy(desc(threads.date))
      .groupBy(threads.id)
      .limit(limit)
      .offset(offset)

    return results.map((result) => ({
      ...result,
      labels: result.labels ? result.labels.split(',') : []
    }))
  }

  async getUnreadCount(): Promise<number | undefined> {
    const res = await this.db
      .select({ count: count() })
      .from(threads)
      .where(eq(threads.unread, true))

    return res[0]?.count
  }

  async updateEmailSummary(threadId: string, summary: string): Promise<void> {
    await this.db
      .insert(emailSummaries)
      .values({ threadId, summary })
      .onConflictDoUpdate({
        target: emailSummaries.threadId,
        set: { summary, updatedAt: Date.now() }
      })
  }

  async nearestNeighbors(query: string): Promise<NearestNeighbor[]> {
    const embedding = await embeddingService.generateTextEmbedding(query)

    if (!embedding.length) return []

    const results = await this.db
      .select({ body: emailBodies })
      .from(
        sql`vector_top_k('embedding_index', vector32(${JSON.stringify(embedding)}), 5) as top_k`
      )
      .innerJoin(emailEmbeddings, eq(emailEmbeddings.id, sql`top_k.id`))
      .leftJoin(emailBodies, eq(emailBodies.emailId, emailEmbeddings.emailId))

    return results.map(({ body }) => body).filter((body): body is NearestNeighbor => body !== null)
  }

  async getThreadsByEmailIds(emailIds: string[]): Promise<Email[]> {
    const results = await this.db
      .select()
      .from(emails)
      .innerJoin(threads, eq(emails.threadId, threads.threadId))
      .where(inArray(emails.id, emailIds))
      .groupBy(threads.id)

    return results.map((result) => result.threads)
  }

  async deleteEmails(emailIds: string[]): Promise<void> {
    await this.db.delete(emails).where(inArray(emails.id, emailIds))
  }

  async getEmailSummary(threadId: string): Promise<string | null> {
    const result = await this.db
      .select({ summary: emailSummaries.summary })
      .from(emailSummaries)
      .where(eq(emailSummaries.threadId, threadId))

    return result[0]?.summary ?? null
  }

  async getAttachmentByCid(cid: string): Promise<Attachment | null> {
    const data = await this.db
      .select()
      .from(emailAttachments)
      .where(eq(emailAttachments.contentId, cid))
      .limit(1)

    return data[0]
  }

  async getEmailThread(threadId: string): Promise<EmailThread | null> {
    const results = await this.db
      .select({
        email: emails,
        body: emailBodies
      })
      .from(emails)
      .leftJoin(emailBodies, eq(emails.id, emailBodies.emailId))
      .leftJoin(emailLabels, eq(emails.id, emailLabels.emailId))
      .where(eq(emails.threadId, threadId))
      .orderBy(asc(emails.date))

    if (!results.length) return null

    const attachments = await this.db
      .select()
      .from(emailAttachments)
      .where(
        inArray(
          emailAttachments.emailId,
          results.map(({ email }) => email.id)
        )
      )

    return {
      id: threadId,
      messages: results.map(({ email, body }) => ({
        ...email,
        body: {
          html: body?.html.replace(/src=["']cid:/g, 'src="cid://') ?? '',
          plain: body?.html ?? ''
        },
        attachments: attachments.filter((attachment) => attachment.emailId === email.id)
      }))
    }
  }

  async getLastHistoryRecord(): Promise<number | null> {
    const result = await this.db
      .select({ historyId: emails.historyId })
      .from(emails)
      .orderBy(desc(emails.historyId))
      .limit(1)

    return result[0]?.historyId ?? null
  }
}

export const emailRepository = new EmailRepository()
