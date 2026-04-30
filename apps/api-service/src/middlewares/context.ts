import type { Next } from "hono";

import { createRequestDb, getDb } from "@/db/client";
import { getServiceConfig, hasHyperdriveBinding } from "@/env";
import type { AppContext } from "@/hono";
import { createServices } from "@/services";

export async function injectRequestContext(c: AppContext, next: Next) {
  const config = getServiceConfig(c);
  const requestDb = hasHyperdriveBinding(c) ? await createRequestDb(config.databaseUrl) : null;
  const db = requestDb?.db ?? getDb(config.databaseUrl);
  const services = createServices({ db, config });

  c.set("config", config);
  c.set("services", services);

  try {
    await next();
  } finally {
    await requestDb?.close();
  }
}
