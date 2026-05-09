import { Box, Typography, darken } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSquareTerminal } from "react-icons/lu";
import { SYSTEM_FILE_MANAGER_APP_ID, findExternalAppPreset } from "../../../shared/contracts/externalApps";
import { FileEditor } from "../../components/FileEditor";
import { FileDiffViewer } from "../../components/FileDiffViewer";
import { ImagePreview } from "../../components/ImagePreview";
import { UnsupportedFileView } from "../../components/UnsupportedFileView";
import { TabBar, type TabBarCreateOption } from "../../components/TabBar";
import { getFileTreeIcon } from "../../components/fileTreeIcons";
import { type DesktopAgentKind, SUPPORTED_DESKTOP_AGENT_KINDS } from "../../helpers/agentSettings";
import { useCommands } from "../../hooks/useCommands";
import { type RefreshableOpenTab, useOpenTabAutoRefresh } from "../../hooks/useOpenTabAutoRefresh";
import { agentSettingsStore } from "../../store/agentSettingsStore";
import { tabStore } from "../../store/tabStore";
import { workspaceStore } from "../../store/workspaceStore";
import { DARK_SURFACE_COLORS } from "../../theme";
import { LaunchView } from "./LaunchView";
import { MainPaneTitleBarView } from "./MainPaneTitleBarView";
import { TerminalView } from "./terminal/TerminalView";

const paneHeaderSx = {
  minHeight: 38,
  px: 1.5,
  position: "relative",
  display: "flex",
  alignItems: "center",
  "&::after": {
    content: '""',
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "1px",
    bgcolor: "divider",
    zIndex: 0,
  },
} as const;

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

/** Renders the primary workspace pane with tabbed content, per-tab views, and pane visibility controls. */
export function MainPaneView() {
  const { t } = useTranslation();
  const workspaces = workspaceStore((state) => state.workspaces);
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const tabs = tabStore((state) => state.tabs);
  const selectedTabId = tabStore((state) => state.selectedTabId);
  const {
    setSelectedTabId,
    openTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    toggleTabPinned,
    reorderTab,
    renameTab,
    renameTabsForEntryRename,
    renameEntry,
    readBranchComparisonDiff,
    readCommitDiff,
    readDiff,
    readFile,
    refreshDiffTabContent,
    refreshFileTabFromDisk,
    updateFileTabContent,
    markFileTabSaved,
    writeFile,
    openEntryInExternalApp,
  } = useCommands();
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId);
  const lastUsedExternalAppId = workspaceStore((state) => state.lastUsedExternalAppId);
  const lastUsedExternalAppPreset = lastUsedExternalAppId ? findExternalAppPreset(lastUsedExternalAppId) : null;
  const inUseByAgentKind = agentSettingsStore((state) => state.inUseByAgentKind);
  const workspaceTabs = tabs.filter((tab) => tab.workspaceId === selectedWorkspaceId);
  const terminalTabs = tabs.filter((tab) => tab.kind === "terminal");
  const nonTerminalWorkspaceTabs = workspaceTabs.filter((tab) => tab.kind !== "terminal");
  const orderedWorkspaceTabs = [...workspaceTabs].sort((leftTab, rightTab) => {
    if (leftTab.pinned === rightTab.pinned) {
      return 0;
    }
    return leftTab.pinned ? -1 : 1;
  });
  const tabBarTabs = orderedWorkspaceTabs.map((tab) => ({
    id: tab.id,
    title: tab.title,
    pinned: tab.pinned,
    kind: tab.kind,
    isDirty: tab.kind === "file" ? tab.data.isDirty : false,
    isTemporary: (tab.kind === "file" || tab.kind === "image") ? tab.data.isTemporary : false,
  }));
  const hasWorkspaceTabs = workspaceTabs.length > 0;
  const enabledAgentKinds = useMemo(
    () => SUPPORTED_DESKTOP_AGENT_KINDS.filter((agentKind) => inUseByAgentKind[agentKind]),
    [inUseByAgentKind],
  );
  const enabledAgentKindSet = useMemo(() => new Set(enabledAgentKinds), [enabledAgentKinds]);
  const [focusContentRequestKey, setFocusContentRequestKey] = useState(0);
  const didTrackSelectedTabRef = useRef(false);

  const refreshableTabs = useMemo(
    (): RefreshableOpenTab[] =>
      workspaceTabs.reduce<RefreshableOpenTab[]>((result, tab) => {
        if (tab.kind === "file") {
          result.push({ id: tab.id, kind: "file", path: tab.data.path, isDirty: tab.data.isDirty });
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
      readFile,
      readDiff,
      readCommitDiff,
      readBranchComparisonDiff,
      refreshFileTabFromDisk,
      refreshDiffTabContent,
    },
  });

  const handleSelectTab = (tabId: string) => {
    setSelectedTabId(tabId);
  };

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

  /** Handles tab creation from the tab bar type selector menu. */
  const handleCreateTab = (option: TabBarCreateOption) => {
    if (option === "terminal") {
      openTab({
        workspaceId: selectedWorkspaceId,
        ...buildTerminalInput(t("terminal.title")),
      });
      return;
    }

    if (!enabledAgentKindSet.has(option)) {
      return;
    }

    openTab({
      workspaceId: selectedWorkspaceId,
      ...buildAgentTerminalInput(option),
    });
  };

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
      <Box
        sx={{
          ...paneHeaderSx,
          minWidth: 0,
          ...(hasWorkspaceTabs
            ? {
                bgcolor: (theme: Theme) =>
                  darken(theme.palette.background.default, 0.2),
              }
            : {}),
        }}
      >
        <TabBar
          tabs={tabBarTabs}
          selectedTabId={selectedTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={closeTab}
          onCloseOtherTabs={closeOtherTabs}
          onCloseAllTabs={closeAllTabs}
          onTogglePinTab={toggleTabPinned}
          onReorderTab={reorderTab}
          onCreateTab={handleCreateTab}
          onRenameTab={async (tabId, title) => {
            const tab = workspaceTabs.find((item) => item.id === tabId);
            if (!tab) {
              return;
            }

            if (tab.kind !== "file") {
              renameTab(tabId, title, { userRenamed: true });
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
              await renameEntry({
                workspaceWorktreePath,
                fromRelativePath: tab.data.path,
                toRelativePath: targetPath,
              });
              renameTabsForEntryRename(selectedWorkspaceId, tab.data.path, targetPath);
            } catch (error) {
              console.error("Failed to rename workspace file from tab", error);
            }
          }}
          enabledAgentKinds={enabledAgentKinds}
          getTabIcon={(tab) => {
            const fullTab = workspaceTabs.find((item) => item.id === tab.id);

            if (fullTab?.kind === "terminal") {
              return <LuSquareTerminal size={14} />;
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
          }}
          disabled={!selectedWorkspaceId}
        />
      </Box>
      <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {nonTerminalWorkspaceTabs.map((tab) => {
          const isSelected = tab.id === selectedTabId;
          if (tab.kind === "diff") {
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
                <FileDiffViewer
                  filePath={tab.data.path}
                  oldContent={tab.data.oldContent ?? ""}
                  newContent={tab.data.newContent ?? ""}
                />
              </Box>
            );
          }

          if (tab.kind === "file") {
            if (tab.data.isUnsupported) {
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
                  />
                </Box>
              );
            }

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
                <FileEditor
                  path={tab.data.path}
                  content={tab.data.content ?? ""}
                  isDeleted={Boolean(tab.data.isDeleted)}
                  focusRequestKey={isSelected ? focusContentRequestKey : 0}
                  onContentChange={(nextContent) => {
                    updateFileTabContent(tab.id, nextContent);
                  }}
                  onSave={async (nextContent) => {
                    const workspaceWorktreePath = selectedWorkspace?.worktreePath;
                    if (!workspaceWorktreePath) {
                      return;
                    }

                    try {
                      await writeFile({
                        workspaceWorktreePath,
                        relativePath: tab.data.path,
                        content: nextContent,
                      });

                      updateFileTabContent(tab.id, nextContent);
                      markFileTabSaved(tab.id);
                    } catch (error) {
                      console.error("Failed to save workspace file", error);
                    }
                  }}
                  onCopyPath={async (filePath) => {
                    if (!navigator.clipboard) {
                      return;
                    }

                    try {
                      await navigator.clipboard.writeText(filePath);
                    } catch (error) {
                      console.error("Failed to copy workspace file path", error);
                    }
                  }}
                  onOpenExternalApp={async (filePath) => {
                    const workspaceWorktreePath = selectedWorkspace?.worktreePath;
                    if (!workspaceWorktreePath) {
                      return;
                    }

                    try {
                      await openEntryInExternalApp({
                        workspaceWorktreePath,
                        appId: lastUsedExternalAppId ?? SYSTEM_FILE_MANAGER_APP_ID,
                        relativePath: filePath,
                      });
                    } catch (error) {
                      console.error("Failed to open workspace file externally", error);
                    }
                  }}
                  openExternalAppLabel={
                    lastUsedExternalAppPreset ? `Open in ${lastUsedExternalAppPreset.label}` : "Open in external app"
                  }
                />
              </Box>
            );
          }

          if (tab.kind === "image") {
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
                <ImagePreview
                  path={tab.data.path}
                  dataUrl={tab.data.dataUrl}
                  onCopyPath={async (filePath) => {
                    if (!navigator.clipboard) {
                      return;
                    }

                    try {
                      await navigator.clipboard.writeText(filePath);
                    } catch (error) {
                      console.error("Failed to copy workspace file path", error);
                    }
                  }}
                  onOpenExternalApp={async (filePath) => {
                    const workspaceWorktreePath = selectedWorkspace?.worktreePath;
                    if (!workspaceWorktreePath) {
                      return;
                    }

                    try {
                      await openEntryInExternalApp({
                        workspaceWorktreePath,
                        appId: lastUsedExternalAppId ?? SYSTEM_FILE_MANAGER_APP_ID,
                        relativePath: filePath,
                      });
                    } catch (error) {
                      console.error("Failed to open workspace file externally", error);
                    }
                  }}
                  openExternalAppLabel={
                    lastUsedExternalAppPreset ? `Open in ${lastUsedExternalAppPreset.label}` : "Open in external app"
                  }
                />
              </Box>
            );
          }

          if (tab.kind === "session") {
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
              </Box>
            );
          }

          return null;
        })}
        {terminalTabs.map((tab) => {
          const isSelectedWorkspaceTab = tab.workspaceId === selectedWorkspaceId;
          const isSelected = isSelectedWorkspaceTab && tab.id === selectedTabId;

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
        })}
        {!hasWorkspaceTabs ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
            }}
          >
            <LaunchView />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
