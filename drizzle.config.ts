import { defineConfig } from 'drizzle-kit'
import path from 'path'

// Note: This config is used for migration generation only
export default defineConfig({
  schema: './src/main/services/database/schema.ts',
  dialect: 'sqlite',
  out: './src/main/services/database/migrations',
  dbCredentials: {
    url: path.join(process.cwd(), 'mox_store.db')
  }
})
