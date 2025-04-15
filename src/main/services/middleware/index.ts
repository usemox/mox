import type { EmailBody } from '@/types/email'
import { Database, DatabaseService } from '../database'

export interface EmailBodyMiddleware {
  name: string
  process: (
    db: Database,
    options: { emailId: string; body: EmailBody }
  ) => Promise<Record<string, unknown>>
  priority?: number
}

export class EmailBodyMiddlewareManager {
  private static instance: EmailBodyMiddlewareManager
  private middlewares: EmailBodyMiddleware[] = []

  private constructor() {
    this.middlewares.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  static getInstance(): EmailBodyMiddlewareManager {
    if (!EmailBodyMiddlewareManager.instance) {
      EmailBodyMiddlewareManager.instance = new EmailBodyMiddlewareManager()
    }
    return EmailBodyMiddlewareManager.instance
  }

  async processEmailBody(emailId: string, body: EmailBody): Promise<Record<string, unknown>[]> {
    const db = DatabaseService.getInstance().getDb()
    const results = await Promise.all(
      this.middlewares.map(async (middleware) => {
        console.info('Processing Middleware for email:', emailId, middleware.name)

        try {
          const result = await middleware.process(db, {
            emailId,
            body
          })
          return { name: middleware.name, data: result }
        } catch (error) {
          console.error(`Error in middleware ${middleware.name}:`, error)
          return { name: middleware.name, data: { error: 'Processing failed' } }
        }
      })
    )

    return results
  }
}

export const emailMiddleware = EmailBodyMiddlewareManager.getInstance()
