import { BrowserWindow } from 'electron'
import { google } from 'googleapis'
import { OAuth2Client, UserRefreshClient } from 'google-auth-library'
import { OAUTH_CONFIG } from '../config'
import keytar from 'keytar'
import { EventEmitter } from 'events'

export const AUTH_EVENTS = {
  AUTHENTICATED: 'authenticated',
  LOGGED_OUT: 'logged_out'
}

export interface TokenData {
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date: number
}

class AuthService extends EventEmitter {
  private oauth2Client: OAuth2Client
  private readonly SERVICE_NAME = 'mox-email'
  private readonly ACCOUNT_NAME = 'oauth-tokens'

  constructor() {
    super()
    // Initialize OAuth2 client
    // NOTE: We must not package these, use a proxy server to initiate login
    // It's fine for dev, but not for prod

    this.oauth2Client = new google.auth.OAuth2(
      OAUTH_CONFIG.clientId,
      OAUTH_CONFIG.clientSecret,
      OAUTH_CONFIG.redirectUri
    )
  }

  async startAuth(parentWindow: BrowserWindow): Promise<TokenData> {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: OAUTH_CONFIG.scopes,
      prompt: 'consent'
    })

    // Create auth window
    const authWindow = new BrowserWindow({
      parent: parentWindow,
      width: 500,
      height: 600,
      show: true,
      webPreferences: {
        nodeIntegration: true
      }
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
              const { tokens } = await this.oauth2Client.getToken(code)

              await keytar.setPassword(this.SERVICE_NAME, this.ACCOUNT_NAME, JSON.stringify(tokens))

              authWindow.close()
              this.emit(AUTH_EVENTS.AUTHENTICATED)
              resolve(tokens as TokenData)
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
    const tokensStr = await keytar.getPassword(this.SERVICE_NAME, this.ACCOUNT_NAME)
    if (!tokensStr) return null

    const tokens = JSON.parse(tokensStr) as TokenData

    // Check if tokens are expired and refresh if needed
    if (tokens.expiry_date < Date.now()) {
      try {
        this.oauth2Client.setCredentials(tokens)
        const { credentials } = await this.oauth2Client.refreshAccessToken()
        await keytar.setPassword(this.SERVICE_NAME, this.ACCOUNT_NAME, JSON.stringify(credentials))
        this.emit(AUTH_EVENTS.AUTHENTICATED)
        return credentials as TokenData
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
    await keytar.deletePassword(this.SERVICE_NAME, this.ACCOUNT_NAME)
    this.emit(AUTH_EVENTS.LOGGED_OUT)
  }

  async isAuthenticated(): Promise<boolean> {
    const tokens = await keytar.getPassword(this.SERVICE_NAME, this.ACCOUNT_NAME)
    return !!tokens
  }

  async getAuthenticatedClient(): Promise<OAuth2Client> {
    const tokens = await this.getTokens()
    if (!tokens) {
      throw new Error('Not authenticated')
    }
    this.oauth2Client.setCredentials(tokens)
    return this.oauth2Client
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
