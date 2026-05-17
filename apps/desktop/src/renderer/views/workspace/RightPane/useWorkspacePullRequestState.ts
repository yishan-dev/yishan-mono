import { useEffect, useState } from "react";
import { api } from "../../../api/client";
import type { WorkspacePullRequestRecord } from "../../../api/types";
import { workspaceStore } from "../../../store/workspaceStore";

export type WorkspacePullRequestState = {
  selectedWorkspaceId: string;
  /** The live PR from the daemon (current branch, real-time). */
  pullRequest: import("../../../rpc/daemonTypes").DaemonWorkspacePullRequest | undefined;
  /** Historical PRs from the api-service, ordered by detected_at desc. */
  historicalPullRequests: WorkspacePullRequestRecord[];
  isLoading: boolean;
};

/** Returns live and historical pull request state for the currently selected workspace. */
export function useWorkspacePullRequestState(enabled = true): WorkspacePullRequestState {
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const pullRequest = workspaceStore((state) => state.pullRequestByWorkspaceId[state.selectedWorkspaceId]);
  const workspace = workspaceStore((state) =>
    state.workspaces.find((w) => w.id === state.selectedWorkspaceId),
  );

  const [historicalPullRequests, setHistoricalPullRequests] = useState<WorkspacePullRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const orgId = workspace?.organizationId;
  const projectId = workspace?.projectId;

  useEffect(() => {
    if (!enabled || !selectedWorkspaceId || !orgId || !projectId) {
      setHistoricalPullRequests([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    api.workspacePullRequest
      .list(orgId, projectId, selectedWorkspaceId)
      .then((records) => {
        if (!cancelled) {
          setHistoricalPullRequests(records);
        }
      })
      .catch(() => {
        // Non-fatal — historical PRs are best-effort display
        if (!cancelled) {
          setHistoricalPullRequests([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, selectedWorkspaceId, orgId, projectId]);

  return {
    selectedWorkspaceId,
    pullRequest,
    historicalPullRequests,
    isLoading,
  };
}
