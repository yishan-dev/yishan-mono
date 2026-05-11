export const STREAM_KEY = "scheduled-job-runs";

export type StreamMessage = {
  runId: string;
  nodeId: string;
  jobId: string;
  agentKind: string;
  prompt: string;
  model: string;
  command: string;
  scheduledFor: string;
};

type RedisEnv = {
  REDIS_STREAM_HTTP_URL?: string;
  REDIS_STREAM_HTTP_TOKEN?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

export async function publishToStream(env: RedisEnv, messages: StreamMessage[]): Promise<number> {
  const url = env.REDIS_STREAM_HTTP_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.REDIS_STREAM_HTTP_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url) {
    console.warn("[evaluator] REDIS_STREAM_HTTP_URL (or UPSTASH_REDIS_REST_URL) not configured, skipping publish");
    return 0;
  }

  let published = 0;
  for (const msg of messages) {
    const body = [
      "XADD", STREAM_KEY, "*",
      "runId", msg.runId,
      "nodeId", msg.nodeId,
      "jobId", msg.jobId,
      "agentKind", msg.agentKind,
      "prompt", msg.prompt,
      "model", msg.model,
      "command", msg.command,
      "scheduledFor", msg.scheduledFor
    ];

    const resp = await fetch(`${url}/`, {
      method: "POST",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        : {
            "Content-Type": "application/json"
          },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[evaluator] Redis XADD failed: ${resp.status} ${text}`);
      continue;
    }

    published++;
  }

  return published;
}
