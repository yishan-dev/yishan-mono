import { useCallback, useEffect, useRef, useState } from "react";
import { inspectGitRepository } from "../../../commands/gitCommands";
import { getDaemonClient } from "../../../rpc/rpcTransport";
import type { DaemonWorkspacePullRequest } from "../../../rpc/daemonTypes";
import type { RepoWorkspaceItem } from "../../../store/types";

type UseWorkspaceInfoHoverInput = {
  workspaces: RepoWorkspaceItem[];
  displayWorkspaceIdByProjectId: Record<string, string>;
  closeDelayMs?: number;
};

/** Manages workspace hover popover lifecycle and branch preview loading. */
export function useWorkspaceInfoHover({
  workspaces,
  displayWorkspaceIdByProjectId,
  closeDelayMs = 120,
}: UseWorkspaceInfoHoverInput) {
  const [workspaceInfoAnchorEl, setWorkspaceInfoAnchorEl] = useState<HTMLElement | null>(null);
  const [hoveredWorkspaceId, setHoveredWorkspaceId] = useState("");
  const [hoveredWorkspaceCurrentBranch, setHoveredWorkspaceCurrentBranch] = useState("");
  const [hoveredWorkspacePullRequest, setHoveredWorkspacePullRequest] = useState<DaemonWorkspacePullRequest | undefined>();
  const workspaceInfoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWorkspaceInfoCloseTimer = useCallback(() => {
    if (!workspaceInfoCloseTimerRef.current) {
      return;
    }

    clearTimeout(workspaceInfoCloseTimerRef.current);
    workspaceInfoCloseTimerRef.current = null;
  }, []);

  const scheduleWorkspaceInfoClose = useCallback(() => {
    clearWorkspaceInfoCloseTimer();
    workspaceInfoCloseTimerRef.current = setTimeout(() => {
      setHoveredWorkspaceId("");
      setHoveredWorkspaceCurrentBranch("");
      setHoveredWorkspacePullRequest(undefined);
      setWorkspaceInfoAnchorEl(null);
      workspaceInfoCloseTimerRef.current = null;
    }, closeDelayMs);
  }, [clearWorkspaceInfoCloseTimer, closeDelayMs]);

  const handleWorkspaceInfoMouseEnter = useCallback(
    (workspaceId: string, anchorEl: HTMLElement) => {
      clearWorkspaceInfoCloseTimer();
      setHoveredWorkspaceCurrentBranch((currentBranch) => {
        if (workspaceId !== hoveredWorkspaceId) {
          return "";
        }
        return currentBranch;
      });
      setHoveredWorkspaceId(workspaceId);
      setWorkspaceInfoAnchorEl(anchorEl);
    },
    [clearWorkspaceInfoCloseTimer, hoveredWorkspaceId],
  );

  const handleWorkspaceInfoMouseLeave = useCallback(() => {
    scheduleWorkspaceInfoClose();
  }, [scheduleWorkspaceInfoClose]);

  const handleWorkspaceInfoPopoverMouseEnter = useCallback(() => {
    clearWorkspaceInfoCloseTimer();
  }, [clearWorkspaceInfoCloseTimer]);

  const handleWorkspaceInfoPopoverMouseLeave = useCallback(() => {
    scheduleWorkspaceInfoClose();
  }, [scheduleWorkspaceInfoClose]);

  useEffect(() => {
    return () => {
      clearWorkspaceInfoCloseTimer();
    };
  }, [clearWorkspaceInfoCloseTimer]);

  useEffect(() => {
    if (!hoveredWorkspaceId) {
      setHoveredWorkspaceCurrentBranch("");
      setHoveredWorkspacePullRequest(undefined);
      return;
    }

    const workspace = workspaces.find((ws) => ws.id === hoveredWorkspaceId);
    const worktreePath = workspace?.worktreePath?.trim();
    if (!worktreePath) {
      setHoveredWorkspaceCurrentBranch("");
      setHoveredWorkspacePullRequest(undefined);
      return;
    }

    let cancelled = false;
    Promise.allSettled([inspectGitRepository({ path: worktreePath }), getDaemonClient().then((client) => client.workspace.list())])
      .then(([inspectResult, daemonWorkspacesResult]) => {
        if (!cancelled) {
          setHoveredWorkspaceCurrentBranch(
            inspectResult.status === "fulfilled" ? inspectResult.value.currentBranch || "" : "",
          );
          setHoveredWorkspacePullRequest(
            daemonWorkspacesResult.status === "fulfilled"
              ? daemonWorkspacesResult.value.find((daemonWorkspace) => daemonWorkspace.path === worktreePath)?.pullRequest
              : undefined,
          );
        }
      })

    return () => {
      cancelled = true;
    };
  }, [hoveredWorkspaceId, workspaces]);

  const hoveredWorkspace = workspaces.find((workspace) => workspace.id === hoveredWorkspaceId);
  const isHoveredWorkspacePrimary = Boolean(
    hoveredWorkspace &&
      (hoveredWorkspace.kind === "local" || displayWorkspaceIdByProjectId[hoveredWorkspace.repoId] === hoveredWorkspace.id),
  );
  const isWorkspaceInfoOpen = Boolean(workspaceInfoAnchorEl) && Boolean(hoveredWorkspace);

  return {
    workspaceInfoAnchorEl,
    hoveredWorkspace,
    hoveredWorkspaceCurrentBranch,
    hoveredWorkspacePullRequest,
    isHoveredWorkspacePrimary,
    isWorkspaceInfoOpen,
    handleWorkspaceInfoMouseEnter,
    handleWorkspaceInfoMouseLeave,
    handleWorkspaceInfoPopoverMouseEnter,
    handleWorkspaceInfoPopoverMouseLeave,
  };
}
