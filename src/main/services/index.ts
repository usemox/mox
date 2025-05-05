import { google } from 'googleapis'
import { AuthClient, authService } from './auth'
import { Database, DatabaseService } from './database'
import { linkedAccounts } from './database/schema'
import { EmailService } from './email'
import { PeopleService } from './people'
import { SyncService } from './sync'
import { ulid } from 'ulid'

/**
 * Interface defining the set of services associated with a single linked account.
 */
interface AccountServices {
  authClient: AuthClient
  emailService: EmailService
  peopleService: PeopleService
  syncService: SyncService
}

export class AccountService {
  private activeAccounts: Map<string, AccountServices> = new Map()
  private db: Database
  private static instance: AccountService | null = null

  constructor() {
    this.db = DatabaseService.getInstance().getDb()
  }

  public static getInstance(): AccountService {
    if (!AccountService.instance) {
      AccountService.instance = new AccountService()
    }

    return AccountService.instance
  }

  async loadPersistedAccounts(): Promise<void> {
    try {
      const accounts = await this.db.select().from(linkedAccounts)

      for (const account of accounts) {
        const authClient = await authService.getRefreshClient(account.emailAddress)
        await this.addAccount(authClient)
      }
    } catch (error) {
      console.error('Failed to load persisted accounts:', error)
    }
  }

  async addAccount(authClient: AuthClient): Promise<string | null> {
    try {
      const profile = await google.gmail({ version: 'v1', auth: authClient }).users.getProfile({
        userId: 'me'
      })

      const emailAddress = profile.data.emailAddress
      const accountId = ulid()

      if (!emailAddress) {
        console.error('Failed to retrieve profile for the account using provided AuthClient.')
        return null
      }

      if (this.activeAccounts.has(emailAddress)) {
        console.log(
          `Account ${emailAddress} is already active in AccountService. Updating AuthClient.`
        )
        const existingServices = this.activeAccounts.get(emailAddress)!
        existingServices.authClient = authClient
        return emailAddress
      }

      const emailService = new EmailService(accountId, emailAddress, authClient)
      const peopleService = new PeopleService(authClient)
      const syncService = new SyncService(this.db, emailService, authClient, peopleService)

      const services: AccountServices = {
        authClient,
        emailService,
        peopleService,
        syncService
      }

      try {
        await this.db
          .insert(linkedAccounts)
          .values({
            id: accountId,
            emailAddress,
            lastHistoryId: null
          })
          .onConflictDoUpdate({
            target: linkedAccounts.id,
            set: { emailAddress }
          })
        console.log(`Account ${accountId} persisted/updated in database by AccountService.`)
        this.activeAccounts.set(accountId, services)
      } catch (dbError) {
        console.error(`Database error persisting account ${accountId} in AccountService:`, dbError)
        this.activeAccounts.delete(emailAddress)
        throw dbError
      }

      return accountId
    } catch (error) {
      console.error('Failed to add account:', error)
      return null
    }
  }

  async removeAccount(emailAddress: string): Promise<void> {
    const services = this.activeAccounts.get(emailAddress)
    if (services) {
      try {
        await services.syncService.stopSync()
      } catch (syncError) {
        console.error(
          `Error stopping sync service for account ${emailAddress} during removal:`,
          syncError
        )
      }

      try {
        await authService.removeAccount(emailAddress)
      } catch (authError) {
        console.error(`Error during authService.removeAccount for ${emailAddress}:`, authError)
      } finally {
        this.activeAccounts.delete(emailAddress)
      }
    } else {
      try {
        console.log(
          `Attempting cleanup via authService for potentially orphaned account: ${emailAddress}`
        )
        await authService.removeAccount(emailAddress)
      } catch (cleanupError) {
        if (
          !(
            cleanupError instanceof Error && cleanupError.message.includes('Could not find account')
          )
        ) {
          console.error(`Error during authService cleanup check for ${emailAddress}:`, cleanupError)
        }
      }
    }
  }

  getAccountServices(emailAddress: string): AccountServices | undefined {
    return this.activeAccounts.get(emailAddress)
  }

  getAllAccountServices(): Map<string, AccountServices> {
    return this.activeAccounts
  }

  getAllAccountIds(): string[] {
    return Array.from(this.activeAccounts.keys())
  }

  async startSyncForAll(): Promise<void> {
    console.log('Starting sync for all active accounts...')
    for (const [emailAddress, services] of this.activeAccounts.entries()) {
      try {
        console.log(`Starting sync for: ${emailAddress}`)
        await services.syncService.startSync()
      } catch (error) {
        console.error(`Failed to start sync for account ${emailAddress}:`, error)
      }
    }
    console.log('Sync start process initiated for all accounts.')
  }

  async stopSyncForAll(): Promise<void> {
    console.log('Stopping sync for all active accounts...')
    for (const [emailAddress, services] of this.activeAccounts.entries()) {
      try {
        console.log(`Stopping sync for: ${emailAddress}`)
        await services.syncService.stopSync()
      } catch (error) {
        console.error(`Failed to stop sync for account ${emailAddress}:`, error)
      }
    }
    console.log('Sync stop process initiated for all accounts.')
  }
}

export const accountService = AccountService.getInstance()
