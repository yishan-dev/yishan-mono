import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { createWorkspaceHandler, listWorkspacesHandler } from "@/handlers/workspace";
import type { AppEnv } from "@/hono";
import { requireOrganizationMemberFromParam } from "@/middlewares/organization-access";
import { validationErrorResponse } from "@/validation/error-response";
import { createWorkspaceBodySchema, projectWorkspaceParamsSchema } from "@/validation/project";

export const workspaceRouter = new Hono<AppEnv>();

workspaceRouter.use("/*", requireOrganizationMemberFromParam);

workspaceRouter.get(
  "/",
  zValidator("param", projectWorkspaceParamsSchema, validationErrorResponse),
  (c) => listWorkspacesHandler(c, c.req.valid("param"))
);

workspaceRouter.post(
  "/",
  zValidator("param", projectWorkspaceParamsSchema, validationErrorResponse),
  zValidator("json", createWorkspaceBodySchema, validationErrorResponse),
  (c) => createWorkspaceHandler(c, c.req.valid("param"), c.req.valid("json"))
);
