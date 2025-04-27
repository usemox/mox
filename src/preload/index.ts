import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '../main/services/config'
import { TokenData } from '../main/services/auth'
import type { AttachmentFileData, Email, EmailOptions, EmailThread, Profile } from '@/types/email'
import type { ActionItem } from '@/types/action-item'
import type { Contact } from '@/types/people'
import { MessageType } from '@/types/messages'
import { AppMessage } from '@/types/messages'
import type { Credential } from '@/types/settings'

export interface ElectronApi {
  auth: {
    startAuth: () => Promise<{ success: boolean; data?: TokenData; error?: string }>
    checkAuth: () => Promise<{ success: boolean; isAuthenticated: boolean; error?: string }>
    logout: () => Promise<{ success: boolean; error?: string }>
  }
  notifications: {
    onNewEmails: (callback: (emails: Email[]) => void) => () => void
    onMessage: (callback: (message: AppMessage<MessageType>) => void) => () => void
  }
  emails: {
    fetch: (
      limit: number,
      offset: number,
      category: string | null
    ) => Promise<{ success: boolean; data?: Email[]; error?: string }>
    send: (
      to: string | string[],
      subject: string,
      htmlBody: string,
      attachments: AttachmentFileData[],
      options: EmailOptions
    ) => Promise<{ success: boolean; data?: string; error?: string }>
    categories: () => Promise<{ success: boolean; data?: string[]; error?: string }>
    fetchThread: (
      threadId: string
    ) => Promise<{ success: boolean; data?: EmailThread; error?: string }>
    markAsArchived: (threadIds: string[]) => Promise<{ success: boolean; error?: string }>
    markAsRead: (ids: string[]) => Promise<{ success: boolean; error?: string }>
    getActionItems: (
      emailId: string
    ) => Promise<{ success: boolean; data?: ActionItem[]; error?: string }>
    generateSummary: (
      threadId: string,
      onChunk: (chunk: string) => void,
      onDone: () => void
    ) => Promise<{ success: boolean; error?: string }>
    generateEmail: (
      body: string,
      type: 'write' | 'improve',
      onChunk: (chunk: string) => void,
      onDone: () => void
    ) => Promise<{ success: boolean; error?: string; data?: string }>
    getProfile: () => Promise<{ success: boolean; error?: string; data?: Profile }>
    search: (
      query: string,
      onChunk: (chunk: string) => void,
      onDone: () => void,
      onReference: (emails: Email[]) => void
    ) => Promise<{ success: boolean; error?: string; data?: string }>
    addLabels: (
      emailIds: string[],
      labelIds: string[]
    ) => Promise<{ success: boolean; error?: string }>
    removeLabels: (
      emailIds: string[],
      labelIds: string[]
    ) => Promise<{ success: boolean; error?: string }>
  }
  actionItems: {
    markAsCompleted: (id: string) => Promise<{ success: boolean; error?: string }>
  }
  people: {
    search: (query: string) => Promise<{ success: boolean; error?: string; data?: Contact[] }>
  }
  settings: {
    getCredentials: () => Promise<{ success: boolean; error?: string; data?: Credential[] }>
    setCredential: (id: string, secret: string) => Promise<{ success: boolean; error?: string }>
    deleteCredential: (id: string) => Promise<{ success: boolean; error?: string }>
  }
  attachments: {
    download: (id: string) => Promise<{ success: boolean; error?: string; filePath?: string }>
  }
}

const api: ElectronApi = {
  auth: {
    startAuth: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH.START_AUTH),
    checkAuth: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH.CHECK_AUTH),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH.LOGOUT)
  },
  emails: {
    fetch: (limit: number = 50, offset: number = 0, category: string | null = null) =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAILS.FETCH, limit, offset, category),

    send: (
      to: string | string[],
      subject: string,
      htmlBody: string,
      attachments: AttachmentFileData[] = [],
      options: EmailOptions = {}
    ) => ipcRenderer.invoke(IPC_CHANNELS.EMAILS.SEND, to, subject, htmlBody, attachments, options),

    categories: () => ipcRenderer.invoke(IPC_CHANNELS.EMAILS.CATEGORIES),

    fetchThread: (threadId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAILS.FETCH_THREAD, threadId),

    markAsArchived: (threadIds: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAILS.MARK_AS_ARCHIVED, threadIds),

    markAsRead: (ids: string[]) => ipcRenderer.invoke(IPC_CHANNELS.EMAILS.MARK_AS_READ, ids),

    getActionItems: (emailId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAILS.GET_EMAIL_ACTION_ITEMS, emailId),

    generateSummary: (threadId: string, onChunk: (chunk: string) => void, onDone: () => void) => {
      const cleanup = (): void => {
        ipcRenderer.removeAllListeners(IPC_CHANNELS.EMAILS.SUMMARY_CHUNK)
        ipcRenderer.removeAllListeners(IPC_CHANNELS.EMAILS.SUMMARY_DONE)
      }

      ipcRenderer.on(IPC_CHANNELS.EMAILS.SUMMARY_CHUNK, (_, chunk: string) => onChunk(chunk))
      ipcRenderer.on(IPC_CHANNELS.EMAILS.SUMMARY_DONE, () => {
        cleanup()
        onDone()
      })

      return ipcRenderer.invoke(IPC_CHANNELS.EMAILS.GENERATE_SUMMARY, threadId)
    },

    getProfile: () => ipcRenderer.invoke(IPC_CHANNELS.EMAILS.FETCH_PROFILE),

    generateEmail: (
      body: string,
      type: 'write' | 'improve',
      onChunk: (chunk: string) => void,
      onDone: () => void
    ) => {
      const cleanup = (): void => {
        ipcRenderer.removeAllListeners(IPC_CHANNELS.EMAILS.AI_GENERATE_CHUNK)
        ipcRenderer.removeAllListeners(IPC_CHANNELS.EMAILS.AI_GENERATE_DONE)
      }

      ipcRenderer.on(IPC_CHANNELS.EMAILS.AI_GENERATE_CHUNK, (_, chunk: string) => onChunk(chunk))
      ipcRenderer.on(IPC_CHANNELS.EMAILS.AI_GENERATE_DONE, () => {
        cleanup()
        onDone()
      })

      return ipcRenderer.invoke(IPC_CHANNELS.EMAILS.AI_GENERATE, body, type)
    },

    search: (
      query: string,
      onChunk: (chunk: string) => void,
      onDone: () => void,
      onReference: (emails: Email[]) => void
    ) => {
      const cleanup = (): void => {
        ipcRenderer.removeAllListeners(IPC_CHANNELS.EMAILS.SEARCH_CHUNK)
        ipcRenderer.removeAllListeners(IPC_CHANNELS.EMAILS.SEARCH_DONE)
        ipcRenderer.removeAllListeners(IPC_CHANNELS.EMAILS.SEARCH_REFERENCE)
      }

      ipcRenderer.on(IPC_CHANNELS.EMAILS.SEARCH_CHUNK, (_, chunk: string) => onChunk(chunk))
      ipcRenderer.on(IPC_CHANNELS.EMAILS.SEARCH_DONE, () => {
        cleanup()
        onDone()
      })

      ipcRenderer.on(IPC_CHANNELS.EMAILS.SEARCH_REFERENCE, (_, emails: Email[]) =>
        onReference(emails)
      )

      return ipcRenderer.invoke(IPC_CHANNELS.EMAILS.SEARCH, query)
    },

    addLabels: (emailIds: string[], labelIds: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAILS.ADD_LABELS, emailIds, labelIds),

    removeLabels: (emailIds: string[], labelIds: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.EMAILS.REMOVE_LABELS, emailIds, labelIds)
  },
  notifications: {
    onNewEmails: (callback) => {
      const listener = (_: unknown, emails: Email[]): void => callback(emails)
      ipcRenderer.on(IPC_CHANNELS.NOTIFICATIONS.NEW_EMAILS, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATIONS.NEW_EMAILS, listener)
      }
    },
    onMessage: (callback) => {
      const listener = (_: unknown, message: AppMessage<MessageType>): void => callback(message)
      ipcRenderer.on(IPC_CHANNELS.NOTIFICATIONS.EVENTS_MESSAGE, listener)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.NOTIFICATIONS.EVENTS_MESSAGE, listener)
      }
    }
  },
  actionItems: {
    markAsCompleted: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTION_ITEMS.MARK_AS_COMPLETED, id)
  },
  people: {
    search: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE.SEARCH, query)
  },
  settings: {
    getCredentials: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET_CREDENTIALS),
    setCredential: (id: string, secret: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_CREDENTIAL, id, secret),
    deleteCredential: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.DELETE_CREDENTIAL, id)
  },
  attachments: {
    download: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.ATTACHMENTS.DOWNLOAD, id)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
