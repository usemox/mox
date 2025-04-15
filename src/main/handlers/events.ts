import { AppMessage, MessageType } from '@/types/messages'
import { IPC_CHANNELS } from '../services/config'
import { Email } from '@/types/email'
import { BrowserWindow } from 'electron'

export const getActiveWindow = (): BrowserWindow | null => {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!window || window.isDestroyed()) {
    console.error('No active window available')
    return null
  }
  return window
}

export function sendMessageNotification<T extends MessageType>(message: AppMessage<T>): void {
  const window = getActiveWindow()

  window?.webContents.send(IPC_CHANNELS.NOTIFICATIONS.EVENTS_MESSAGE, {
    ...message,
    timestamp: Date.now()
  })
}

export function sendEmailNotification(emails: Email[]): void {
  const window = getActiveWindow()

  window?.webContents.send(IPC_CHANNELS.NOTIFICATIONS.NEW_EMAILS, emails)
}

export function showErrorMessage(message: string): void {
  const window = getActiveWindow()
  const error: AppMessage<MessageType.ERROR> = {
    type: MessageType.ERROR,
    description: message
  }

  window?.webContents.send(IPC_CHANNELS.NOTIFICATIONS.EVENTS_MESSAGE, {
    ...error,
    timestamp: Date.now()
  })
}
