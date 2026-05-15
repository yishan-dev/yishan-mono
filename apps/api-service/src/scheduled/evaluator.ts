import type { AppDb } from "@/db/client";
import { OrganizationService } from "@/services/organization-service";
import { ScheduledJobService } from "@/services/scheduled-job-service";
import type { ScheduledDbEnv } from "@/scheduled/db";
import { publishViaQStash, type DispatchMessage, type QStashEnv } from "@/scheduled/qstash";

const EVALUATE_LIMIT = 500;
const STALE_THRESHOLD_MINUTES = 5;

export type EvaluatorEnv = ScheduledDbEnv & QStashEnv;

export async function handleEvaluateJobs(db: AppDb, env: EvaluatorEnv): Promise<void> {
  try {
    const orgService = new OrganizationService(db);
    const jobService = new ScheduledJobService(db, orgService);

    const pendingRuns = await jobService.evaluateDueJobs({ limit: EVALUATE_LIMIT });

    if (pendingRuns.length === 0) {
      return;
    }

    const messages: DispatchMessage[] = pendingRuns.map((run) => ({
      runId: run.runId,
      nodeId: run.job.nodeId,
      jobId: run.job.id,
      agentKind: run.job.agentKind,
      prompt: run.job.prompt,
      model: run.job.model ?? "",
      command: run.job.command ?? "",
      scheduledFor: run.scheduledFor.toISOString()
    }));

    const published = await publishViaQStash(env, messages);

    console.log(
      `[evaluator] Evaluated ${pendingRuns.length} due jobs, dispatched ${published} via QStash`
    );

    const staleCount = await jobService.markStaleRunsOffline({
      staleThresholdMinutes: STALE_THRESHOLD_MINUTES
    });

    if (staleCount > 0) {
      console.log(`[evaluator] Marked ${staleCount} stale runs as skipped_offline`);
    }
  } catch (error) {
    console.error("[evaluator] Failed:", error);
    throw error;
  }
}
