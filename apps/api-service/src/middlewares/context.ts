import type { Next } from "hono";

import { getDb, getDbWs } from "@/db/client";
import { getServiceConfig } from "@/env";
import type { AppContext } from "@/hono";
import { createServices } from "@/services";

export async function injectRequestContext(c: AppContext, next: Next) {
  const config = getServiceConfig(c);
  const db = getDb(config.databaseUrl);
  const dbWs = getDbWs(config.databaseUrl);
  const services = createServices({ db, dbWs, config });

  c.set("config", config);
  c.set("services", services);

  await next();
}
