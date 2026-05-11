import { app } from "@/app";
import type { CleanupEnv } from "@/scheduled/cleanup";
import { handleCleanup } from "@/scheduled/cleanup";
import type { EvaluatorEnv } from "@/scheduled/evaluator";
import { handleEvaluateJobs } from "@/scheduled/evaluator";
import { runWithScheduledDb, type ScheduledDbEnv } from "@/scheduled/db";

type WorkerEnv = ScheduledDbEnv & CleanupEnv & EvaluatorEnv;

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: WorkerEnv, ctx: ExecutionContext) {
    if (event.cron === "* * * * *") {
      ctx.waitUntil(
        runWithScheduledDb(env, "evaluator", async (db) => {
          await handleEvaluateJobs(db, env);
        })
      );
    } else {
      ctx.waitUntil(
        runWithScheduledDb(env, "cleanup", async (db) => {
          await handleCleanup(db, env);
        })
      );
    }
  },
};
