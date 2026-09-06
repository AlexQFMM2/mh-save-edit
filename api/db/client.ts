import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
export function openDatabase(path: string) { return drizzle(new Database(path, { readonly: true, fileMustExist: true })) }
