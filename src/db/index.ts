import { drizzle } from 'drizzle-orm/node-postgres'
import { pool } from '../config/database.js'
import * as schema from './schema.js'

/** Drizzle client sharing the application's pg connection pool. */
export const db = drizzle({ client: pool, schema })

export type Database = typeof db
