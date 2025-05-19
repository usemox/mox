import { makeAutoObservable, observable, runInAction } from 'mobx'
import type { Credential, Prompt, PromptType } from '@/types/settings'
import { SyncStatus } from '@renderer/components/sync-badge'
import { debounce } from '@renderer/lib/utils'
import { OAUTH_CONFIG_KEYS } from '@/types/config'

class SettingsStore {
  credentials = observable.map<string, Credential>()
  prompts = observable.map<PromptType, Prompt>({
    IMPROVE_EMAIL: {
      id: 'IMPROVE_EMAIL',
      prompt: ''
    },
    WRITE_EMAIL: {
      id: 'WRITE_EMAIL',
      prompt: ''
    },
    SUMMARIZE_EMAIL: {
      id: 'SUMMARIZE_EMAIL',
      prompt: ''
    }
  })
  syncStatus: SyncStatus = 'done'
  isLoading = false

  private allConfigKeys = [...Object.values(OAUTH_CONFIG_KEYS)]

  constructor() {
    makeAutoObservable(this)
  }

  get isAuthReady(): boolean {
    const requiredKeyCount = this.allConfigKeys.length
    if (this.credentials.size < requiredKeyCount) return false
    return this.allConfigKeys.every((key) => this.credentials.has(key))
  }

  async loadCredentials(): Promise<void> {
    runInAction(() => {
      this.isLoading = true
    })

    try {
      const result = await window.api.settings.getCredentials()
      if (result.success) {
        runInAction(() => {
          this.credentials.clear()
          result.data?.forEach((cred) => {
            this.credentials.set(cred.id, { id: cred.id, secret: cred.secret })
          })
        })
      } else {
        console.error('Failed to load credentials:', result.error)
      }
    } catch (error) {
      console.error('Credentials request failed:', error)
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  /**
   * @param id The unique ID of the credential.
   * @param secret The secret value (usually the user input).
   */
  upsertSecret(id: string, secret: string): void {
    if (id === '') {
      console.warn('Cannot upsert secret: ID is required.')
      return
    }
    this.credentials.set(id, { id, secret })

    debounce(async () => {
      await this.saveCredential(id, secret)
    }, 500)()
  }

  /**
   * @param id The unique ID of the credential.
   * @param secret The secret value (usually the user input).
   */
  async saveCredential(id: string, secret: string): Promise<void> {
    if (id === '' || secret === '') {
      console.warn('Cannot save credential: ID or secret is required.')
      return
    }

    runInAction(() => {
      this.syncStatus = 'pending'
    })

    try {
      const result = await window.api.settings.setCredential(id, secret)
      if (result.success) {
        runInAction(() => {
          this.syncStatus = 'done'
        })
      } else {
        console.error('Failed to sync credentials:', result.error)
        runInAction(() => {
          this.syncStatus = 'error'
        })
      }
    } catch (error) {
      console.error('Sync request failed:', error)
      runInAction(() => {
        this.syncStatus = 'error'
      })
    }
  }

  /**
   * @param id The ID of the credential to remove.
   */
  async removeSecret(id: string): Promise<void> {
    if (id === '') {
      console.warn('Cannot remove credential: ID is required.')
      return
    }

    runInAction(() => {
      this.syncStatus = 'pending'
    })

    try {
      const result = await window.api.settings.deleteCredential(id)
      if (result.success) {
        runInAction(() => {
          this.credentials.delete(id)
          this.syncStatus = 'done'
        })
      } else {
        console.error('Failed to remove credential:', result.error)
        runInAction(() => {
          this.syncStatus = 'error'
        })
      }
    } catch (error) {
      console.error('Credential delete request failed:', error)
      runInAction(() => {
        this.syncStatus = 'error'
      })
    }
  }

  upsertPrompt(id: PromptType, prompt: Prompt): void {
    this.prompts.set(id, prompt)
  }

  getPrompt(id: PromptType): Prompt | undefined {
    return this.prompts.get(id)
  }
}

const settingsStore = new SettingsStore()
export default settingsStore
