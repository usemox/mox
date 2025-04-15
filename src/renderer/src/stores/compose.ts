import { makeAutoObservable, runInAction } from 'mobx'
import { isValidEmail } from '@/utils/index'
import { Email } from '@/types/email'

export type ComposeType = 'new' | 'reply'
export type RecipientType = 'to' | 'cc' | 'bcc'

export type ComposeEmail = Email & { recipients: Map<string, RecipientType> }

const DEFAULT_EMAIL: ComposeEmail = {
  id: '',
  threadId: '',
  subject: '',
  fromAddress: '',
  toAddress: '',
  snippet: null,
  headers: [],
  date: new Date().getTime(),
  recipients: new Map(),
  unread: true,
  archived: false,
  draft: true,
  body: {
    html: '',
    plain: ''
  }
}

export class ComposeStore {
  private activeComposers: Map<string, ComposeEmail> = new Map()
  isSending: boolean = false

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  createNewCompose(originalEmail?: ComposeEmail): string {
    const id = originalEmail?.threadId ?? crypto.randomUUID()
    const state = { ...DEFAULT_EMAIL, ...originalEmail, id }
    this.activeComposers.set(state.id, state)
    return state.id
  }

  addRecipient(composeId: string, email: string, type: RecipientType = 'to'): boolean {
    const state = this.activeComposers.get(composeId)
    if (!state || !isValidEmail(email)) return false

    state.recipients.set(email, type)
    this.updateLastModified(composeId)
    return true
  }

  removeRecipient(composeId: string, email: string): void {
    const state = this.activeComposers.get(composeId)
    if (!state) return

    state.recipients.delete(email)
    this.updateLastModified(composeId)
  }

  updateSubject(composeId: string, subject: string): void {
    const state = this.activeComposers.get(composeId)
    if (state) {
      state.subject = subject
      this.updateLastModified(composeId)
    }
  }

  updateContent(composeId: string, content: string): void {
    const state = this.activeComposers.get(composeId)
    if (state?.body) {
      state.body.html = content
      this.updateLastModified(composeId)
    }
  }

  private updateLastModified(composeId: string): void {
    const state = this.activeComposers.get(composeId)
    if (state) {
      state.date = new Date().getTime()
    }
  }

  async markAsSent(composeId: string): Promise<{
    status: boolean
    message?: string
  }> {
    const state = this.activeComposers.get(composeId)
    if (!state) return { status: false, message: 'Message not found in the email store' }
    if (!state.subject || !state.body?.html) {
      return { status: false, message: "Can't send empty email" }
    }

    const recipients = Array.from(state.recipients.entries())

    const to = recipients.filter(([, type]) => type === 'to').map(([email]) => email)
    const cc = recipients.filter(([, type]) => type === 'cc').map(([email]) => email)
    const bcc = recipients.filter(([, type]) => type === 'bcc').map(([email]) => email)

    this.isSending = true
    const response = await window.api.emails.send(to, state.subject, state.body.html, [], {
      cc,
      bcc,
      headers: JSON.parse(JSON.stringify(state.headers)),
      threadId: state.threadId
    })

    if (response.success) {
      this.activeComposers.delete(composeId)
      runInAction(() => {
        this.isSending = false
      })
      return { status: true }
    } else {
      runInAction(() => {
        this.isSending = false
      })
      return { status: false, message: response.error ?? 'Gmail service error occured' }
    }
  }

  getCompose(id: string): ComposeEmail | undefined {
    return this.activeComposers.get(id)
  }

  closeCompose(id: string): void {
    this.activeComposers.delete(id)
  }

  get activeComposeCount(): number {
    return this.activeComposers.size
  }

  validateCompose(id: string): { valid: boolean; errors: string[] } {
    const state = this.activeComposers.get(id)
    if (!state) return { valid: false, errors: ['Compose not found'] }

    const errors: string[] = []

    if (state.recipients.size === 0) {
      errors.push('At least one recipient is required')
    }

    if (!state.subject?.trim()) {
      errors.push('Subject is required')
    }

    if (!state.body?.html?.trim()) {
      errors.push('Message content is required')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export const composeStore = new ComposeStore()
