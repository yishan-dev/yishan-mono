export type DispatchMessage = {
  runId: string;
  nodeId: string;
  jobId: string;
  agentKind: string;
  prompt: string;
  model: string;
  command: string;
  scheduledFor: string;
};

export type QStashEnv = {
  QSTASH_TOKEN?: string;
  RELAY_URL?: string;
  RELAY_API_TOKEN?: string;
};

const QSTASH_PUBLISH_URL = "https://qstash.upstash.io/v2/publish/";
const RELAY_DISPATCH_PATH = "/api/v1/dispatch";

/**
 * Publish scheduled job run messages via Upstash QStash to the relay service.
 *
 * QStash delivers each message to the relay's dispatch endpoint with at-least-once
 * guarantees and automatic retries. The relay then pushes the job to the daemon
 * over its persistent WebSocket connection.
 */
export async function publishViaQStash(
  env: QStashEnv,
  messages: DispatchMessage[]
): Promise<number> {
  const token = env.QSTASH_TOKEN;
  const relayURL = env.RELAY_URL;
  const relayAPIToken = env.RELAY_API_TOKEN;

  if (!token) {
    console.warn("[evaluator] QSTASH_TOKEN not configured, skipping dispatch");
    return 0;
  }
  if (!relayURL) {
    console.warn("[evaluator] RELAY_URL not configured, skipping dispatch");
    return 0;
  }

  const destination = `${relayURL}${RELAY_DISPATCH_PATH}`;
  let published = 0;

  for (const msg of messages) {
    const resp = await fetch(`${QSTASH_PUBLISH_URL}${destination}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Forward the relay API token to the destination
        ...(relayAPIToken ? { "Upstash-Forward-Authorization": `Bearer ${relayAPIToken}` } : {}),
      },
      body: JSON.stringify({
        runId: msg.runId,
        jobId: msg.jobId,
        nodeId: msg.nodeId,
        scheduledFor: msg.scheduledFor,
        payload: {
          agentKind: msg.agentKind,
          prompt: msg.prompt,
          model: msg.model,
          command: msg.command,
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[evaluator] QStash publish failed for run ${msg.runId}: ${resp.status} ${text}`);
      continue;
    }

    published++;
  }

  return published;
}
