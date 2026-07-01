/**
 * Drizzle client — postgres-js driver. Edge-runtime compatible.
 *
 * One pool per process, reused by Fluid Compute across requests.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { __dbClient?: postgres.Sql };
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'Missing DATABASE_URL. Create a local .env.local file and set DATABASE_URL to your Postgres connection string.'
  );
}

const client =
  globalForDb.__dbClient ??
  postgres(databaseUrl, {
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__dbClient = client;

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' });
export { schema };
export type Database = typeof db;
