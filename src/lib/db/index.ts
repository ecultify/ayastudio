import "server-only"
import { Pool, type QueryResult, type QueryResultRow } from "pg"
import { SCHEMA_SQL } from "./schema"

// Single shared pool across hot reloads / serverless invocations.
declare global {
  // eslint-disable-next-line no-var
  var __anyaPgPool: Pool | undefined
  // eslint-disable-next-line no-var
  var __anyaSchemaReady: Promise<void> | undefined
}

/** True when a database connection string is configured. */
export function dbConfigured(): boolean {
  return !!process.env.DATABASE_URL
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")
  if (!global.__anyaPgPool) {
    global.__anyaPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Railway internal networking is plaintext; the public proxy works without
      // a client cert. Allow self-signed in case a proxy terminates TLS.
      ssl: process.env.DATABASE_URL.includes("railway.internal")
        ? undefined
        : { rejectUnauthorized: false },
    })
    global.__anyaPgPool.on("error", () => {
      /* swallow idle-client errors; queries handle their own failures */
    })
  }
  return global.__anyaPgPool
}

/** Create tables on first use (idempotent), deduped across concurrent callers. */
export async function ensureSchema(): Promise<void> {
  if (!global.__anyaSchemaReady) {
    global.__anyaSchemaReady = pool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((e) => {
        // Reset so a later call can retry after a transient failure.
        global.__anyaSchemaReady = undefined
        throw e
      })
  }
  return global.__anyaSchemaReady
}

/** Run a query, ensuring the schema exists first. Throws on DB errors. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  await ensureSchema()
  return pool().query<T>(text, params as never[])
}

/**
 * Run `fn` only if a database is configured and reachable; otherwise return
 * `fallback`. Lets every feature degrade gracefully when the DB is absent
 * (local build, missing DATABASE_URL) instead of crashing the page.
 */
export async function withDb<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!dbConfigured()) return fallback
  try {
    return await fn()
  } catch (e) {
    console.error("[db] query failed:", (e as Error).message)
    return fallback
  }
}
