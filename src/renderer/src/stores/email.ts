import { computed, makeAutoObservable, runInAction } from 'mobx'
import type { Email, EmailThread, Profile, EmailFolder } from '@/types/email'
import { composeStore } from './compose'
import { parseEmail } from '@/utils/index'

class EmailStore {
  emails: Map<string, Email> = new Map()
  currentFolder: EmailFolder | null = null
  isAuthenticated: boolean = false
  focusThreadId: string | null = null
  reachedEnd: boolean = false
  lastEmailsFetched: number = 0
  profile: Profile | null = null

  private _selectedIds: Set<string> = new Set()
  private _lastSelectedId: string | null = null

  private _notificationHandler: (() => void) | null = null

  constructor() {
    makeAutoObservable(this, { emailList: computed }, { autoBind: true })
    this.initializeNotificationListener()
  }

  private initializeNotificationListener(): void {
    this.cleanupNotificationListener()

    this._notificationHandler = window.api.notifications.onNewEmails(async (emails) => {
      const currentList = this.emailList

      if (currentList.length === 0) {
        emails.forEach(this.setEmail)
      } else {
        const oldestDate = currentList[currentList.length - 1].date
        const emailsToAdd = emails.filter((email) => email.date >= oldestDate)
        emailsToAdd.forEach(this.setEmail)
      }
    })
  }

  private cleanupNotificationListener(): void {
    if (this._notificationHandler) {
      this._notificationHandler()
      this._notificationHandler = null
    }
  }

  // NOTE: tested with 1000 emails, the sort time is ~0.1ms on a 2024 Macbook Pro
  // this is reasonable for now, but if we need to support more emails, we should use a more efficient sorting algorithm
  get emailList(): Email[] {
    return this.emails
      .values()
      .toArray()
      .sort((a, b) => b.date - a.date)
  }

  get selectedThreads(): string[] {
    return Array.from(this._selectedIds)
  }

  get emailIndexMap(): Map<string, number> {
    const map = new Map<string, number>()
    this.emailList.forEach((email, index) => {
      map.set(email.threadId, index)
    })
    return map
  }

  get selectedIndex(): number {
    if (!this.focusThreadId) return -1
    return this.emailIndexMap.get(this.focusThreadId) ?? -1
  }

  setfocusThreadId(emailId: string | null): void {
    this.focusThreadId = emailId
  }

  selectNextEmail(): { nextId: string; index: number } | undefined {
    const list = this.emailList
    const index = this.selectedIndex

    if (list.length === 0 || index >= list.length - 1) return

    const nextId = index === -1 ? list[0].threadId : list[index + 1].threadId
    this.setfocusThreadId(nextId)
    return { nextId, index: index + 1 }
  }

  selectPreviousEmail(): { previousId: string; index: number } | undefined {
    const list = this.emailList
    const index = this.selectedIndex

    if (list.length === 0 || index <= 0) return undefined
    const previousId = index === -1 ? list[list.length - 1].threadId : list[index - 1].threadId

    this.setfocusThreadId(previousId)
    return { previousId, index: index - 1 }
  }

  get unreadCount(): number {
    return this.emailList.filter((email) => email.unread).length
  }

  async archiveEmails(threadIds: string[]): Promise<void> {
    const archivedEmails = new Map<string, Email>()

    for (const threadId of threadIds) {
      const email = this.emails.get(threadId)
      if (email) {
        archivedEmails.set(threadId, email)
        this.emails.delete(threadId)
      }
    }

    try {
      await window.api.emails.markAsArchived(threadIds)
    } catch (error) {
      console.error('Failed to archive emails:', error instanceof Error ? error.message : error)
      for (const [threadId, email] of archivedEmails) {
        this.emails.set(threadId, email)
      }
    }
  }

  async checkAuth(): Promise<boolean> {
    try {
      const response = await window.api.auth.checkAuth()
      this.isAuthenticated = response.success && response.isAuthenticated
      return this.isAuthenticated
    } catch (error) {
      console.error('Failed to check auth:', error instanceof Error ? error.message : error)
      this.isAuthenticated = false
      return false
    }
  }

  async getProfile(): Promise<void> {
    if (this.profile) return
    const response = await window.api.emails.getProfile()

    runInAction(() => {
      if (response.data) this.profile = response.data
    })
  }

  clearEmails(): void {
    this.emails.clear()
    this.reachedEnd = false
  }

  setCurrentFolder(folder: EmailFolder | null): void {
    this.clearEmails()
    this.currentFolder = folder
  }

  async fetchEmails(
    batchSize: number = 5,
    offset: number = 0,
    folder: EmailFolder | null = null
  ): Promise<void> {
    try {
      this._selectedIds.clear()
      const response = await window.api.emails.fetch(batchSize, offset, folder)
      runInAction(() => {
        response.data?.forEach(this.setEmail)
        if (response.data?.length && response.data.length < batchSize) {
          this.reachedEnd = true
        }
        this.lastEmailsFetched = Date.now()
      })
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    }
  }

  setEmail(email: Email): void {
    if (email.folder === 'DRAFTS') {
      this.setDraft(email)
      if (email.threadId !== email.id) this.emails.set(email.threadId, email)
    } else {
      this.emails.set(email.threadId, email)
    }
  }

  setDraft(email: Email): void {
    composeStore.createNewCompose({
      ...email,
      recipients: new Map([[parseEmail(email.fromAddress).email, 'to']])
    })
  }

  async fetchNextEmails(): Promise<void> {
    try {
      this.fetchEmails(50, this.emailList.length, this.currentFolder)
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    }
  }

  async downloadAttachment(id: string): Promise<void> {
    const response = await window.api.attachments.download(id)
    if (response.success) {
      console.info('Attachment downloaded:', response.filePath)
    } else {
      console.error('Failed to download attachment:', response.error)
    }
  }

  async fetchEmailThread(threadId: string): Promise<EmailThread | null> {
    try {
      const response = await window.api.emails.fetchThread(threadId)

      if (response.data) {
        const messages = response.data.messages.reduce((acc, message) => {
          if (message.folder === 'DRAFTS') {
            this.setDraft(message)
          } else {
            acc.push(message)
          }
          return acc
        }, [] as Email[])

        return {
          ...response.data,
          messages
        }
      }
      return null
    } catch (error) {
      console.error('Failed to fetch email thread:', error)
      return null
    }
  }

  selectEmails(ids: string[], isRangeSelect: boolean = false): void {
    if (ids.length === 0) {
      this.unselectAll()
      return
    }

    runInAction(() => {
      if (isRangeSelect && this._lastSelectedId && ids.length === 1) {
        // NOTE: This is calculated let's only do it once
        const emailList = this.emailList
        const lastIndex = emailList.findIndex((e) => e.threadId === this._lastSelectedId)
        const currentIndex = emailList.findIndex((e) => e.threadId === ids[0])

        if (lastIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex)
          const end = Math.max(lastIndex, currentIndex)

          for (let i = start; i <= end; i++) {
            const email = emailList[i]
            this.emails.set(email.threadId, { ...email, selected: true })
            this._selectedIds.add(email.threadId)
          }

          return
        }
      }

      for (const id of ids) {
        const email = this.emails.get(id)
        if (email) {
          this.emails.set(id, { ...email, selected: true })
          this._selectedIds.add(id)
        }
      }

      this._lastSelectedId = ids[ids.length - 1]
    })
  }

  toggleEmailSelection(id: string): void {
    runInAction(() => {
      const email = this.emails.get(id)
      if (email) {
        const newSelected = !email.selected
        this.emails.set(id, { ...email, selected: newSelected })

        if (newSelected) {
          this._selectedIds.add(email.threadId)
          this._lastSelectedId = email.threadId
        } else {
          this._selectedIds.delete(email.threadId)
          if (this._lastSelectedId === email.threadId) this._lastSelectedId = null
        }
      }
    })
  }

  unselectAll(): void {
    runInAction(() => {
      for (const id of this._selectedIds) {
        const email = this.emails.get(id)
        if (email) {
          this.emails.set(id, { ...email, selected: false })
        }
      }
      this._lastSelectedId = null
      this._selectedIds.clear()
    })
  }

  selectAll(): void {
    runInAction(() => {
      this._selectedIds.clear()
      for (const [threadId, email] of this.emails.entries()) {
        if (!email.selected) {
          this.emails.set(threadId, { ...email, selected: true })
        }
        this._selectedIds.add(email.threadId)
      }
    })
  }

  async markAsRead(ids: string[]): Promise<void> {
    const updateUnreadStatus = (unread: boolean): void => {
      for (const id of ids) {
        const email = this.emails.get(id)
        if (email) {
          this.emails.set(id, { ...email, unread })
        }
      }
    }

    try {
      updateUnreadStatus(false)
      await window.api.emails.markAsRead(ids)
    } catch (error) {
      updateUnreadStatus(true)
      console.error(
        'Failed to mark emails as read:',
        error instanceof Error ? error.message : error
      )
    }
  }

  async addLabels(emailIds: string[], labels: string[]): Promise<void> {
    const validEmails = emailIds
      .map((id) => this.emails.get(id))
      .filter((email): email is NonNullable<typeof email> => email != null)

    if (validEmails.length === 0) return

    const newLabels = [
      ...new Set([...validEmails.flatMap((email) => email.labels ?? []), ...labels])
    ]

    try {
      runInAction(() => {
        validEmails.forEach((email, idx) => {
          this.emails.set(emailIds[idx], { ...email, labels: newLabels })
        })
      })

      await window.api.emails.addLabels(emailIds, labels)
    } catch (error) {
      runInAction(() => {
        validEmails.forEach((email, idx) => {
          this.emails.set(emailIds[idx], email)
        })
      })
      console.error('Failed to add labels:', error)
    }
  }

  async removeLabels(emailIds: string[], labels: string[]): Promise<void> {
    const validEmails = emailIds
      .map((id) => this.emails.get(id))
      .filter((email): email is NonNullable<typeof email> => email != null)

    if (validEmails.length === 0) return

    const labelsToRemove = new Set(labels)

    const newLabels = validEmails
      .flatMap((email) => email.labels ?? [])
      .filter((label) => !labelsToRemove.has(label))

    try {
      runInAction(() => {
        validEmails.forEach((email, idx) => {
          this.emails.set(emailIds[idx], { ...email, labels: newLabels })
        })
      })

      await window.api.emails.removeLabels(emailIds, labels)
    } catch (error) {
      runInAction(() => {
        validEmails.forEach((email, idx) => {
          this.emails.set(emailIds[idx], email)
        })
      })
      console.error('Failed to remove labels:', error)
    }
  }

  dispose(): void {
    this.cleanupNotificationListener()
  }
}

export const emailStore = new EmailStore()
