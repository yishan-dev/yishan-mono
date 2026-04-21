import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";

import type { AppEnv } from "./hono";
import { injectRequestContext } from "./middlewares/context";
import { corsMiddleware } from "./middlewares/cors";
import { handleAppError } from "./middlewares/error";
import { authRouter } from "./routes/auth";
import { organizationRouter } from "./routes/organization";
import { systemRouter } from "./routes/system";
import { userRouter } from "./routes/user";

export const app = new Hono<AppEnv>();

app.use("/*", corsMiddleware);
app.use("/*", injectRequestContext);
app.onError(handleAppError);
app.notFound((c) => c.json({ error: "Not Found" }, StatusCodes.NOT_FOUND));

app.route("/", systemRouter);
app.route("/auth", authRouter);
app.route("/", userRouter);
app.route("/", organizationRouter);
