import { Hono } from "hono";

import { createOrganizationHandler, listOrganizationsHandler } from "../handlers/organization";
import type { AppEnv } from "../hono";
import { requireAuthUser } from "../middlewares/auth";

export const organizationRouter = new Hono<AppEnv>();

organizationRouter.get("/orgs", requireAuthUser, listOrganizationsHandler);
organizationRouter.post("/orgs", requireAuthUser, createOrganizationHandler);
