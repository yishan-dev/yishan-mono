import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";

import * as schema from "@/db/schema";

function createDb(databaseUrl: string) {
  const client = neon(databaseUrl);
  return drizzleHttp({ client, schema });
}

function createDbWs(databaseUrl: string) {
  const client = new Pool({ connectionString: databaseUrl });
  return drizzleWs({ client, schema });
}

const dbCache = new Map<string, ReturnType<typeof createDb>>();
const dbWsCache = new Map<string, ReturnType<typeof createDbWs>>();

function isCloudflareWorkersRuntime(): boolean {
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== "undefined";
}

export function getDb(databaseUrl: string) {
  if (isCloudflareWorkersRuntime()) {
    return createDb(databaseUrl);
  }

  const cached = dbCache.get(databaseUrl);
  if (cached) {
    return cached;
  }

  const db = createDb(databaseUrl);
  dbCache.set(databaseUrl, db);
  return db;
}

export function getDbWs(databaseUrl: string) {
  if (isCloudflareWorkersRuntime()) {
    return createDbWs(databaseUrl);
  }

  const cached = dbWsCache.get(databaseUrl);
  if (cached) {
    return cached;
  }

  const db = createDbWs(databaseUrl);
  dbWsCache.set(databaseUrl, db);
  return db;
}

export type AppDb = ReturnType<typeof getDb>;
export type AppDbWs = ReturnType<typeof getDbWs>;
