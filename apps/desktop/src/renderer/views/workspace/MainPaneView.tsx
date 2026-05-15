import { Box, Typography } from "@mui/material";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { LuGlobe, LuSquareTerminal } from "react-icons/lu";
import { SYSTEM_FILE_MANAGER_APP_ID, findExternalAppPreset } from "../../../shared/contracts/externalApps";
import { copyToClipboard } from "../../helpers/clipboard";
import { FileEditor } from "../../components/FileEditor";
import { FileDiffViewer } from "../../components/FileDiffViewer";
import { ImagePreview } from "../../components/ImagePreview";
import { TabPanel } from "../../components/TabPanel";
import { UnsupportedFileView } from "../../components/UnsupportedFileView";
import type { TabBarCreateOption } from "../../components/TabBar";
import { SplitPaneGroup } from "../../components/SplitPaneGroup";
import { SplitPaneContainer } from "../../components/SplitPaneContainer";
import { resolveDropResult, type SplitDropRegion } from "../../components/SplitDropZone";
import { getFileTreeIcon } from "../../components/fileTreeIcons";
import { type DesktopAgentKind, SUPPORTED_DESKTOP_AGENT_KINDS } from "../../helpers/agentSettings";
import { useCommands } from "../../hooks/useCommands";
import { type RefreshableOpenTab, useOpenTabAutoRefresh } from "../../hooks/useOpenTabAutoRefresh";
import { agentSettingsStore } from "../../store/agentSettingsStore";
import type { PaneLeaf, SplitPaneNode } from "../../store/split-pane-domain";
import { splitPaneStore } from "../../store/splitPaneStore";
import { tabStore } from "../../store/tabStore";
import type { WorkspaceTab } from "../../store/types";
import { workspaceStore } from "../../store/workspaceStore";
import { DARK_SURFACE_COLORS } from "../../theme";
import { LaunchView } from "./LaunchView";
import { MainPaneTitleBarView } from "./MainPaneTitleBarView";
import { BrowserView } from "./browser/BrowserView";
import { removeWebviewsForClosedTabs } from "./browser/webviewRegistry";
import { getOrCreateRuntimeRoot } from "./runtime/runtimeRoot";
import { TerminalView } from "./terminal/TerminalView";

function FaviconIcon({ url, size }: { url?: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return <LuGlobe size={size} />;
  }
  return (
    <Box
      component="img"
      src={url}
      alt=""
      sx={{ width: size, height: size, flexShrink: 0, objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
}

const agentTerminalConfigs: Record<
  Extract<TabBarCreateOption, DesktopAgentKind>,
  { title: string; command: string }
> = {
  opencode: { title: "OpenCode", command: "opencode" },
  codex: { title: "Codex", command: "codex" },
  claude: { title: "Claude", command: "claude" },
  gemini: { title: "Gemini", command: "gemini" },
  pi: { title: "Pi", command: "pi" },
  copilot: { title: "Copilot", command: "copilot" },
  cursor: { title: "Cursor", command: "cursor" },
};

function buildAgentTerminalInput(agentKind: DesktopAgentKind) {
  const config = agentTerminalConfigs[agentKind];
  return { kind: "terminal" as const, title: config.title, launchCommand: config.command, agentKind, reuseExisting: false };
}

function buildTerminalInput(title: string) {
  return { kind: "terminal" as const, title, reuseExisting: false };
}

function buildBrowserInput() {
  return { kind: "browser" as const, url: "" };
}

function collectPaneLeaves(node: SplitPaneNode | null | undefined): PaneLeaf[] {
  if (!node) {
    return [];
  }
  if (node.kind === "leaf") {
    return [node];
  }
  return [...collectPaneLeaves(node.first), ...collectPaneLeaves(node.second)];
}

/** Converts a full WorkspaceTab to the lightweight descriptor used by TabBar/SplitPaneGroup. */
function toTabBarDescriptor(tab: WorkspaceTab) {
  return {
    id: tab.id,
    title: tab.title,
    pinned: tab.pinned,
    kind: tab.kind,
    isDirty: tab.kind === "file" ? tab.data.isDirty : false,
    isTemporary: ["file", "image", "diff"].includes(tab.kind)
      ? (tab.data as { isTemporary: boolean }).isTemporary
      : false,
  };
}

// ─── Per-workspace split pane ──────────────────────────────────────────────────

type WorkspaceSplitPaneProps = {
  workspaceId: string;
  isActive: boolean;
  workspaceTabs: WorkspaceTab[];
};

/**
 * Renders the split-pane layout for a single workspace.
 *
 * Each workspace gets its own instance, kept mounted in the DOM and hidden via
 * `display: none` when inactive, so terminals/editors preserve their state.
 */
function WorkspaceSplitPane({ workspaceId, isActive, workspaceTabs }: WorkspaceSplitPaneProps) {
  const { t } = useTranslation();
  const cmd = useCommands();
  const workspaces = workspaceStore((state) => state.workspaces);
  const selectedTabId = tabStore((state) => state.selectedTabId);
  const workspace = workspaces.find((ws) => ws.id === workspaceId);
  const lastUsedExternalAppId = workspaceStore((state) => state.lastUsedExternalAppId);
  const lastUsedExternalAppPreset = lastUsedExternalAppId ? findExternalAppPreset(lastUsedExternalAppId) : null;
  const externalAppLabel = lastUsedExternalAppPreset
    ? `Open in ${lastUsedExternalAppPreset.label}`
    : "Open in external app";
  const handleOpenExternalApp = async (filePath: string) => {
    const workspaceWorktreePath = workspace?.worktreePath;
    if (!workspaceWorktreePath) return;
    try {
      await cmd.openEntryInExternalApp({
        workspaceWorktreePath,
        appId: lastUsedExternalAppId ?? SYSTEM_FILE_MANAGER_APP_ID,
        relativePath: filePath,
      });
    } catch (error) {
      console.error("Failed to open workspace file externally", error);
    }
  };

  const inUseByAgentKind = agentSettingsStore((state) => state.inUseByAgentKind);
  const enabledAgentKinds = useMemo(
    () => SUPPORTED_DESKTOP_AGENT_KINDS.filter((agentKind) => inUseByAgentKind[agentKind]),
    [inUseByAgentKind],
  );
  const enabledAgentKindSet = useMemo(() => new Set(enabledAgentKinds), [enabledAgentKinds]);

  const [focusContentRequestKey, setFocusContentRequestKey] = useState(0);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const didTrackSelectedTabRef = useRef(false);
  const didSyncPaneSelectionRef = useRef(false);
  const [panePlaceholders, setPanePlaceholders] = useState<Record<string, HTMLDivElement | null>>({});
  const [layoutVersion, setLayoutVersion] = useState(0);
  const lastKnownRectByTabIdRef = useRef<Record<string, { left: number; top: number; width: number; height: number }>>({});

  // Read this workspace's layout from the store
  const layout = splitPaneStore((state) => state.layoutByWorkspaceId[workspaceId]);
  const splitRoot = layout?.root;
  const activePaneId = layout?.activePaneId ?? "";

  // Tab id → tab data map
  const tabById = useMemo(() => {
    const map = new Map<string, WorkspaceTab>();
    for (const tab of workspaceTabs) {
      map.set(tab.id, tab);
    }
    return map;
  }, [workspaceTabs]);

  // Sync workspace tabs into this workspace's layout
  const previousTabIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentTabIds = new Set(workspaceTabs.map((tab) => tab.id));
    const previousTabIds = previousTabIdsRef.current;

    for (const tabId of currentTabIds) {
      if (!previousTabIds.has(tabId)) {
        const existingPane = splitPaneStore.getState().getPaneForTab(workspaceId, tabId);
        if (!existingPane) {
          splitPaneStore.getState().addTab(workspaceId, tabId);
        }
      }
    }

    for (const tabId of previousTabIds) {
      if (!currentTabIds.has(tabId)) {
        splitPaneStore.getState().removeTab(workspaceId, tabId);
      }
    }

    previousTabIdsRef.current = currentTabIds;
  }, [workspaceId, workspaceTabs]);

  // Sync tabStore.selectedTabId to splitPaneStore when a tab is selected programmatically
  // (e.g. openTab reusing an existing temporary tab, or selecting an already-open file)
  useEffect(() => {
    if (!didSyncPaneSelectionRef.current) {
      didSyncPaneSelectionRef.current = true;
      return;
    }
    if (!selectedTabId || !isActive) return;

    const tab = tabById.get(selectedTabId);
    if (!tab || tab.workspaceId !== workspaceId) return;

    const pane = splitPaneStore.getState().getPaneForTab(workspaceId, selectedTabId);
    if (!pane) return;

    if (pane.selectedTabId !== selectedTabId || activePaneId !== pane.id) {
      splitPaneStore.getState().selectTab(workspaceId, pane.id, selectedTabId);
    }
  }, [selectedTabId, isActive, workspaceId, activePaneId, tabById]);

  // Auto-refresh open file/diff tabs
  const refreshableTabs = useMemo(
    (): RefreshableOpenTab[] =>
      workspaceTabs.reduce<RefreshableOpenTab[]>((result, tab) => {
        if (tab.kind === "file") {
          result.push({
            id: tab.id,
            kind: "file",
            path: tab.data.path,
            isDirty: tab.data.isDirty,
            isUnsupported: Boolean(tab.data.isUnsupported),
          });
        } else if (tab.kind === "diff") {
          result.push({ id: tab.id, kind: "diff", path: tab.data.path, source: tab.data.source });
        }
        return result;
      }, []),
    [workspaceTabs],
  );

  useOpenTabAutoRefresh({
    workspaceWorktreePath: workspace?.worktreePath,
    tabs: refreshableTabs,
    commands: {
      readFile: cmd.readFile,
      readDiff: cmd.readDiff,
      readCommitDiff: cmd.readCommitDiff,
      readBranchComparisonDiff: cmd.readBranchComparisonDiff,
      refreshFileTabFromDisk: cmd.refreshFileTabFromDisk,
      refreshDiffTabContent: cmd.refreshDiffTabContent,
    },
  });

  // Focus content when the selected tab changes
  useEffect(() => {
    if (!didTrackSelectedTabRef.current) {
      didTrackSelectedTabRef.current = true;
      return;
    }
    if (!selectedTabId || !isActive) return;
    setFocusContentRequestKey((k) => k + 1);
  }, [selectedTabId, isActive]);

  const handleSelectTab = useCallback(
    (paneId: string, tabId: string) => {
      splitPaneStore.getState().selectTab(workspaceId, paneId, tabId);
      cmd.setSelectedTabId(tabId);
    },
    [workspaceId, cmd],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      splitPaneStore.getState().removeTab(workspaceId, tabId);
      cmd.closeTab(tabId);
    },
    [workspaceId, cmd],
  );

  const handleCreateTab = useCallback(
    (option: TabBarCreateOption) => {
      if (option === "terminal") {
        cmd.openTab({ workspaceId, ...buildTerminalInput(t("terminal.title")) });
        return;
      }
      if (option === "browser") {
        cmd.openTab({ workspaceId, ...buildBrowserInput(), reuseExisting: false });
        return;
      }
      if (!enabledAgentKindSet.has(option)) return;
      cmd.openTab({ workspaceId, ...buildAgentTerminalInput(option) });
    },
    [cmd, workspaceId, enabledAgentKindSet, t],
  );

  const handleRenameTab = useCallback(
    async (tabId: string, title: string) => {
      const tab = workspaceTabs.find((item) => item.id === tabId);
      if (!tab) return;

      if (tab.kind !== "file") {
        cmd.renameTab(tabId, title, { userRenamed: true });
        return;
      }

      const workspaceWorktreePath = workspace?.worktreePath;
      if (!workspaceWorktreePath) return;

      const pathSegments = tab.data.path.split("/").filter(Boolean);
      const parentPath = pathSegments.slice(0, -1).join("/");
      const targetPath = parentPath ? `${parentPath}/${title}` : title;
      if (targetPath === tab.data.path) return;

      try {
        await cmd.renameEntry({ workspaceWorktreePath, fromRelativePath: tab.data.path, toRelativePath: targetPath });
        cmd.renameTabsForEntryRename(workspaceId, tab.data.path, targetPath);
      } catch (error) {
        console.error("Failed to rename workspace file from tab", error);
      }
    },
    [cmd, workspaceTabs, workspace, workspaceId],
  );

  const handleReorderTab = useCallback(
    (paneId: string, draggedTabId: string, targetTabId: string, position: "before" | "after") => {
      splitPaneStore.getState().reorderTab(workspaceId, paneId, draggedTabId, targetTabId, position);
    },
    [workspaceId],
  );

  const handleSplitDrop = useCallback(
    (tabId: string, targetPaneId: string, region: SplitDropRegion) => {
      const result = resolveDropResult(region);
      if (!result) return;

      if ("center" in result) {
        splitPaneStore.getState().moveTab(workspaceId, tabId, targetPaneId);
      } else {
        splitPaneStore.getState().splitPane(workspaceId, {
          tabId,
          targetPaneId,
          direction: result.direction,
          placement: result.placement,
        });
      }

      cmd.setSelectedTabId(tabId);
      setFocusContentRequestKey((key) => key + 1);

      setIsDraggingSplit(false);
    },
    [workspaceId, cmd],
  );

  const handleFocusPane = useCallback(
    (paneId: string) => {
      splitPaneStore.getState().setActivePane(workspaceId, paneId);
      const pane = splitPaneStore.getState().getPane(workspaceId, paneId);
      if (pane?.selectedTabId) {
        cmd.setSelectedTabId(pane.selectedTabId);
      }
    },
    [workspaceId, cmd],
  );

  const handleTabDragStart = useCallback(() => setIsDraggingSplit(true), []);
  const handleTabDragEnd = useCallback(() => setIsDraggingSplit(false), []);

  /** Splits the selected tab out of a pane into a new sibling pane. */
  const performSplit = useCallback(
    (paneId: string, direction: "horizontal" | "vertical") => {
      const pane = splitPaneStore.getState().getPane(workspaceId, paneId);
      if (!pane?.selectedTabId || pane.tabIds.length <= 1) return;
      const movedTabId = pane.selectedTabId;
      splitPaneStore.getState().splitPane(workspaceId, {
        tabId: movedTabId,
        targetPaneId: paneId,
        direction,
        placement: "second",
      });
      cmd.setSelectedTabId(movedTabId);
      setFocusContentRequestKey((key) => key + 1);
    },
    [workspaceId, cmd],
  );

  const handleSplitRight = useCallback(
    (paneId: string) => performSplit(paneId, "horizontal"),
    [performSplit],
  );

  const handleSplitDown = useCallback(
    (paneId: string) => performSplit(paneId, "vertical"),
    [performSplit],
  );

  const getTabIcon = useCallback(
    (tab: { id: string; kind?: string }) => {
      const fullTab = tabById.get(tab.id);
      if (fullTab?.kind === "terminal") return <LuSquareTerminal size={14} />;
      if (fullTab?.kind === "browser") return <FaviconIcon url={fullTab.data.faviconUrl} size={14} />;
      if (fullTab?.kind === "file" || fullTab?.kind === "diff" || fullTab?.kind === "image") {
        return (
          <Box component="img" src={getFileTreeIcon(fullTab.data.path, false)} alt="" sx={{ width: 14, height: 14, flexShrink: 0 }} />
        );
      }
      return null;
    },
    [tabById],
  );

  const renderTabContent = useCallback(
    (tab: WorkspaceTab, isSelected: boolean, isInActivePane: boolean) => {
      const shouldFocusContent = isSelected && isInActivePane;
      if (tab.kind === "diff") {
        return (
          <TabPanel key={tab.id} active={isSelected}>
            <FileDiffViewer
              filePath={tab.data.path}
              oldContent={tab.data.oldContent ?? ""}
              newContent={tab.data.newContent ?? ""}
            />
          </TabPanel>
        );
      }

      if (tab.kind === "file") {
        if (tab.data.isUnsupported) {
          return (
            <TabPanel key={tab.id} active={isSelected}>
              <UnsupportedFileView
                path={tab.data.path}
                title={t("files.unsupported.title")}
                description={tab.data.unsupportedReason === "size" ? t("files.unsupported.descriptionLarge") : t("files.unsupported.description")}
                hint={tab.data.unsupportedReason === "size" ? t("files.unsupported.hintLarge") : t("files.unsupported.hint")}
                onCopyPath={copyToClipboard}
                onOpenExternalApp={handleOpenExternalApp}
                openExternalAppLabel={externalAppLabel}
              />
            </TabPanel>
          );
        }

        return (
          <TabPanel key={tab.id} active={isSelected}>
            <FileEditor
              path={tab.data.path}
              content={tab.data.content ?? ""}
              worktreePath={workspace?.worktreePath}
              isDeleted={Boolean(tab.data.isDeleted)}
              focusRequestKey={shouldFocusContent ? focusContentRequestKey : 0}
              onContentChange={(nextContent) => cmd.updateFileTabContent(tab.id, nextContent)}
              onSave={async (nextContent) => {
                const workspaceWorktreePath = workspace?.worktreePath;
                if (!workspaceWorktreePath) return;
                try {
                  await cmd.writeFile({ workspaceWorktreePath, relativePath: tab.data.path, content: nextContent });
                  cmd.updateFileTabContent(tab.id, nextContent);
                  cmd.markFileTabSaved(tab.id);
                } catch (error) {
                  console.error("Failed to save workspace file", error);
                }
              }}
              onCopyPath={copyToClipboard}
              onOpenExternalApp={handleOpenExternalApp}
              openExternalAppLabel={externalAppLabel}
            />
          </TabPanel>
        );
      }

      if (tab.kind === "image") {
        return (
          <TabPanel key={tab.id} active={isSelected}>
            <ImagePreview
              path={tab.data.path}
              dataUrl={tab.data.dataUrl}
              onCopyPath={copyToClipboard}
              onOpenExternalApp={handleOpenExternalApp}
              openExternalAppLabel={externalAppLabel}
            />
          </TabPanel>
        );
      }

      if (tab.kind === "session") {
        return (
          <TabPanel key={tab.id} active={isSelected}>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Chat is currently disabled.
              </Typography>
            </Box>
          </TabPanel>
        );
      }

      if (tab.kind === "browser") {
        return (
          <Box key={tab.id} sx={{ position: "absolute", inset: 0, display: isSelected ? "flex" : "none", flexDirection: "column" }}>
            <BrowserView tabId={tab.id} initialUrl={tab.data.url} />
          </Box>
        );
      }

      if (tab.kind === "terminal") {
        return (
          <Box key={tab.id} sx={{ display: isSelected ? "flex" : "none", flexDirection: "column", height: "100%" }}>
            <TerminalView tabId={tab.id} focusRequestKey={shouldFocusContent ? focusContentRequestKey : 0} />
          </Box>
        );
      }

      return null;
    },
    [t, cmd, workspace, externalAppLabel, handleOpenExternalApp, focusContentRequestKey, copyToClipboard],
  );

  const renderTabSurface = useCallback(
    (
      tab: WorkspaceTab,
      isSelected: boolean,
      isInActivePane: boolean,
      rect: { left: number; top: number; width: number; height: number } | null,
    ) => {
      const hasArea = Boolean(rect && rect.width > 1 && rect.height > 1);
      if (hasArea && rect) {
        lastKnownRectByTabIdRef.current[tab.id] = rect;
      }
      const effectiveRect = rect ?? lastKnownRectByTabIdRef.current[tab.id] ?? null;
      const shouldShow = isActive && isSelected && Boolean(effectiveRect && effectiveRect.width > 1 && effectiveRect.height > 1);
      const style = effectiveRect
        ? {
            position: "fixed" as const,
            left: effectiveRect.left,
            top: effectiveRect.top,
            width: effectiveRect.width,
            height: effectiveRect.height,
            display: shouldShow ? "flex" : "none",
            flexDirection: "column" as const,
            pointerEvents: shouldShow && !isDraggingSplit ? "auto" : "none",
          }
        : {
            position: "absolute" as const,
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            display: "none",
            pointerEvents: "none",
          };

      return (
        <Box key={tab.id} sx={style}>
          {renderTabContent(tab, isSelected, isInActivePane)}
        </Box>
      );
    },
    [isActive, isDraggingSplit, renderTabContent],
  );

  const renderPaneContent = useCallback(
    (_pane: PaneLeaf, _placeholder: HTMLDivElement | null) => null,
    [],
  );

  const handleContentPlaceholderChange = useCallback((paneId: string, placeholder: HTMLDivElement | null) => {
    setPanePlaceholders((prev) => (prev[paneId] === placeholder ? prev : { ...prev, [paneId]: placeholder }));
  }, []);

  const tabPlacements = useMemo(() => {
    const placements = new Map<string, { selected: boolean; activePane: boolean; rect: { left: number; top: number; width: number; height: number } | null }>();
    if (!splitRoot) {
      return placements;
    }
    const leaves = collectPaneLeaves(splitRoot);
    for (const pane of leaves) {
      const placeholder = panePlaceholders[pane.id];
      let rect: { left: number; top: number; width: number; height: number } | null = null;
      if (placeholder) {
        const bounds = placeholder.getBoundingClientRect();
        rect = {
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        };
      }
      for (const tabId of pane.tabIds) {
        placements.set(tabId, { selected: tabId === pane.selectedTabId, activePane: pane.id === activePaneId, rect });
      }
    }
    return placements;
  }, [splitRoot, panePlaceholders, layoutVersion, activePaneId]);

  useLayoutEffect(() => {
    const observedElements = Object.values(panePlaceholders).filter(
      (element): element is HTMLDivElement => element != null,
    );
    if (observedElements.length === 0 || typeof ResizeObserver !== "function") {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setLayoutVersion((version) => version + 1);
    });

    for (const element of observedElements) {
      resizeObserver.observe(element);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [panePlaceholders]);

  const renderPane = useCallback(
    (pane: PaneLeaf) => {
      const paneTabs = pane.tabIds
        .map((tabId) => tabById.get(tabId))
        .filter((tab): tab is WorkspaceTab => tab != null)
        .sort((a, b) => {
          if (a.pinned === b.pinned) return 0;
          return a.pinned ? -1 : 1;
        })
        .map(toTabBarDescriptor);

      return (
        <SplitPaneGroup
          key={pane.id}
          pane={pane}
          isActive={pane.id === activePaneId}
          tabs={paneTabs}
          isDraggingSplit={isDraggingSplit}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onCloseOtherTabs={cmd.closeOtherTabs}
          onCloseAllTabs={cmd.closeAllTabs}
          onTogglePinTab={cmd.toggleTabPinned}
          onReorderTab={handleReorderTab}
          onCreateTab={handleCreateTab}
          onRenameTab={handleRenameTab}
          onSplitDrop={handleSplitDrop}
          onSplitRight={handleSplitRight}
          onSplitDown={handleSplitDown}
          onFocusPane={handleFocusPane}
          onTabDragStart={handleTabDragStart}
          onTabDragEnd={handleTabDragEnd}
          getTabIcon={getTabIcon}
          enabledAgentKinds={enabledAgentKinds}
          disabled={!workspaceId}
          onContentPlaceholderChange={handleContentPlaceholderChange}
          renderContent={renderPaneContent}
        />
      );
    },
    [
      activePaneId, isDraggingSplit, tabById, handleSelectTab, handleCloseTab,
      cmd, handleReorderTab, handleCreateTab, handleRenameTab, handleSplitDrop,
      handleSplitRight, handleSplitDown, handleFocusPane, handleTabDragStart,
      handleTabDragEnd, getTabIcon, enabledAgentKinds, workspaceId, handleContentPlaceholderChange, renderPaneContent,
    ],
  );

  const handleSplitRatioChange = useCallback(
    (branchId: string, ratio: number) => {
      splitPaneStore.getState().updateSplitRatio(workspaceId, branchId, ratio);
    },
    [workspaceId],
  );

  if (!splitRoot) return null;

  return (
    <Box sx={{ position: "relative", height: "100%" }}>
      <SplitPaneContainer
        node={splitRoot}
        renderPane={renderPane}
        onSplitRatioChange={handleSplitRatioChange}
      />
      {createPortal(
        <Box
          sx={{
            position: "fixed",
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            pointerEvents: "none",
            opacity: isDraggingSplit ? 0.28 : 1,
            transition: "opacity 120ms ease-out",
          }}
        >
          {workspaceTabs.map((tab) => {
            const placement = tabPlacements.get(tab.id);
            return renderTabSurface(tab, placement?.selected ?? false, placement?.activePane ?? false, placement?.rect ?? null);
          })}
        </Box>,
        getOrCreateRuntimeRoot(),
      )}
    </Box>
  );
}

// ─── Main pane view ────────────────────────────────────────────────────────────

/** Renders the primary workspace pane with split-pane tabbed content, per-tab views, and pane visibility controls. */
export function MainPaneView() {
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const tabs = tabStore((state) => state.tabs);

  useEffect(() => {
    const browserTabIds = new Set(tabs.filter((tab) => tab.kind === "browser").map((tab) => tab.id));
    removeWebviewsForClosedTabs(browserTabIds);
  }, [tabs]);

  // Group tabs by workspace to know which workspaces have content
  const workspaceIdsWithTabs = useMemo(() => {
    const ids = new Set<string>();
    for (const tab of tabs) {
      ids.add(tab.workspaceId);
    }
    return ids;
  }, [tabs]);

  const tabsByWorkspaceId = useMemo(() => {
    const map = new Map<string, WorkspaceTab[]>();
    for (const tab of tabs) {
      let list = map.get(tab.workspaceId);
      if (!list) {
        list = [];
        map.set(tab.workspaceId, list);
      }
      list.push(tab);
    }
    return map;
  }, [tabs]);

  const hasSelectedWorkspaceTabs = workspaceIdsWithTabs.has(selectedWorkspaceId);

  return (
    <Box
      data-testid="dashboard-main"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? DARK_SURFACE_COLORS.mainPane : theme.palette.background.default,
      }}
    >
      <MainPaneTitleBarView />
      <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Render a split-pane layout for each workspace that has tabs.
            Inactive workspaces are hidden via display:none but stay mounted. */}
        {Array.from(workspaceIdsWithTabs).map((wsId) => (
          <Box
            key={wsId}
            sx={{
              position: "absolute",
              inset: 0,
              display: wsId === selectedWorkspaceId ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            <WorkspaceSplitPane
              workspaceId={wsId}
              isActive={wsId === selectedWorkspaceId}
              workspaceTabs={tabsByWorkspaceId.get(wsId) ?? []}
            />
          </Box>
        ))}
        {!hasSelectedWorkspaceTabs && (
          <TabPanel active>
            <LaunchView />
          </TabPanel>
        )}
      </Box>
    </Box>
  );
}
