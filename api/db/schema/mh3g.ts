import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
export const mh3gWeapons = sqliteTable('weapons', { id: integer('id').primaryKey(), name: text('name').notNull() })
