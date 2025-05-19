import { emailRepository } from './database/email'
import { Notification } from 'electron'
import { z } from 'zod'
import { peopleRepository } from './database/people'
import { PeopleService } from './people'
import { sendMessageNotification } from '../handlers/events'
import { MessageType } from '@/types/messages'
import { SyncState } from '@/types/sync'
import { Database } from './database'
import { syncState } from './database/schema'
import { eq } from 'drizzle-orm'
import { EmailService } from './email'

export const MessageSchema = z.object({
  historyId: z.number(),
  expiration: z.string().optional()
})

type MessageData = z.infer<typeof MessageSchema>

export class SyncService {
  // TODO: Make these smarter, backoff, batching, parallalization etc.
  private isSyncing = false
  private isInitialized = false

  private readonly SYNC_PAGE_SIZE = 10
  private readonly SYNC_INTERVAL = 1000 * 10

  private db: Database
  private emailService: EmailService
  private peopleService: PeopleService

  constructor(db: Database, emailService: EmailService, peopleService: PeopleService) {
    this.db = db
    this.emailService = emailService
    this.peopleService = peopleService
  }

  async startSync(): Promise<void> {
    if (this.isInitialized) {
      console.debug('SyncService already initialized.')
      return
    }

    this.isInitialized = true

    try {
      const state = await this.getSyncState()
      const initialSyncComplete = state?.initialSyncComplete ?? false
      const lastSyncPageToken = state?.lastSyncPageToken ?? undefined
      const lastEmailDate = await emailRepository.getLastFullSync()

      if (lastEmailDate) {
        await this.performIncrementalSync(lastEmailDate)
      }

      if (!initialSyncComplete) {
        await this.performInitialSync(lastSyncPageToken)
      }

      await this.syncContacts()
      console.info('SyncService initialization complete.')
    } catch (error) {
      console.error('SyncService initialization failed:', error)
      this.isInitialized = false
    }
  }

  async stopSync(): Promise<void> {
    console.info('User logged out, stopping sync processes...')
    this.isInitialized = false
    this.isSyncing = false
    console.info('Sync processes stopped due to logout.')
  }

  async processPubSubMessage(data: MessageData): Promise<void> {
    const historyId = data.historyId
    const storedHistory = await emailRepository.getLastHistoryRecord()

    if (!storedHistory) {
      console.info('No previous history found, storing new history')
      return
    }

    if (storedHistory === historyId) {
      console.info('History already synced')
      return
    }

    try {
      for await (const { added, removedIds } of this.emailService.listHistory(storedHistory)) {
        await emailRepository.insertEmails(added, this.emailService.id)
        await emailRepository.deleteEmails(removedIds)

        if (added.length > 0) {
          new Notification({
            title: 'Mailbox on fire!',
            body: `${added.length} new emails added`
          }).show()
        }
        console.info('Synced history batch:', storedHistory)
      }
    } catch (error) {
      console.error('Error processing PubSub message:', (error as Error).message)
    }
  }

  async syncContacts(): Promise<void> {
    if (this.isSyncing) return

    try {
      let pageToken: string | undefined = undefined
      this.isSyncing = true

      do {
        const { connections, nextPageToken } = await this.peopleService.getContacts(pageToken)
        await peopleRepository.insertContacts(connections)
        pageToken = nextPageToken
      } while (pageToken)
    } catch (error) {
      console.error('People sync failed:', (error as Error).message)
    }
  }

  private async getUserAccountId(): Promise<string | null> {
    const user = await this.emailService.getProfile()
    return user?.emailAddress ?? null
  }

  private async getSyncState(): Promise<SyncState | null> {
    const accountId = await this.getUserAccountId()
    if (!accountId) return null

    const state = await this.db.select().from(syncState).where(eq(syncState.id, accountId)).limit(1)

    return state[0]
  }

  private async updateSyncState(updates: Partial<Omit<SyncState, 'id'>>): Promise<void> {
    const accountId = await this.getUserAccountId()
    if (!accountId) return

    const valuesToInsert = {
      id: accountId,
      ...updates
    }

    await this.db.insert(syncState).values(valuesToInsert).onConflictDoUpdate({
      target: syncState.id,
      set: updates
    })
  }

  private async performInitialSync(startPageToken?: string): Promise<void> {
    console.info(
      `[INITIAL SYNC ${this.emailService.emailAddress}] Performing sync, startPageToken: ${startPageToken}`
    )
    let pageToken = startPageToken ?? undefined

    try {
      await this.updateSyncState({ syncInProgress: true })
      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Initial sync',
        data: { status: 'started' }
      })

      do {
        const { emails, nextPageToken } = await this.emailService.listEmails(
          this.SYNC_PAGE_SIZE,
          pageToken
        )

        if (emails.length) {
          await emailRepository.insertEmails(emails, this.emailService.id)
        }

        console.info(
          `[INITIAL SYNC ${this.emailService.emailAddress}] Synced page ${pageToken}: ${emails.length} emails`
        )
        pageToken = nextPageToken

        if (pageToken) {
          await this.updateSyncState({
            lastSyncPageToken: pageToken
          })
          await new Promise((resolve) => setTimeout(resolve, this.SYNC_INTERVAL))
        }
      } while (pageToken)

      await this.updateSyncState({
        initialSyncComplete: true,
        syncInProgress: false,
        lastSyncDate: Date.now()
      })
    } catch (error) {
      await this.updateSyncState({ syncInProgress: false })
      console.error(`[INITIAL SYNC ${this.emailService.emailAddress}] encountered an error:`, error)
    } finally {
      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Initial sync',
        data: { status: 'completed' }
      })
    }
  }

  private async performIncrementalSync(lastSyncDate: number): Promise<void> {
    console.info(
      `[INCREMENTAL SYNC ${this.emailService.emailAddress}] Performing sync, lastSyncDate: ${lastSyncDate}`
    )

    try {
      let pageToken: string | undefined = undefined

      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Incremental sync',
        data: { status: 'started' }
      })

      do {
        const { emails, nextPageToken } = await this.emailService.listEmails(
          this.SYNC_PAGE_SIZE,
          pageToken,
          lastSyncDate
        )

        if (emails.length) await emailRepository.insertEmails(emails, this.emailService.id)
        console.info(
          `[INCREMENTAL SYNC ${this.emailService.emailAddress}] Synced page ${pageToken}: ${emails.length} emails`
        )
        pageToken = nextPageToken

        if (pageToken) await new Promise((resolve) => setTimeout(resolve, this.SYNC_INTERVAL))
      } while (pageToken)
    } catch (error) {
      console.error(
        `[INCREMENTAL SYNC ${this.emailService.emailAddress}] encountered an error:`,
        error
      )
    } finally {
      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Incremental sync',
        data: { status: 'completed' }
      })
    }
  }
}
