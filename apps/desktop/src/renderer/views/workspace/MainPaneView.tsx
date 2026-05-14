import { Box, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { PaneLeaf } from "../../store/split-pane-domain";
import { splitPaneStore } from "../../store/splitPaneStore";
import { tabStore } from "../../store/tabStore";
import type { WorkspaceTab } from "../../store/types";
import { workspaceStore } from "../../store/workspaceStore";
import { DARK_SURFACE_COLORS } from "../../theme";
import { LaunchView } from "./LaunchView";
import { MainPaneTitleBarView } from "./MainPaneTitleBarView";
import { BrowserView } from "./browser/BrowserView";
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
  opencode: {
    title: "OpenCode",
    command: "opencode",
  },
  codex: {
    title: "Codex",
    command: "codex",
  },
  claude: {
    title: "Claude",
    command: "claude",
  },
  gemini: {
    title: "Gemini",
    command: "gemini",
  },
  pi: {
    title: "Pi",
    command: "pi",
  },
  copilot: {
    title: "Copilot",
    command: "copilot",
  },
  cursor: {
    title: "Cursor",
    command: "cursor",
  },
};

/** Creates a terminal tab payload that launches one agent CLI command. */
function buildAgentTerminalInput(agentKind: DesktopAgentKind) {
  const config = agentTerminalConfigs[agentKind];
  return {
    kind: "terminal" as const,
    title: config.title,
    launchCommand: config.command,
    agentKind,
    reuseExisting: false,
  };
}

/** Creates a plain terminal tab payload without one prefilled launch command. */
function buildTerminalInput(title: string) {
  return {
    kind: "terminal" as const,
    title,
    reuseExisting: false,
  };
}

function buildBrowserInput() {
  return {
    kind: "browser" as const,
    url: "",
  };
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

/** Renders the primary workspace pane with split-pane tabbed content, per-tab views, and pane visibility controls. */
export function MainPaneView() {
  const { t } = useTranslation();
  const cmd = useCommands();
  const workspaces = workspaceStore((state) => state.workspaces);
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const tabs = tabStore((state) => state.tabs);
  const selectedTabId = tabStore((state) => state.selectedTabId);
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId);
  const lastUsedExternalAppId = workspaceStore((state) => state.lastUsedExternalAppId);
  const lastUsedExternalAppPreset = lastUsedExternalAppId ? findExternalAppPreset(lastUsedExternalAppId) : null;
  const externalAppLabel = lastUsedExternalAppPreset
    ? `Open in ${lastUsedExternalAppPreset.label}`
    : "Open in external app";
  const handleOpenExternalApp = async (filePath: string) => {
    const workspaceWorktreePath = selectedWorkspace?.worktreePath;
    if (!workspaceWorktreePath) {
      return;
    }

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
  const workspaceTabs = tabs.filter((tab) => tab.workspaceId === selectedWorkspaceId);

  const hasWorkspaceTabs = workspaceTabs.length > 0;
  const enabledAgentKinds = useMemo(
    () => SUPPORTED_DESKTOP_AGENT_KINDS.filter((agentKind) => inUseByAgentKind[agentKind]),
    [inUseByAgentKind],
  );
  const enabledAgentKindSet = useMemo(() => new Set(enabledAgentKinds), [enabledAgentKinds]);
  const [focusContentRequestKey, setFocusContentRequestKey] = useState(0);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const didTrackSelectedTabRef = useRef(false);

  // Split pane store
  const splitRoot = splitPaneStore((state) => state.root);
  const activePaneId = splitPaneStore((state) => state.activePaneId);

  // Build a map from tab id to tab data for efficient lookups
  const tabById = useMemo(() => {
    const map = new Map<string, WorkspaceTab>();
    for (const tab of workspaceTabs) {
      map.set(tab.id, tab);
    }
    return map;
  }, [workspaceTabs]);

  // Sync workspace tabs into the split pane store when tabs change.
  // We track workspace tab ids and ensure they're in the pane layout.
  const previousTabIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const currentTabIds = new Set(workspaceTabs.map((tab) => tab.id));
    const previousTabIds = previousTabIdsRef.current;

    // Find newly added tabs
    for (const tabId of currentTabIds) {
      if (!previousTabIds.has(tabId)) {
        // Check if this tab is already in some pane (e.g., from a split operation)
        const existingPane = splitPaneStore.getState().getPaneForTab(tabId);
        if (!existingPane) {
          splitPaneStore.getState().addTab(tabId);
        }
      }
    }

    // Find removed tabs
    for (const tabId of previousTabIds) {
      if (!currentTabIds.has(tabId)) {
        splitPaneStore.getState().removeTab(tabId);
      }
    }

    previousTabIdsRef.current = currentTabIds;
  }, [workspaceTabs]);

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
          return result;
        }

        if (tab.kind === "diff") {
          result.push({ id: tab.id, kind: "diff", path: tab.data.path, source: tab.data.source });
          return result;
        }

        return result;
      }, []),
    [workspaceTabs],
  );

  useOpenTabAutoRefresh({
    workspaceWorktreePath: selectedWorkspace?.worktreePath,
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

  useEffect(() => {
    if (!didTrackSelectedTabRef.current) {
      didTrackSelectedTabRef.current = true;
      return;
    }

    if (!selectedTabId) {
      return;
    }

    setFocusContentRequestKey((requestKey) => requestKey + 1);
  }, [selectedTabId]);

  /** Handles tab selection from a specific pane. */
  const handleSelectTab = useCallback(
    (paneId: string, tabId: string) => {
      splitPaneStore.getState().selectTab(paneId, tabId);
      cmd.setSelectedTabId(tabId);
    },
    [cmd],
  );

  /** Handles tab close -- remove from both stores. */
  const handleCloseTab = useCallback(
    (tabId: string) => {
      splitPaneStore.getState().removeTab(tabId);
      cmd.closeTab(tabId);
    },
    [cmd],
  );

  /** Handles tab creation from the tab bar type selector menu. */
  const handleCreateTab = useCallback(
    (option: TabBarCreateOption) => {
      if (option === "terminal") {
        cmd.openTab({
          workspaceId: selectedWorkspaceId,
          ...buildTerminalInput(t("terminal.title")),
        });
        return;
      }

      if (option === "browser") {
        cmd.openTab({
          workspaceId: selectedWorkspaceId,
          ...buildBrowserInput(),
          reuseExisting: false,
        });
        return;
      }

      if (!enabledAgentKindSet.has(option)) {
        return;
      }

      cmd.openTab({
        workspaceId: selectedWorkspaceId,
        ...buildAgentTerminalInput(option),
      });
    },
    [cmd, selectedWorkspaceId, enabledAgentKindSet, t],
  );

  /** Handles tab rename. */
  const handleRenameTab = useCallback(
    async (tabId: string, title: string) => {
      const tab = workspaceTabs.find((item) => item.id === tabId);
      if (!tab) {
        return;
      }

      if (tab.kind !== "file") {
        cmd.renameTab(tabId, title, { userRenamed: true });
        return;
      }

      const workspaceWorktreePath = selectedWorkspace?.worktreePath;
      if (!workspaceWorktreePath) {
        return;
      }

      const pathSegments = tab.data.path.split("/").filter(Boolean);
      const parentPath = pathSegments.slice(0, -1).join("/");
      const targetPath = parentPath ? `${parentPath}/${title}` : title;
      if (targetPath === tab.data.path) {
        return;
      }

      try {
        await cmd.renameEntry({
          workspaceWorktreePath,
          fromRelativePath: tab.data.path,
          toRelativePath: targetPath,
        });
        cmd.renameTabsForEntryRename(selectedWorkspaceId, tab.data.path, targetPath);
      } catch (error) {
        console.error("Failed to rename workspace file from tab", error);
      }
    },
    [cmd, workspaceTabs, selectedWorkspace, selectedWorkspaceId],
  );

  /** Handles tab reorder within a pane. */
  const handleReorderTab = useCallback(
    (paneId: string, draggedTabId: string, targetTabId: string, position: "before" | "after") => {
      splitPaneStore.getState().reorderTab(paneId, draggedTabId, targetTabId, position);
    },
    [],
  );

  /** Handles the split drop -- move a tab into a split. */
  const handleSplitDrop = useCallback(
    (tabId: string, targetPaneId: string, region: SplitDropRegion) => {
      const result = resolveDropResult(region);
      if (!result) return;

      if ("center" in result) {
        // Move tab into existing pane
        splitPaneStore.getState().moveTab(tabId, targetPaneId);
      } else {
        // Create a new split
        splitPaneStore.getState().splitPane({
          tabId,
          targetPaneId,
          direction: result.direction,
          placement: result.placement,
        });
      }

      setIsDraggingSplit(false);
    },
    [],
  );

  /** Focuses a pane when clicked. */
  const handleFocusPane = useCallback(
    (paneId: string) => {
      splitPaneStore.getState().setActivePane(paneId);
      // Also select the pane's current tab in the tab store
      const pane = splitPaneStore.getState().getPane(paneId);
      if (pane?.selectedTabId) {
        cmd.setSelectedTabId(pane.selectedTabId);
      }
    },
    [cmd],
  );

  const handleTabDragStart = useCallback(() => {
    setIsDraggingSplit(true);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    setIsDraggingSplit(false);
  }, []);

  /** Builds the tab icon for a given tab. */
  const getTabIcon = useCallback(
    (tab: { id: string; kind?: string }) => {
      const fullTab = tabById.get(tab.id);

      if (fullTab?.kind === "terminal") {
        return <LuSquareTerminal size={14} />;
      }

      if (fullTab?.kind === "browser") {
        return <FaviconIcon url={fullTab.data.faviconUrl} size={14} />;
      }

      if (fullTab?.kind === "file" || fullTab?.kind === "diff" || fullTab?.kind === "image") {
        return (
          <Box
            component="img"
            src={getFileTreeIcon(fullTab.data.path, false)}
            alt=""
            sx={{ width: 14, height: 14, flexShrink: 0 }}
          />
        );
      }

      return null;
    },
    [tabById],
  );

  /** Renders the tab content for a given tab within a pane. */
  const renderTabContent = useCallback(
    (tab: WorkspaceTab, isSelected: boolean) => {
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
                description={
                  tab.data.unsupportedReason === "size"
                    ? t("files.unsupported.descriptionLarge")
                    : t("files.unsupported.description")
                }
                hint={
                  tab.data.unsupportedReason === "size"
                    ? t("files.unsupported.hintLarge")
                    : t("files.unsupported.hint")
                }
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
              worktreePath={selectedWorkspace?.worktreePath}
              isDeleted={Boolean(tab.data.isDeleted)}
              focusRequestKey={isSelected ? focusContentRequestKey : 0}
              onContentChange={(nextContent) => {
                cmd.updateFileTabContent(tab.id, nextContent);
              }}
              onSave={async (nextContent) => {
                const workspaceWorktreePath = selectedWorkspace?.worktreePath;
                if (!workspaceWorktreePath) {
                  return;
                }

                try {
                  await cmd.writeFile({
                    workspaceWorktreePath,
                    relativePath: tab.data.path,
                    content: nextContent,
                  });

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
            <Box
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.5,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Chat is currently disabled.
              </Typography>
            </Box>
          </TabPanel>
        );
      }

      if (tab.kind === "browser") {
        return (
          <Box
            key={tab.id}
            sx={{
              position: "absolute",
              inset: 0,
              display: isSelected ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            <BrowserView tabId={tab.id} initialUrl={tab.data.url} />
          </Box>
        );
      }

      if (tab.kind === "terminal") {
        return (
          <Box
            key={tab.id}
            sx={{
              display: isSelected ? "flex" : "none",
              flexDirection: "column",
              height: "100%",
            }}
          >
            <TerminalView tabId={tab.id} focusRequestKey={isSelected ? focusContentRequestKey : 0} />
          </Box>
        );
      }

      return null;
    },
    [t, cmd, selectedWorkspace, externalAppLabel, handleOpenExternalApp, focusContentRequestKey, copyToClipboard],
  );

  /** Renders the content for a single pane leaf. */
  const renderPaneContent = useCallback(
    (pane: PaneLeaf) => {
      return (
        <>
          {pane.tabIds.map((tabId) => {
            const tab = tabById.get(tabId);
            if (!tab) return null;
            const isSelected = tabId === pane.selectedTabId;
            return renderTabContent(tab, isSelected);
          })}
        </>
      );
    },
    [tabById, renderTabContent],
  );

  /** Renders one pane leaf as a SplitPaneGroup. */
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
          onFocusPane={handleFocusPane}
          onTabDragStart={handleTabDragStart}
          onTabDragEnd={handleTabDragEnd}
          getTabIcon={getTabIcon}
          enabledAgentKinds={enabledAgentKinds}
          disabled={!selectedWorkspaceId}
          renderContent={renderPaneContent}
        />
      );
    },
    [
      activePaneId,
      isDraggingSplit,
      tabById,
      handleSelectTab,
      handleCloseTab,
      cmd,
      handleReorderTab,
      handleCreateTab,
      handleRenameTab,
      handleSplitDrop,
      handleFocusPane,
      handleTabDragStart,
      handleTabDragEnd,
      getTabIcon,
      enabledAgentKinds,
      selectedWorkspaceId,
      renderPaneContent,
    ],
  );

  /** Handles split ratio changes from separator drags. */
  const handleSplitRatioChange = useCallback((branchId: string, ratio: number) => {
    splitPaneStore.getState().updateSplitRatio(branchId, ratio);
  }, []);

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
        {hasWorkspaceTabs ? (
          <SplitPaneContainer
            node={splitRoot}
            renderPane={renderPane}
            onSplitRatioChange={handleSplitRatioChange}
          />
        ) : (
          <TabPanel active>
            <LaunchView />
          </TabPanel>
        )}

      </Box>
    </Box>
  );
}
