import { google } from 'googleapis'
import type { people_v1 } from 'googleapis'
import { AuthClient } from '../auth'

export class PeopleService {
  private authClient: AuthClient

  constructor(authClient: AuthClient) {
    this.authClient = authClient
  }

  private people: people_v1.People | null = null
  private readonly CACHE_TTL = 5 * 60 * 1000

  private clientExpiryTime: number = 0

  /**
   * Get a People client
   * @returns The People client
   */
  private async getPeopleClient(): Promise<people_v1.People> {
    const now = Date.now()
    if (!this.people || now > this.clientExpiryTime) {
      this.people = google.people({ version: 'v1', auth: this.authClient })
      this.clientExpiryTime = now + this.CACHE_TTL
    }
    return this.people
  }

  /**
   * Initialize a history watch for the user's inbox
   * @returns The history ID and expiration time
   */
  async getContacts(
    pageToken?: string
  ): Promise<{ connections: people_v1.Schema$Person[]; nextPageToken?: string }> {
    const people = await this.getPeopleClient()

    const { data } = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 100,
      pageToken,
      personFields: 'emailAddresses,names,photos,coverPhotos'
    })

    return {
      connections: data.connections ?? [],
      nextPageToken: data.nextPageToken ?? undefined
    }
  }
}
