import { BrowserWindow } from 'electron'
import { google } from 'googleapis'
import { OAuth2Client, UserRefreshClient } from 'google-auth-library'
import secretsManager from '../secrets'
import { z } from 'zod'
import { OAUTH_CONFIG_KEYS } from '@/types/config'
import { ulid } from 'ulid'
import { DatabaseService } from '../database'
import { linkedAccounts } from '../database/schema'
import { eq } from 'drizzle-orm'
import { accountService } from '..'
export type AuthClient = UserRefreshClient

const OAUTH_CONFIG = {
  redirectUri: 'http://localhost:8000/oauth2callback',
  scopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/pubsub',
    'https://www.googleapis.com/auth/contacts.readonly'
  ]
}

export const AUTH_EVENTS = {
  AUTHENTICATED: 'authenticated',
  LOGGED_OUT: 'logged_out'
}

export const TokenDataSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  scope: z.string(),
  token_type: z.string(),
  expiry_date: z.number()
})

export type TokenData = z.infer<typeof TokenDataSchema>

const getTokenKey = (email: string): string => `oauth-token-${email}`

class AuthService {
  async getClientConfig(): Promise<{
    clientId: string
    clientSecret: string
    redirectUri: string
  }> {
    try {
      const clientId = await secretsManager.getCredential(OAUTH_CONFIG_KEYS.CLIENT_ID)
      const clientSecret = await secretsManager.getCredential(OAUTH_CONFIG_KEYS.CLIENT_SECRET)

      if (!clientId || !clientSecret) {
        throw new Error('OAuth credentials not found in secrets manager.')
      }
      return { clientId, clientSecret, redirectUri: OAUTH_CONFIG.redirectUri }
    } catch (error) {
      console.error('Failed to get OAuth client config:', error)
      throw error
    }
  }

  private async createBaseClient(): Promise<OAuth2Client> {
    const { clientId, clientSecret, redirectUri } = await this.getClientConfig()
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }

  async startAuth(parentWindow: BrowserWindow): Promise<{ accountId: string; email: string }> {
    const oauth2Client = await this.createBaseClient()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: OAUTH_CONFIG.scopes,
      prompt: 'consent'
    })

    const authWindow = new BrowserWindow({
      parent: parentWindow,
      width: 500,
      height: 600,
      show: true
    })

    return new Promise((resolve, reject) => {
      authWindow.loadURL(authUrl)

      authWindow.webContents.on('will-redirect', async (event, url) => {
        try {
          if (url.startsWith(OAUTH_CONFIG.redirectUri)) {
            event.preventDefault()
            const code = new URL(url).searchParams.get('code')

            if (code) {
              const client = await this.createBaseClient()
              const { tokens } = await client.getToken(code)
              const parsedTokens = TokenDataSchema.parse(tokens)

              if (!parsedTokens.refresh_token) {
                throw new Error(
                  'No refresh token received from Google. Ensure prompt=consent is used.'
                )
              }

              client.setCredentials(parsedTokens)
              const people = google.people({ version: 'v1', auth: client })
              const profile = await people.people.get({
                resourceName: 'people/me',
                personFields: 'emailAddresses'
              })

              const email = profile.data.emailAddresses?.[0]?.value
              if (!email) {
                throw new Error('Could not retrieve email address from profile.')
              }

              const db = DatabaseService.getInstance().getDb()
              const existingAccount = await db.query.linkedAccounts.findFirst({
                where: eq(linkedAccounts.emailAddress, email)
              })

              if (existingAccount) {
                console.log(`Account ${email} already linked. Updating token in keychain.`)
                await secretsManager.storeCredential(getTokenKey(email), parsedTokens.refresh_token)
                authWindow.close()
                resolve({ accountId: existingAccount.id, email: existingAccount.emailAddress })
                return
              }

              await secretsManager.storeCredential(getTokenKey(email), parsedTokens.refresh_token)

              const newAccountId = ulid()
              await db.insert(linkedAccounts).values({
                id: newAccountId,
                emailAddress: email,
                lastHistoryId: null
              })

              authWindow.close()
              resolve({ accountId: newAccountId, email })
            }
          }
        } catch (error) {
          console.error('Error during OAuth callback:', error)
          if (!authWindow.isDestroyed()) {
            authWindow.close()
          }
          reject(error)
        }
      })

      authWindow.on('closed', () => {
        reject(new Error('Auth window was closed'))
      })
    })
  }

  private async getRefreshToken(email: string): Promise<string | null> {
    return secretsManager.getCredential(getTokenKey(email))
  }

  async checkInitialAuthStatus(): Promise<void> {
    const accounts = await this.getLinkedAccounts()
    if (accounts.length > 0) {
      await accountService.loadPersistedAccounts()
    } else {
      console.debug('No existing authentication found.')
    }
  }

  async logout(): Promise<void> {
    console.info('Logging out all accounts...')
    const db = DatabaseService.getInstance().getDb()
    const accounts = await this.getLinkedAccounts()
    for (const account of accounts) {
      try {
        const client = await this.getAuthenticatedClient(account.emailAddress)
        await client.revokeCredentials()
        console.log(`Revoked token for ${account.emailAddress}`)
      } catch (err) {
        console.warn(`Failed to revoke token for ${account.emailAddress}:`, err)
      }

      try {
        await secretsManager.deleteCredential(getTokenKey(account.emailAddress))
      } catch (err) {
        console.error(`Failed to delete credential for ${account.emailAddress}:`, err)
      }
    }
    await db.delete(linkedAccounts)
    console.info('Cleared linked accounts from database.')
  }

  async isAuthenticated(): Promise<boolean> {
    const accounts = await this.getLinkedAccounts()
    return accounts.length > 0
  }

  async getAuthenticatedClient(email: string): Promise<OAuth2Client> {
    const refreshToken = await this.getRefreshToken(email)

    if (!refreshToken) {
      throw new Error(`Not authenticated or refresh token missing for account: ${email}`)
    }

    const client = await this.createBaseClient()
    client.setCredentials({ refresh_token: refreshToken })

    try {
      const accessToken = await client.getAccessToken()
      if (!accessToken.token) {
        throw new Error(`Failed to obtain access token for ${email}`)
      }
    } catch (error) {
      console.error(`Error refreshing access token for ${email}:`, error)
      await this.removeAccount(email)
      throw new Error(`Failed to refresh token for ${email}. Account may need re-authentication.`)
    }

    return client
  }

  async getRefreshClient(email: string): Promise<UserRefreshClient> {
    const refreshToken = await this.getRefreshToken(email)
    if (!refreshToken) {
      throw new Error(`No refresh token available for account: ${email}`)
    }
    const { clientId, clientSecret } = await this.getClientConfig()

    return new UserRefreshClient({
      clientId: clientId,
      clientSecret: clientSecret,
      refreshToken: refreshToken
    })
  }

  async getLinkedAccounts(): Promise<
    { id: string; emailAddress: string; lastHistoryId: string | null }[]
  > {
    try {
      const db = DatabaseService.getInstance().getDb()
      return await db.query.linkedAccounts.findMany()
    } catch (error) {
      console.error('Failed to retrieve linked accounts:', error)
      return []
    }
  }

  async removeAccount(email: string): Promise<void> {
    console.info(`Removing account: ${email}...`)
    try {
      const client = await this.getAuthenticatedClient(email)
      await client.revokeCredentials()
      console.info(`Revoked token for ${email}`)
    } catch (err) {
      console.error(
        `Failed to revoke token during removal for ${email} (might be already invalid):`,
        err
      )
    }

    try {
      await secretsManager.deleteCredential(getTokenKey(email))
    } catch (err) {
      console.error(`Failed to delete credential for ${email}:`, err)
    }

    try {
      const db = DatabaseService.getInstance().getDb()
      const result = await db.delete(linkedAccounts).where(eq(linkedAccounts.emailAddress, email))
      if (result.rowsAffected === 0) {
        console.warn(`No account found in database for email: ${email}`)
      } else {
        console.info(`Removed account ${email} from database.`)
      }
    } catch (error) {
      console.error(`Failed to remove account ${email} from database:`, error)
      throw error
    }
  }
}

export const authService = new AuthService()
