import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
export const mhguWeapons = sqliteTable('en__weapons', { id: integer('id').primaryKey(), name: text('name').notNull() })
