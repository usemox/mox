import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { createClient, Client } from '@libsql/client'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import * as schema from './schema'
import { sql } from 'drizzle-orm'

export type Database = ReturnType<typeof drizzle<typeof schema>>

export class DatabaseService {
  private static instance: DatabaseService
  private client: Client
  private db: Database
  private dbPath: string

  private constructor() {
    this.dbPath = this.getDatabasePath()
    this.ensureDirectoryExists()

    console.info('Initializing database', this.dbPath)

    this.client = this.initializeSqlite()
    this.db = drizzle(this.client, { schema })

    this.initializeMigrations()
  }

  private getMigrationsPath(): string {
    if (process.env.NODE_ENV === 'development') {
      return path.join(process.cwd(), 'src', 'main', 'services', 'database', 'migrations')
    }
    return path.join(process.resourcesPath, 'migrations')
  }

  private async initializeMigrations(): Promise<void> {
    try {
      const migrationsFolder = this.getMigrationsPath()

      console.info('Initializing migrations:', migrationsFolder)

      await migrate(this.db, { migrationsFolder })

      await this.db.run(sql`
        CREATE INDEX IF NOT EXISTS embedding_index
        ON email_embeddings(libsql_vector_idx(embedding))
      `)
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    }
  }

  private getDatabasePath(): string {
    if (process.env.NODE_ENV === 'development') {
      return path.join(process.cwd(), 'mox_store.db')
    }

    return path.join(app.getPath('userData'), 'mox', 'mox_store.db')
  }

  private ensureDirectoryExists(): void {
    const dbDir = path.dirname(this.dbPath)
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
  }

  private initializeSqlite(): Client {
    const config = {
      url: `file:${this.dbPath}`
    }

    const client = createClient(config)

    client.execute('PRAGMA journal_mode = WAL')
    client.execute('PRAGMA synchronous = NORMAL')
    client.execute('PRAGMA foreign_keys = ON')
    client.execute('PRAGMA cache_size = -2000')

    return client
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  getDb(): Database {
    return this.db
  }

  close(): void {
    if (this.client) {
      this.client.close()
    }
  }
}
