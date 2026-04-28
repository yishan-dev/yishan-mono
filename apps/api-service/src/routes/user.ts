import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import {
  meHandler,
  updateNotificationPreferencesHandler,
} from "@/handlers/user";
import type { AppEnv } from "@/hono";
import { validationErrorResponse } from "@/validation/error-response";
import { updateNotificationPreferencesBodySchema } from "@/validation/user";

export const userRouter = new Hono<AppEnv>();

userRouter.get("/me", meHandler);
userRouter.put(
  "/notification-preferences",
  zValidator("json", updateNotificationPreferencesBodySchema, validationErrorResponse),
  (c) => updateNotificationPreferencesHandler(c, c.req.valid("json")),
);
