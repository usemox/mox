import { emailRepository } from './database/email'
import { PubSub, Topic, Subscription } from '@google-cloud/pubsub'
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
import secretsManager from './secrets'
import { GCLOUD_CONFIG_KEYS } from '@/types/config'
import { EmailService } from './email'
import { AuthClient } from './auth'

const MessageSchema = z.object({
  historyId: z.number(),
  expiration: z.string().optional()
})

type MessageData = z.infer<typeof MessageSchema>

type GCloudConfig = {
  GCLOUD_PROJECT_ID: string
  GCLOUD_TOPIC_NAME: string
  GCLOUD_SUBSCRIPTION_NAME: string
  GCLOUD_SUBSCRIPTION_ENDPOINT: string
}

const GMAIL_SERVICE_ACCOUNT = 'gmail-api-push@system.gserviceaccount.com'

export class SyncService {
  // TODO: Make these smarter, backoff, batching, parallalization etc.
  private isSyncing = false
  private isInitialized = false

  private readonly SYNC_PAGE_SIZE = 10
  private readonly SYNC_INTERVAL = 1000 * 10

  private pubsubTopic: Topic | null = null
  private pubsubSubscription: Subscription | null = null

  private db: Database
  private emailService: EmailService
  private peopleService: PeopleService
  private authClient: AuthClient

  private config: GCloudConfig | null = null

  constructor(
    db: Database,
    emailService: EmailService,
    authClient: AuthClient,
    peopleService: PeopleService
  ) {
    this.db = db
    this.emailService = emailService
    this.authClient = authClient
    this.peopleService = peopleService
  }

  private async getConfig(): Promise<GCloudConfig> {
    if (this.config) return this.config

    const projectId = await secretsManager.getCredential(GCLOUD_CONFIG_KEYS.PROJECT_ID)
    const topicName = await secretsManager.getCredential(GCLOUD_CONFIG_KEYS.TOPIC_NAME)
    const subscriptionName = await secretsManager.getCredential(
      GCLOUD_CONFIG_KEYS.SUBSCRIPTION_NAME
    )

    if (!projectId || !topicName || !subscriptionName) {
      throw new Error('Missing required GCloud config')
    }

    const accountTopicName = `${topicName}-${this.emailService.id}`
    const accountSubscriptionName = `${subscriptionName}-${this.emailService.id}`

    this.config = {
      GCLOUD_PROJECT_ID: projectId,
      GCLOUD_TOPIC_NAME: accountTopicName,
      GCLOUD_SUBSCRIPTION_NAME: accountSubscriptionName,
      GCLOUD_SUBSCRIPTION_ENDPOINT: `projects/${projectId}/topics/${accountTopicName}`
    }

    return this.config
  }

  async startSync(): Promise<void> {
    if (this.isInitialized) {
      console.debug('SyncService already initialized.')
      return
    }

    this.isInitialized = true

    try {
      await this.setupPubSubWatch()
      const config = await this.getConfig()
      await this.emailService.initializeHistoryWatch(config.GCLOUD_SUBSCRIPTION_ENDPOINT)

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
      const config = await this.getConfig()
      const pubsub = new PubSub({
        projectId: config.GCLOUD_PROJECT_ID,
        authClient: this.authClient
      })

      const response = await pubsub
        .createTopic(config.GCLOUD_TOPIC_NAME)
        .catch((err) => {
          if (err.code === 6) {
            return pubsub.topic(config.GCLOUD_TOPIC_NAME)
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
          members: [`serviceAccount:${GMAIL_SERVICE_ACCOUNT}`]
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

  private async setupPubSubWatch(): Promise<void> {
    try {
      const topic = await this.initPubSubTopic()
      let sub: Subscription | null = null
      const config = await this.getConfig()

      const response = await topic
        .createSubscription(config.GCLOUD_SUBSCRIPTION_NAME)
        .catch((err) => {
          if (err.code === 6) {
            return topic.subscription(config.GCLOUD_SUBSCRIPTION_NAME)
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
        const { emails, nextPageToken } = await this.emailService.listEmails(
          this.SYNC_PAGE_SIZE,
          pageToken
        )

        if (emails.length) {
          await emailRepository.insertEmails(emails, this.emailService.id)
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
        const { emails, nextPageToken } = await this.emailService.listEmails(
          this.SYNC_PAGE_SIZE,
          pageToken,
          lastSyncDate
        )

        if (emails.length) await emailRepository.insertEmails(emails, this.emailService.id)
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
