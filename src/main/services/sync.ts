import { emailRepository } from './database/email'
import { emailService } from './email'
import { PubSub, Topic, Subscription } from '@google-cloud/pubsub'
import { Notification } from 'electron'
import z from 'zod'
import { peopleRepository } from './database/people'
import { authService, AUTH_EVENTS } from './auth'
import { peopleService } from './people'
import { sendMessageNotification } from '../handlers/events'
import { MessageType } from '@/types/messages'
import { SyncState } from '@/types/sync'
import { Database, DatabaseService } from './database'
import { syncState } from './database/schema'
import { eq } from 'drizzle-orm'
import { GCLOUD_CONFIG } from './config'

const MessageSchema = z.object({
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
  private pubsubTopic: Topic | null = null
  private pubsubSubscription: Subscription | null = null

  private db: Database

  constructor() {
    this.db = DatabaseService.getInstance().getDb()

    authService.on(AUTH_EVENTS.AUTHENTICATED, this._handleAuthentication.bind(this))
    authService.on(AUTH_EVENTS.LOGGED_OUT, this._handleLogout.bind(this))
  }

  private async _handleAuthentication(): Promise<void> {
    if (this.isInitialized) {
      console.debug('SyncService already initialized.')
      return
    }

    this.isInitialized = true
    console.info('Authentication successful, initializing SyncService...')

    try {
      await this.setupPubSubWatch()
      await emailService.initializeHistoryWatch(GCLOUD_CONFIG.SUBSCRIPTION_ENDPOINT)

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

  private async _handleLogout(): Promise<void> {
    console.info('User logged out, stopping sync processes...')
    this.isInitialized = false
    this.isSyncing = false

    if (this.pubsubSubscription) {
      try {
        await this.pubsubSubscription.close()
        console.info('PubSub subscription closed.')
      } catch (error) {
        console.error('Error closing PubSub subscription:', error)
      }
      this.pubsubSubscription = null
    }
    this.pubsubTopic = null

    console.info('Sync processes stopped due to logout.')
  }

  private async initPubSubTopic(): Promise<Topic> {
    if (!this.pubsubTopic) {
      const authClient = await authService.getRefreshClient()
      const pubsub = new PubSub({
        projectId: GCLOUD_CONFIG.PROJECT_ID,
        authClient
      })

      const response = await pubsub
        .createTopic(GCLOUD_CONFIG.TOPIC_NAME)
        .catch((err) => {
          if (err.code === 6) {
            return pubsub.topic(GCLOUD_CONFIG.TOPIC_NAME)
          }
          throw err
        })
        .finally(() => {
          console.info('PubSub topic created')
        })

      if (response instanceof Topic) {
        this.pubsubTopic = response
      } else {
        const [topic] = response
        const [policy] = await topic.iam.getPolicy()

        policy.bindings?.push({
          role: 'roles/pubsub.publisher',
          members: [`serviceAccount:${GCLOUD_CONFIG.SERVICE_ACCOUNT}`]
        })
        await topic.iam.setPolicy(policy)
        this.pubsubTopic = topic
      }
    }

    return this.pubsubTopic
  }

  private async processPubSubMessage(data: MessageData): Promise<void> {
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
      for await (const { added, removedIds } of emailService.listHistory(storedHistory)) {
        await emailRepository.insertEmails(added)
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

  private async setupPubSubWatch(): Promise<void> {
    try {
      const topic = await this.initPubSubTopic()
      let sub: Subscription | null = null

      const response = await topic
        .createSubscription(GCLOUD_CONFIG.SUBSCRIPTION_NAME)
        .catch((err) => {
          if (err.code === 6) {
            return topic.subscription(GCLOUD_CONFIG.SUBSCRIPTION_NAME)
          }
          throw err
        })
        .finally(() => {
          console.info('PubSub subscription created')
        })

      if (response instanceof Subscription) {
        sub = response
      } else {
        const [subscription] = response
        sub = subscription
      }

      this.pubsubSubscription = sub

      sub.on('message', async (message) => {
        try {
          const data = JSON.parse(message.data.toString())
          const parsedData = MessageSchema.parse(data)
          await this.processPubSubMessage(parsedData)
        } catch (error) {
          console.error('Error processing PubSub message:', (error as Error).message)
        } finally {
          message.ack()
        }
      })

      sub.on('error', (error: Error) => {
        console.error('PubSub subscription error:', error)
      })
    } catch (error) {
      console.error('Failed to setup PubSub:', (error as Error).message)
      throw error
    }
  }

  async syncContacts(): Promise<void> {
    if (this.isSyncing) return

    try {
      let pageToken: string | undefined = undefined
      this.isSyncing = true

      do {
        const { connections, nextPageToken } = await peopleService.getContacts(pageToken)
        await peopleRepository.insertContacts(connections)
        pageToken = nextPageToken
      } while (pageToken)
    } catch (error) {
      console.error('People sync failed:', (error as Error).message)
    }
  }

  private async getUserAccountId(): Promise<string | null> {
    const user = await emailService.getProfile()
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
    console.info('[INITIAL SYNC] Performing sync, startPageToken:', startPageToken)
    let pageToken = startPageToken ?? undefined

    try {
      await this.updateSyncState({ syncInProgress: true })
      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Initial sync',
        data: { status: 'started' }
      })

      do {
        const { emails, nextPageToken } = await emailService.listEmails(
          this.SYNC_PAGE_SIZE,
          pageToken
        )

        if (emails.length) {
          await emailRepository.insertEmails(emails)
        }

        console.info(`[INITIAL SYNC] Synced page ${pageToken}: ${emails.length} emails`)
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
      console.error('[INITIAL SYNC] encountered an error:', error)
    } finally {
      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Initial sync',
        data: { status: 'completed' }
      })
    }
  }

  private async performIncrementalSync(lastSyncDate: number): Promise<void> {
    console.info('[INCREMENTAL SYNC] Performing sync')

    try {
      let pageToken: string | undefined = undefined

      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Incremental sync',
        data: { status: 'started' }
      })

      do {
        const { emails, nextPageToken } = await emailService.listEmails(
          this.SYNC_PAGE_SIZE,
          pageToken,
          lastSyncDate
        )

        if (emails.length) await emailRepository.insertEmails(emails)
        console.info(`[INCREMENTAL SYNC] Synced page ${pageToken}: ${emails.length} emails`)
        pageToken = nextPageToken

        if (pageToken) await new Promise((resolve) => setTimeout(resolve, this.SYNC_INTERVAL))
      } while (pageToken)
    } catch (error) {
      console.error('[INCREMENTAL SYNC] encountered an error:', error)
    } finally {
      sendMessageNotification({
        type: MessageType.SYNC_STATUS,
        description: 'Incremental sync',
        data: { status: 'completed' }
      })
    }
  }
}
