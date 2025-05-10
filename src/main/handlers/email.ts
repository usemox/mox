import { ipcMain, dialog } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { IPC_CHANNELS } from '../services/config'
import { emailRepository } from '../services/database/email'
import { generateSummary } from '../services/email/summary'
import { contextSearch } from '../services/email/context-search'
import { EmailFolder, EmailOptions, SelectedFileData } from '@/types/email'
import { generateEmail } from '../services/email/generate'
import { MIME_TYPE_MAP, processAttachmentPaths } from '../services/utils/attachments'
import { accountService } from '../services'

const MAX_SIZE_MB = 25
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

export function setupEmailHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.EMAILS.FETCH,
    async (_, limit: number = 50, offset: number = 0, folder: EmailFolder | null = null) => {
      try {
        const emails = await emailRepository.getRecentEmails(limit, offset, folder)
        return { success: true, data: emails }
      } catch (error) {
        console.error('Email fetch error:', (error as Error).message)
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EMAILS.SEND,
    async (
      _,
      from: string,
      to: string | string[],
      subject: string,
      htmlBody: string,
      attachmentPaths: string[] = [],
      options: EmailOptions = {}
    ) => {
      try {
        const { attachments, totalSize } = await processAttachmentPaths(attachmentPaths)

        if (totalSize > MAX_SIZE_BYTES) {
          throw new Error(
            `Total attachment size (${(totalSize / (1024 * 1024)).toFixed(2)} MB) > ${MAX_SIZE_MB}MB.`
          )
        }

        const emailService = accountService.getAccountServices(from)?.emailService
        if (!emailService) {
          throw new Error('Email service not found')
        }

        const emailId = await emailService.sendEmailWithAttachments(
          to,
          subject,
          htmlBody,
          attachments,
          options
        )
        return { success: true, data: emailId }
      } catch (error) {
        console.error('Email send error:', (error as Error).message)
        return { success: false, error: (error as Error).message }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.EMAILS.CATEGORIES, async () => {
    try {
      const categories = await emailRepository.getCategories()
      return { success: true, data: categories }
    } catch (error) {
      console.error('Email categories fetch error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.EMAILS.FETCH_PROFILE, async () => {
    try {
      const profile = accountService.getAllAccountIds()
      const unreadEmails = await emailRepository.getUnreadCount()
      return {
        success: true,
        data: {
          email: profile?.[0],
          unreadEmails
        }
      }
    } catch (error) {
      console.error('Email categories fetch error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.EMAILS.FETCH_THREAD, async (_, threadId: string) => {
    try {
      const thread = await emailRepository.getEmailThread(threadId)
      return { success: true, data: thread }
    } catch (error) {
      console.error('Email thread fetch error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.EMAILS.MARK_AS_ARCHIVED, async (_, emailIds: string[]) => {
    await emailRepository.markAsArchived(emailIds)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.EMAILS.MARK_AS_READ, async (_, emailIds: string[]) => {
    await emailRepository.markAsRead(emailIds)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.EMAILS.SEARCH, async (_, query: string) => {
    const nearestNeighbors = await emailRepository.nearestNeighbors(query)

    if (!nearestNeighbors.length) {
      _.sender.send(IPC_CHANNELS.EMAILS.SEARCH_DONE)
      return { success: true, data: 'No results found' }
    }

    const references = await emailRepository.getThreadsByEmailIds(
      nearestNeighbors.map((neighbor) => neighbor.emailId)
    )
    _.sender.send(IPC_CHANNELS.EMAILS.SEARCH_REFERENCE, references)

    const response = await contextSearch(nearestNeighbors, query)

    for await (const chunk of response) {
      _.sender.send(IPC_CHANNELS.EMAILS.SEARCH_CHUNK, chunk)
    }

    _.sender.send(IPC_CHANNELS.EMAILS.SEARCH_DONE)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.EMAILS.GET_EMAIL_ACTION_ITEMS, async (_, emailId: string) => {
    try {
      const actionItems = await emailRepository.getActionItems(emailId)
      return { success: true, data: actionItems }
    } catch (error) {
      console.error('Email action items fetch error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.EMAILS.GENERATE_SUMMARY, async (_, threadId: string) => {
    try {
      const existingSummary = await emailRepository.getEmailSummary(threadId)

      if (existingSummary) {
        _.sender.send(IPC_CHANNELS.EMAILS.SUMMARY_CHUNK, existingSummary)
        _.sender.send(IPC_CHANNELS.EMAILS.SUMMARY_DONE)
        return { success: true }
      }

      const response = await generateSummary(threadId)
      let summary = ''

      for await (const chunk of response) {
        summary += chunk
        _.sender.send(IPC_CHANNELS.EMAILS.SUMMARY_CHUNK, chunk)
      }

      await emailRepository.updateEmailSummary(threadId, summary)
      _.sender.send(IPC_CHANNELS.EMAILS.SUMMARY_DONE)
      return { success: true }
    } catch (error) {
      console.error('Summary generation error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.EMAILS.AI_GENERATE,
    async (_, body: string, type: 'write' | 'improve') => {
      try {
        const response = await generateEmail(body, type)

        for await (const chunk of response) {
          _.sender.send(IPC_CHANNELS.EMAILS.AI_GENERATE_CHUNK, chunk)
        }

        _.sender.send(IPC_CHANNELS.EMAILS.AI_GENERATE_DONE)
      } catch (error) {
        console.error('AI generate error:', error)
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EMAILS.ADD_LABELS,
    async (_, emailIds: string[], labelIds: string[]) => {
      await emailRepository.addLabels(emailIds, labelIds)
      return { success: true }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EMAILS.REMOVE_LABELS,
    async (_, emailIds: string[], labelIds: string[]) => {
      await emailRepository.removeLabels(emailIds, labelIds)
      return { success: true }
    }
  )

  ipcMain.handle(IPC_CHANNELS.FILES.SELECT, async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        title: 'Select Attachments',
        buttonLabel: 'Attach'
      })

      if (result.canceled || result.filePaths.length === 0) return null

      const filesData: SelectedFileData[] = await Promise.all(
        result.filePaths.map(async (filePath) => {
          const stats = await fs.stat(filePath)
          return {
            path: filePath,
            filename: path.basename(filePath),
            size: stats.size
          }
        })
      )

      const allowedFiles = filesData.filter((file) => {
        const ext = path.extname(file.filename).toLowerCase()
        return ext in MIME_TYPE_MAP
      })

      return allowedFiles
    } catch (error) {
      console.error('File selection error:', error)
      return null
    }
  })
}
