import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  createProjectHandler,
  deleteProjectHandler,
  listProjectsHandler,
  updateProjectHandler
} from "@/handlers/project";
import type { AppEnv } from "@/hono";
import { requireOrganizationMemberFromParam } from "@/middlewares/organization-access";
import { workspaceRouter } from "@/routes/project-workspace";
import { validationErrorResponse } from "@/validation/error-response";
import {
  createProjectBodySchema,
  organizationProjectListQuerySchema,
  organizationProjectParamsSchema,
  projectWorkspaceParamsSchema,
  updateProjectBodySchema
} from "@/validation/project";

export const projectRouter = new Hono<AppEnv>();
const router = new Hono<AppEnv>();

router.use("/*", requireOrganizationMemberFromParam);

router.get(
  "/",
  zValidator("param", organizationProjectParamsSchema, validationErrorResponse),
  zValidator("query", organizationProjectListQuerySchema, validationErrorResponse),
  (c) => listProjectsHandler(c, c.req.valid("param"), c.req.valid("query"))
);

router.post(
  "/",
  zValidator("param", organizationProjectParamsSchema, validationErrorResponse),
  zValidator("json", createProjectBodySchema, validationErrorResponse),
  (c) => createProjectHandler(c, c.req.valid("param"), c.req.valid("json"))
);

router.delete(
  "/:projectId",
  zValidator("param", projectWorkspaceParamsSchema, validationErrorResponse),
  (c) => deleteProjectHandler(c, c.req.valid("param"))
);

router.put(
  "/:projectId",
  zValidator("param", projectWorkspaceParamsSchema, validationErrorResponse),
  zValidator("json", updateProjectBodySchema, validationErrorResponse),
  (c) => updateProjectHandler(c, c.req.valid("param"), c.req.valid("json"))
);

projectRouter.route("/orgs/:orgId/projects", router);
projectRouter.route("/orgs/:orgId/projects/:projectId/workspaces", workspaceRouter);
