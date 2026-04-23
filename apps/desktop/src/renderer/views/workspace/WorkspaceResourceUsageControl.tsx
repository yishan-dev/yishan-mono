import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useInRouterContext, useLocation } from "react-router-dom";
import { ResourceUsageMenu, type ResourceUsageMenuRow } from "../../components/ResourceUsageMenu";
import { useCommands } from "../../hooks/useCommands";
import { useSharedTerminalResourceUsageSnapshot } from "../../hooks/useSharedTerminalResourceUsageSnapshot";
import type { TabStoreState } from "../../store/tabStore";
import { tabStore } from "../../store/tabStore";
import { workspaceStore } from "../../store/workspaceStore";

const MAX_VISIBLE_PROCESSES = 20;

type TerminalTab = Extract<TabStoreState["tabs"][number], { kind: "terminal" }>;

type ResourceUsageRouteCloseWatcherProps = {
  onClose: () => void;
};

/** Closes one open resource-usage dropdown whenever route changes away from workspace root. */
function ResourceUsageRouteCloseWatcher({ onClose }: ResourceUsageRouteCloseWatcherProps) {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/") {
      onClose();
    }
  }, [location.pathname, onClose]);

  return null;
}

/** Formats one CPU percentage for compact metrics display. */
function formatCpuPercent(value: number): string {
  return `${Math.max(0, value).toFixed(1)}%`;
}

/** Formats one byte value to one concise MB/GB memory label. */
function formatMemoryBytes(value: number): string {
  const safeValue = Math.max(0, value);
  const gb = safeValue / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)} GB`;
  }
  const mb = safeValue / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/** Builds one stable row id for resource menu rendering. */
function buildResourceUsageRowId(sessionId: string, pid: number): string {
  return `${sessionId}\u0000${pid}`;
}

/** Narrows one tab union entry to a terminal tab with a non-empty bound session id. */
function isTerminalTabWithSessionId(
  tab: TabStoreState["tabs"][number],
): tab is TerminalTab & { data: TerminalTab["data"] & { sessionId: string } } {
  return tab.kind === "terminal" && Boolean(tab.data.sessionId?.trim());
}

/** Renders one workspace-scoped CPU/memory summary and subprocess usage dropdown. */
export function WorkspaceResourceUsageControl() {
  const { t } = useTranslation();
  const isInRouterContext = useInRouterContext();
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const tabs = tabStore((state) => state.tabs);
  const { getTerminalResourceUsage, setSelectedTabId, setSelectedWorkspaceId } = useCommands();
  const [resourceMenuAnchorEl, setResourceMenuAnchorEl] = useState<null | HTMLElement>(null);
  const closeResourceMenu = useCallback(() => {
    setResourceMenuAnchorEl(null);
  }, []);
  const isResourceMenuOpen = Boolean(resourceMenuAnchorEl);

  const hasTerminalTabInSelectedWorkspace = useMemo(
    () => tabs.some((tab) => tab.workspaceId === selectedWorkspaceId && isTerminalTabWithSessionId(tab)),
    [tabs, selectedWorkspaceId],
  );
  const shouldPollResourceUsage = Boolean(selectedWorkspaceId && hasTerminalTabInSelectedWorkspace);
  const snapshot = useSharedTerminalResourceUsageSnapshot({
    enabled: shouldPollResourceUsage,
    interactive: isResourceMenuOpen,
    fetchSnapshot: getTerminalResourceUsage,
  });

  useEffect(() => {
    if (!shouldPollResourceUsage) {
      closeResourceMenu();
    }
  }, [closeResourceMenu, shouldPollResourceUsage]);

  const workspaceProcesses = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.processes
      .filter((process) => process.workspaceId === selectedWorkspaceId)
      .sort((left, right) => {
        if (left.cpuPercent !== right.cpuPercent) {
          return right.cpuPercent - left.cpuPercent;
        }
        if (left.memoryBytes !== right.memoryBytes) {
          return right.memoryBytes - left.memoryBytes;
        }
        return left.pid - right.pid;
      });
  }, [selectedWorkspaceId, snapshot]);

  const totalCpuPercent = useMemo(
    () => workspaceProcesses.reduce((sum, process) => sum + process.cpuPercent, 0),
    [workspaceProcesses],
  );
  const totalMemoryBytes = useMemo(
    () => workspaceProcesses.reduce((sum, process) => sum + process.memoryBytes, 0),
    [workspaceProcesses],
  );

  const rows = useMemo<ResourceUsageMenuRow[]>(
    () =>
      workspaceProcesses.slice(0, MAX_VISIBLE_PROCESSES).map((process) => ({
        id: buildResourceUsageRowId(process.sessionId, process.pid),
        processNameLabel: process.processName,
        pidLabel: String(process.pid),
        cpuLabel: formatCpuPercent(process.cpuPercent),
        memoryLabel: formatMemoryBytes(process.memoryBytes),
      })),
    [workspaceProcesses],
  );
  const sessionIdByRowId = useMemo(() => {
    const mapping = new Map<string, string>();
    for (const process of workspaceProcesses.slice(0, MAX_VISIBLE_PROCESSES)) {
      mapping.set(buildResourceUsageRowId(process.sessionId, process.pid), process.sessionId);
    }
    return mapping;
  }, [workspaceProcesses]);
  const terminalTabBySessionId = useMemo(() => {
    return new Map(tabs.filter(isTerminalTabWithSessionId).map((tab) => [tab.data.sessionId.trim(), tab]));
  }, [tabs]);

  const summaryLabel = useMemo(() => {
    return t("terminal.resourceUsage.summary", {
      cpu: formatCpuPercent(totalCpuPercent),
      memory: formatMemoryBytes(totalMemoryBytes),
    });
  }, [t, totalCpuPercent, totalMemoryBytes]);

  if (!selectedWorkspaceId || !hasTerminalTabInSelectedWorkspace) {
    return null;
  }

  return (
    <>
      {isInRouterContext ? <ResourceUsageRouteCloseWatcher onClose={closeResourceMenu} /> : null}
      <ResourceUsageMenu
        anchorEl={resourceMenuAnchorEl}
        rows={rows}
        summaryLabel={summaryLabel}
        toggleAriaLabel={t("terminal.resourceUsage.toggleLabel")}
        processColumnLabel={t("terminal.resourceUsage.columns.process")}
        pidColumnLabel={t("terminal.resourceUsage.columns.pid")}
        cpuColumnLabel={t("terminal.resourceUsage.columns.cpu")}
        memoryColumnLabel={t("terminal.resourceUsage.columns.memory")}
        emptyLabel={t("terminal.resourceUsage.empty")}
        onOpen={setResourceMenuAnchorEl}
        onClose={closeResourceMenu}
        onSelectRow={(rowId) => {
          const sessionId = sessionIdByRowId.get(rowId);
          if (!sessionId) {
            closeResourceMenu();
            return;
          }
          const targetTab = terminalTabBySessionId.get(sessionId);
          if (targetTab) {
            setSelectedWorkspaceId(targetTab.workspaceId);
            setSelectedTabId(targetTab.id);
          }
          closeResourceMenu();
        }}
      />
    </>
  );
}
