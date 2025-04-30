import fs from 'fs/promises'
import path from 'path'
import { AttachmentFileData } from '@/types/email'

export const MIME_TYPE_MAP: Record<string, string> = {
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
}

/**
 * Gets the MIME type for a given file path based on its extension.
 * @param filePath
 * @returns The determined MIME type or a default 'application/octet-stream'.
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_TYPE_MAP[ext] ?? 'application/octet-stream'
}

/**
 * Processes a list of file paths to read their content, determine MIME types.
 * @param filePaths
 * @returns A promise that resolves to an object containing files and their sizes.
 */
export async function processAttachmentPaths(filePaths: string[]): Promise<{
  attachments: AttachmentFileData[]
  totalSize: number
}> {
  let totalSize = 0
  const attachments: AttachmentFileData[] = await Promise.all(
    filePaths.map(async (filePath) => {
      const buffer = await fs.readFile(filePath)
      const stats = await fs.stat(filePath)
      totalSize += stats.size

      const mimeType = getMimeType(filePath)

      return {
        name: path.basename(filePath),
        content: buffer,
        type: mimeType
      }
    })
  )

  return { attachments, totalSize }
}
