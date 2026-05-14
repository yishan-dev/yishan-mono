import { Box, Typography, darken } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuGlobe, LuSquareTerminal } from "react-icons/lu";
import { SYSTEM_FILE_MANAGER_APP_ID, findExternalAppPreset } from "../../../shared/contracts/externalApps";
import { copyToClipboard } from "../../helpers/clipboard";
import { FileEditor } from "../../components/FileEditor";
import { FileDiffViewer } from "../../components/FileDiffViewer";
import { ImagePreview } from "../../components/ImagePreview";
import { TabPanel } from "../../components/TabPanel";
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

function buildBrowserInput() {
  return {
    kind: "browser" as const,
    url: "",
  };
}

/** Renders the primary workspace pane with tabbed content, per-tab views, and pane visibility controls. */
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
  const terminalTabs = tabs.filter((tab) => tab.kind === "terminal");
  const browserTabs = tabs.filter((tab) => tab.kind === "browser");
  const nonTerminalWorkspaceTabs = workspaceTabs.filter((tab) => tab.kind !== "terminal" && tab.kind !== "browser");
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
    isTemporary: ["file", "image", "diff"].includes(tab.kind) ? (tab.data as { isTemporary: boolean }).isTemporary : false,
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

  const handleSelectTab = (tabId: string) => {
    cmd.setSelectedTabId(tabId);
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
          onCloseTab={cmd.closeTab}
          onCloseOtherTabs={cmd.closeOtherTabs}
          onCloseAllTabs={cmd.closeAllTabs}
          onTogglePinTab={cmd.toggleTabPinned}
          onReorderTab={cmd.reorderTab}
          onCreateTab={handleCreateTab}
          onRenameTab={async (tabId, title) => {
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
          }}
          enabledAgentKinds={enabledAgentKinds}
          getTabIcon={(tab) => {
            const fullTab = workspaceTabs.find((item) => item.id === tab.id);

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
          }}
          disabled={!selectedWorkspaceId}
        />
      </Box>
      <Box sx={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {nonTerminalWorkspaceTabs.map((tab) => {
          const isSelected = tab.id === selectedTabId;
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

          return null;
        })}
        {browserTabs.map((tab) => {
          const isSelectedWorkspaceTab = tab.workspaceId === selectedWorkspaceId;
          const isSelected = isSelectedWorkspaceTab && tab.id === selectedTabId;

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
          <TabPanel active>
            <LaunchView />
          </TabPanel>
        ) : null}
      </Box>
    </Box>
  );
}
