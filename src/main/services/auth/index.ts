import { BrowserWindow } from 'electron'
import { google } from 'googleapis'
import { OAuth2Client, UserRefreshClient } from 'google-auth-library'
import { EventEmitter } from 'events'
import secretsManager from '../secrets'
import { z } from 'zod'
import { OAUTH_CONFIG_KEYS } from '@/types/config'

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

class AuthService extends EventEmitter {
  private _oauth2Client: OAuth2Client | null = null
  private readonly ACCOUNT_NAME = 'oauth-tokens'

  constructor() {
    super()
  }

  async getClient(): Promise<OAuth2Client> {
    if (this._oauth2Client) return this._oauth2Client

    try {
      const clientId = await secretsManager.getCredential(OAUTH_CONFIG_KEYS.CLIENT_ID)
      const clientSecret = await secretsManager.getCredential(OAUTH_CONFIG_KEYS.CLIENT_SECRET)

      if (!clientId || !clientSecret) {
        throw new Error('OAuth credentials not found in secrets manager.')
      }

      this._oauth2Client = new google.auth.OAuth2(clientId, clientSecret, OAUTH_CONFIG.redirectUri)
      return this._oauth2Client
    } catch (error) {
      console.error('Failed to initialize AuthService:', error)
      throw error
    }
  }

  async startAuth(parentWindow: BrowserWindow): Promise<TokenData> {
    const oauth2Client = await this.getClient()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: OAUTH_CONFIG.scopes,
      prompt: 'consent'
    })

    // Create auth window
    const authWindow = new BrowserWindow({
      parent: parentWindow,
      width: 500,
      height: 600,
      show: true
    })

    // Handle the OAuth2 callback
    return new Promise((resolve, reject) => {
      authWindow.loadURL(authUrl)

      authWindow.webContents.on('will-redirect', async (event, url) => {
        try {
          if (url.startsWith(OAUTH_CONFIG.redirectUri)) {
            event.preventDefault()
            const code = new URL(url).searchParams.get('code')

            if (code) {
              const oauth2Client = await this.getClient()
              const { tokens } = await oauth2Client.getToken(code)
              await secretsManager.storeCredential(this.ACCOUNT_NAME, JSON.stringify(tokens))

              authWindow.close()
              this.emit(AUTH_EVENTS.AUTHENTICATED)
              resolve(TokenDataSchema.parse(tokens))
            }
          }
        } catch (error) {
          reject(error)
        }
      })

      authWindow.on('closed', () => {
        reject(new Error('Auth window was closed'))
      })
    })
  }

  async getTokens(): Promise<TokenData | null> {
    const tokensStr = await secretsManager.getCredential(this.ACCOUNT_NAME)
    if (!tokensStr) return null

    const tokens: TokenData = JSON.parse(tokensStr)

    if (tokens.expiry_date < Date.now()) {
      try {
        const oauth2Client = await this.getClient()
        oauth2Client.setCredentials(tokens)
        const { credentials } = await oauth2Client.refreshAccessToken()
        await secretsManager.storeCredential(this.ACCOUNT_NAME, JSON.stringify(credentials))
        this.emit(AUTH_EVENTS.AUTHENTICATED)
        const parsedCredentials = TokenDataSchema.parse(credentials)
        return parsedCredentials
      } catch (error) {
        console.error('Error refreshing token:', error)
        await this.logout()
        return null
      }
    }

    return tokens
  }

  async checkInitialAuthStatus(): Promise<void> {
    console.debug('Checking initial authentication status...')
    const tokens = await this.getTokens()
    if (tokens) {
      console.debug('Existing authentication found.')
      this.emit(AUTH_EVENTS.AUTHENTICATED)
    } else {
      console.debug('No existing authentication found.')
    }
  }

  async logout(): Promise<void> {
    await secretsManager.deleteCredential(this.ACCOUNT_NAME)
    this.emit(AUTH_EVENTS.LOGGED_OUT)
  }

  async isAuthenticated(): Promise<boolean> {
    const tokens = await secretsManager.getCredential(this.ACCOUNT_NAME)
    return !!tokens
  }

  async getAuthenticatedClient(): Promise<OAuth2Client> {
    const tokens = await this.getTokens()

    if (!tokens) {
      throw new Error('Not authenticated')
    }

    const oauth2Client = await this.getClient()
    oauth2Client.setCredentials(tokens)
    return oauth2Client
  }

  async getRefreshClient(): Promise<UserRefreshClient> {
    const { _clientId, _clientSecret, credentials } = await this.getAuthenticatedClient()

    if (typeof credentials.refresh_token !== 'string') {
      throw new Error('No refresh token available to use')
    }

    return new UserRefreshClient({
      clientId: _clientId,
      clientSecret: _clientSecret,
      refreshToken: credentials.refresh_token ?? undefined
    })
  }
}

export const authService = new AuthService()
