import { Box, List } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuSettings, LuTrash2 } from "react-icons/lu";
import {
  EXTERNAL_APP_MENU_ENTRIES,
  type ExternalAppId,
  JETBRAINS_EXTERNAL_APP_IDS,
  SYSTEM_FILE_MANAGER_APP_ID,
  findExternalAppPreset,
  isExternalAppPlatformSupported,
} from "../../../../shared/contracts/externalApps";
import { OPEN_CREATE_WORKSPACE_DIALOG_EVENT } from "../../../commands/workspaceCommands";
import { ContextMenu, type ContextMenuEntry } from "../../../components/ContextMenu";
import { ProjectRow } from "../../../components/ProjectRow";
import { WorkspaceRow, type WorkspaceRowIndicator } from "../../../components/WorkspaceRow";
import { getRendererPlatform } from "../../../helpers/platform";
import { useCommands } from "../../../hooks/useCommands";
import { useContextMenuState } from "../../../hooks/useContextMenuState";
import { useSuppressNativeContextMenuWhileOpen } from "../../../hooks/useSuppressNativeContextMenuWhileOpen";
import { getShortcutDisplayLabelById } from "../../../shortcuts/shortcutDisplay";
import { type WorkspaceUnreadTone, chatStore } from "../../../store/chatStore";
import { workspaceStore } from "../../../store/workspaceStore";
import { CreateWorkspaceDialogView } from "./CreateWorkspaceDialogView";
import { ProjectConfigDialogView } from "./ProjectConfigDialogView";
import { ProjectDeleteDialogView } from "./ProjectDeleteDialogView";
import { WorkspaceDeleteDialogView } from "./WorkspaceDeleteDialogView";
import { WorkspaceInfoPopperView } from "./WorkspaceInfoPopperView";
import { useProjectDeletionFlow } from "./useProjectDeletionFlow";
import { useProjectListDialogState } from "./useProjectListDialogState";
import { useWorkspaceDeletionFlow } from "./useWorkspaceDeletionFlow";
import { useWorkspaceInfoHover } from "./useWorkspaceInfoHover";

/**
 * Resolves the final workspace indicator from runtime status and unread notification tone.
 *
 * Priority is: running > waiting_input > failed > done > none.
 */
function resolveWorkspaceIndicator(input: {
  runtimeStatus: "running" | "waiting_input" | "idle";
  unreadTone?: WorkspaceUnreadTone;
}): WorkspaceRowIndicator {
  if (input.runtimeStatus === "running") {
    return "running";
  }

  if (input.runtimeStatus === "waiting_input") {
    return "waiting_input";
  }

  if (input.unreadTone === "error") {
    return "failed";
  }

  if (input.unreadTone === "success") {
    return "done";
  }

  return "none";
}

/** Renders project rows and nested workspace rows with per-project fold controls. */
export function ProjectListView() {
  const { t } = useTranslation();
  const projects = workspaceStore((state) => state.projects) ?? [];
  const workspaces = workspaceStore((state) => state.workspaces) ?? [];
  const selectedProjectId = workspaceStore((state) => state.selectedProjectId);
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const displayProjectIds = workspaceStore((state) => state.displayProjectIds) ?? [];
  const gitChangeTotalsByWorkspaceId = workspaceStore((state) => state.gitChangeTotalsByWorkspaceId);
  const lastUsedExternalAppId = workspaceStore((state) => state.lastUsedExternalAppId);
  const {
    setSelectedRepoId,
    setSelectedWorkspaceId,
    closeWorkspace,
    deleteProject,
    openEntryInExternalApp,
    setLastUsedExternalAppId,
  } = useCommands();
  const workspaceAgentStatusByWorkspaceId = chatStore((state) => state.workspaceAgentStatusByWorkspaceId);
  const workspaceUnreadToneByWorkspaceId = chatStore((state) => state.workspaceUnreadToneByWorkspaceId);
  const markWorkspaceNotificationsRead = chatStore((state) => state.markWorkspaceNotificationsRead);
  const {
    menu: projectContextMenu,
    openMenu: openProjectContextMenu,
    closeMenu: closeProjectContextMenu,
    isOpen: isProjectContextMenuOpen,
  } = useContextMenuState<{
    repoId: string;
    mouseX: number;
    mouseY: number;
  }>();
  const {
    menu: workspaceContextMenu,
    openMenu: openWorkspaceContextMenu,
    closeMenu: closeWorkspaceContextMenu,
    isOpen: isWorkspaceContextMenuOpen,
  } = useContextMenuState<{
    repoId: string;
    workspaceId: string;
    mouseX: number;
    mouseY: number;
  }>();
  const {
    isCreateWorkspaceOpen,
    createWorkspaceProjectId,
    renameWorkspaceContext,
    isProjectConfigOpen,
    projectConfigProjectId,
    setIsCreateWorkspaceOpen,
    setCreateWorkspaceProjectId,
    setRenameWorkspaceContext,
    setIsProjectConfigOpen,
    setProjectConfigProjectId,
    handleOpenCreateWorkspace,
    handleOpenProjectConfig,
  } = useProjectListDialogState();
  const {
    pendingWorkspaceDeletion,
    isDeletingWorkspace,
    setPendingWorkspaceDeletion,
    handleRequestWorkspaceDeletion,
    handleCancelWorkspaceDeletion,
    handleConfirmWorkspaceDeletion,
  } = useWorkspaceDeletionFlow({
    workspaces,
    closeWorkspace,
  });
  const {
    pendingProjectDeletion,
    isDeletingProject,
    handleRequestProjectDeletion,
    handleCancelProjectDeletion,
    handleConfirmProjectDeletion,
  } = useProjectDeletionFlow({
    projects,
    deleteProject,
  });
  const [foldedProjectIds, setFoldedProjectIds] = useState<string[]>([]);
  const [isAppFocused, setIsAppFocused] = useState(() => document.hasFocus());
  const rendererPlatform = getRendererPlatform();
  const canOpenWorkspaceInExternalApp = isExternalAppPlatformSupported(rendererPlatform);
  const openWorkspaceInFileManagerActionLabel =
    rendererPlatform === "win32" ? t("workspace.actions.openInExplorer") : t("workspace.actions.openInFinder");
  const createWorkspaceShortcutLabel = getShortcutDisplayLabelById("create-workspace", rendererPlatform);
  const createWorkspaceTooltipLabel = createWorkspaceShortcutLabel
    ? t("layout.toggleWithShortcut", {
        label: t("workspace.actions.add"),
        shortcut: createWorkspaceShortcutLabel,
      })
    : t("workspace.actions.add");
  const lastUsedWorkspaceExternalAppPreset = lastUsedExternalAppId
    ? findExternalAppPreset(lastUsedExternalAppId)
    : null;
  const openWorkspaceInLastUsedExternalAppActionLabel = lastUsedWorkspaceExternalAppPreset
    ? t("workspace.actions.openInExternalAppQuick", { app: lastUsedWorkspaceExternalAppPreset.label })
    : "";

  useEffect(() => {
    const handleWindowFocus = () => {
      setIsAppFocused(true);
    };
    const handleWindowBlur = () => {
      setIsAppFocused(false);
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    const focusedWorkspaceId = selectedWorkspaceId.trim();
    if (!isAppFocused || !focusedWorkspaceId) {
      return;
    }

    if (!(focusedWorkspaceId in workspaceUnreadToneByWorkspaceId)) {
      return;
    }

    markWorkspaceNotificationsRead(focusedWorkspaceId);
  }, [isAppFocused, markWorkspaceNotificationsRead, selectedWorkspaceId, workspaceUnreadToneByWorkspaceId]);
  /** Closes workspace context menu and nested submenu layers together. */
  const closeWorkspaceMenus = () => {
    closeWorkspaceContextMenu();
  };

  /** Closes all left-pane context menus and nested submenus together. */
  const closeAllContextMenus = () => {
    closeProjectContextMenu();
    closeWorkspaceMenus();
  };

  const workspaceByProjectId = workspaces.reduce<Record<string, (typeof workspaces)[number][]>>((acc, workspace) => {
    const existing = acc[workspace.repoId];
    if (existing) {
      existing.push(workspace);
    } else {
      acc[workspace.repoId] = [workspace];
    }
    return acc;
  }, {});
  const filteredProjects = projects.filter((p) => displayProjectIds.includes(p.id));
  const displayWorkspaceIdByProjectId = useMemo(() => {
    const displayWorkspaceIdByProjectIdMap: Record<string, string> = {};

    for (const project of projects) {
      const projectWorkspaces = workspaceByProjectId[project.id] ?? [];
      const preferredProjectPath = project.localPath?.trim() || project.path?.trim() || project.worktreePath?.trim() || "";
      if (!preferredProjectPath) {
        continue;
      }

      const primaryWorkspace = projectWorkspaces.find(
        (workspace) => workspace.kind !== "local" && workspace.worktreePath?.trim() === preferredProjectPath,
      );
      if (primaryWorkspace) {
        displayWorkspaceIdByProjectIdMap[project.id] = primaryWorkspace.id;
      }
    }

    return displayWorkspaceIdByProjectIdMap;
  }, [projects, workspaceByProjectId]);
  const workspaceContextTarget =
    workspaceContextMenu &&
    workspaces.find(
      (workspace) => workspace.repoId === workspaceContextMenu.repoId && workspace.id === workspaceContextMenu.workspaceId,
    );
  const isWorkspaceContextTargetLocal = Boolean(
    workspaceContextTarget &&
      (workspaceContextTarget.kind === "local" ||
        displayWorkspaceIdByProjectId[workspaceContextTarget.repoId] === workspaceContextTarget.id),
  );

  const {
    workspaceInfoAnchorEl,
    hoveredWorkspace,
    hoveredWorkspaceCurrentBranch,
    hoveredWorkspacePullRequest,
    hoveredWorkspaceLatestPullRequest,
    isHoveredWorkspacePrimary,
    isWorkspaceInfoOpen,
    handleWorkspaceInfoMouseEnter,
    handleWorkspaceInfoMouseLeave,
    handleWorkspaceInfoPopoverMouseEnter,
    handleWorkspaceInfoPopoverMouseLeave,
  } = useWorkspaceInfoHover({
    workspaces,
    displayWorkspaceIdByProjectId,
  });

  useEffect(() => {
      const handleOpenCreateWorkspaceDialog = (event: Event) => {
        const customEvent = event as CustomEvent<{ repoId?: string }>;
        const requestedProjectId = customEvent.detail?.repoId?.trim();
        if (!requestedProjectId) {
          return;
        }

        handleOpenCreateWorkspace(requestedProjectId);
      };

    window.addEventListener(OPEN_CREATE_WORKSPACE_DIALOG_EVENT, handleOpenCreateWorkspaceDialog as EventListener);
    return () => {
      window.removeEventListener(OPEN_CREATE_WORKSPACE_DIALOG_EVENT, handleOpenCreateWorkspaceDialog as EventListener);
    };
  }, [handleOpenCreateWorkspace]);


  /** Toggles whether one repository row is folded in the list UI. */
  const toggleProjectFold = (projectId: string) => {
    setFoldedProjectIds((current) =>
      current.includes(projectId) ? current.filter((item) => item !== projectId) : [...current, projectId],
    );
  };

  useSuppressNativeContextMenuWhileOpen(isProjectContextMenuOpen || isWorkspaceContextMenuOpen);

  /** Opens one workspace root path in a selected external app preset. */
  const handleOpenWorkspaceInExternalApp = async (appId: ExternalAppId) => {
    const targetWorkspaceId = workspaceContextMenu?.workspaceId;
    if (!targetWorkspaceId) {
      return;
    }

    const targetWorkspace = workspaces.find((workspace) => workspace.id === targetWorkspaceId);
    const targetWorktreePath = targetWorkspace?.worktreePath?.trim();
    if (!targetWorktreePath) {
      closeWorkspaceMenus();
      return;
    }

    try {
      await openEntryInExternalApp({
        workspaceWorktreePath: targetWorktreePath,
        appId,
      });
      setLastUsedExternalAppId(appId);
    } catch (error) {
      console.error("Failed to open workspace root in external app", error);
    } finally {
      closeWorkspaceMenus();
    }
  };

  /** Opens one workspace root path in the host OS file manager. */
  const handleOpenWorkspaceInFileManager = async () => {
    const targetWorkspaceId = workspaceContextMenu?.workspaceId;
    if (!targetWorkspaceId) {
      return;
    }

    const targetWorkspace = workspaces.find((workspace) => workspace.id === targetWorkspaceId);
    const targetWorktreePath = targetWorkspace?.worktreePath?.trim();
    if (!targetWorktreePath) {
      closeWorkspaceMenus();
      return;
    }

    try {
      await openEntryInExternalApp({
        workspaceWorktreePath: targetWorktreePath,
        appId: SYSTEM_FILE_MANAGER_APP_ID,
      });
    } catch (error) {
      console.error("Failed to open workspace root in file manager", error);
    } finally {
      closeWorkspaceMenus();
    }
  };

  const projectContextMenuItems: ContextMenuEntry[] = [
    {
      id: "repo-config",
      label: t("project.actions.config"),
      icon: <LuSettings size={14} />,
      onSelect: () => {
        if (!projectContextMenu) {
          return;
        }

        handleOpenProjectConfig(projectContextMenu.repoId);
      },
    },
    {
      id: "repo-delete",
      label: t("project.actions.delete"),
      icon: <LuTrash2 size={14} />,
      onSelect: () => {
        if (!projectContextMenu) {
          return;
        }

        handleRequestProjectDeletion(projectContextMenu.repoId);
      },
    },
  ];

  const workspaceExternalAppItems: ContextMenuEntry[] = EXTERNAL_APP_MENU_ENTRIES.reduce<ContextMenuEntry[]>(
    (items, entry) => {
      if (entry.kind === "app") {
        const appPreset = findExternalAppPreset(entry.appId);
        if (!appPreset) {
          return items;
        }

        items.push({
          id: appPreset.id,
          label: appPreset.label,
          icon: <Box component="img" src={appPreset.iconSrc} alt="" sx={{ width: 16, height: 16 }} />,
          onSelect: () => {
            void handleOpenWorkspaceInExternalApp(appPreset.id);
          },
        });
        return items;
      }

      const jetBrainsItems: ContextMenuEntry[] = JETBRAINS_EXTERNAL_APP_IDS.reduce<ContextMenuEntry[]>(
        (childItems, appId) => {
          const appPreset = findExternalAppPreset(appId);
          if (!appPreset) {
            return childItems;
          }

          childItems.push({
            id: appPreset.id,
            label: appPreset.label,
            icon: <Box component="img" src={appPreset.iconSrc} alt="" sx={{ width: 16, height: 16 }} />,
            onSelect: () => {
              void handleOpenWorkspaceInExternalApp(appPreset.id);
            },
          });
          return childItems;
        },
        [],
      );

      items.push({
        id: `group-${entry.id}`,
        label: entry.label,
        icon: <Box component="img" src={entry.iconSrc} alt="" sx={{ width: 16, height: 16 }} />,
        items: jetBrainsItems,
      });
      return items;
    },
    [],
  );

  const workspaceContextMenuItems: ContextMenuEntry[] = [
    {
      id: "workspace-open-in-file-manager",
      label: openWorkspaceInFileManagerActionLabel,
      onSelect: () => {
        void handleOpenWorkspaceInFileManager();
      },
    },
    ...(canOpenWorkspaceInExternalApp && lastUsedWorkspaceExternalAppPreset
      ? [
          {
            id: "workspace-open-last-used-external-app",
            label: openWorkspaceInLastUsedExternalAppActionLabel,
            endAdornment: (
              <Box
                component="img"
                src={lastUsedWorkspaceExternalAppPreset.iconSrc}
                alt=""
                sx={{ width: 16, height: 16, ml: 1 }}
              />
            ),
            onSelect: () => {
              void handleOpenWorkspaceInExternalApp(lastUsedWorkspaceExternalAppPreset.id);
            },
          },
        ]
      : []),
    ...(canOpenWorkspaceInExternalApp
      ? [
          {
            id: "workspace-open-external-app-submenu",
            label: t("workspace.actions.openInExternalApp"),
            items: workspaceExternalAppItems,
          },
        ]
      : []),
    ...(workspaceContextMenu && !isWorkspaceContextTargetLocal
      ? [
          {
            id: "workspace-rename",
            label: t("workspace.actions.rename"),
            onSelect: () => {
              if (!workspaceContextMenu) {
                return;
              }

              const workspace = workspaces.find((item) => item.id === workspaceContextMenu.workspaceId);
              const isWorkspaceDisplayedAsLocal =
                workspace?.kind === "local" ||
                (workspace ? displayWorkspaceIdByProjectId[workspace.repoId] === workspace.id : false);
              if (!workspace || isWorkspaceDisplayedAsLocal) {
                return;
              }

              closeWorkspaceMenus();
              setRenameWorkspaceContext({
                projectId: workspace.repoId,
                workspaceId: workspace.id,
              });
            },
          },
          {
            id: "workspace-delete",
            label: t("workspace.actions.delete"),
            onSelect: () => {
              if (!workspaceContextMenu) {
                return;
              }

              handleRequestWorkspaceDeletion(workspaceContextMenu.repoId, workspaceContextMenu.workspaceId);
            },
          },
        ]
      : []),
  ];
  const projectContextMenuAnchorPosition = useMemo(
    () =>
      projectContextMenu
        ? {
            top: projectContextMenu.mouseY,
            left: projectContextMenu.mouseX,
          }
        : undefined,
    [projectContextMenu],
  );
  const workspaceContextMenuAnchorPosition = useMemo(
    () =>
      workspaceContextMenu
        ? {
            top: workspaceContextMenu.mouseY,
            left: workspaceContextMenu.mouseX,
          }
        : undefined,
    [workspaceContextMenu],
  );

  return (
    <>
      <List data-testid="repo-workspace-list" disablePadding sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {filteredProjects.map((project) => {
          const isProjectFolded = foldedProjectIds.includes(project.id);
          const localDisplayWorkspaceId = displayWorkspaceIdByProjectId[project.id];
          const projectWorkspaces = workspaceByProjectId[project.id] ?? [];
          const displayedWorkspaces = localDisplayWorkspaceId
            ? projectWorkspaces.filter((workspace) => workspace.kind !== "local")
            : projectWorkspaces;

          return (
            <Box key={project.id} sx={{ mb: 0.5 }}>
              <ProjectRow
                repo={project}
                isSelected={selectedProjectId === project.id}
                isFolded={isProjectFolded}
                addWorkspaceAriaLabel={t("workspace.actions.add")}
                addWorkspaceTooltipLabel={createWorkspaceTooltipLabel}
                foldToggleAriaLabel={t(isProjectFolded ? "repo.actions.expand" : "repo.actions.collapse")}
                onSelect={() => {
                  setSelectedRepoId(project.id);
                  setFoldedProjectIds((current) => current.filter((item) => item !== project.id));
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeWorkspaceMenus();
                  setSelectedRepoId(project.id);
                  openProjectContextMenu({
                    repoId: project.id,
                    mouseX: event.clientX,
                    mouseY: event.clientY,
                  });
                }}
                onAddWorkspace={(event) => {
                  event.stopPropagation();
                  handleOpenCreateWorkspace(project.id);
                }}
                onToggleFold={(event) => {
                  event.stopPropagation();
                  toggleProjectFold(project.id);
                }}
              />
              {!isProjectFolded ? (
                <List disablePadding sx={{ mt: 0.25 }}>
                  {displayedWorkspaces.map((workspace) => {
                    const isWorkspaceDisplayedAsLocal =
                      workspace.kind === "local" || localDisplayWorkspaceId === workspace.id;
                    const workspaceForRow = isWorkspaceDisplayedAsLocal
                      ? {
                          ...workspace,
                          kind: "local" as const,
                          name: "local",
                          title: "local",
                        }
                      : workspace;
                    const workspaceRuntimeStatus = workspaceAgentStatusByWorkspaceId[workspace.id] ?? "idle";
                    const workspaceIndicator = resolveWorkspaceIndicator({
                      runtimeStatus: workspaceRuntimeStatus,
                      unreadTone: workspaceUnreadToneByWorkspaceId[workspace.id],
                    });
                    return (
                      <WorkspaceRow
                        key={workspace.id}
                        repoId={project.id}
                        workspace={workspaceForRow}
                        isSelected={selectedWorkspaceId === workspace.id}
                        indicator={workspaceIndicator}
                        changeTotals={gitChangeTotalsByWorkspaceId[workspace.id]}
                        deleteWorkspaceLabel={t("workspace.actions.delete")}
                        runningIndicatorLabel={t("workspace.notifications.runningIndicator")}
                        waitingInputIndicatorLabel={t("workspace.notifications.waitingInputIndicator")}
                        doneIndicatorLabel={t("workspace.notifications.doneIndicator")}
                        failedIndicatorLabel={t("workspace.notifications.failedIndicator")}
                        onSelect={() => {
                          setSelectedRepoId(project.id);
                          setSelectedWorkspaceId(workspace.id);
                          setFoldedProjectIds((current) => current.filter((item) => item !== project.id));
                        }}
                        onMouseEnter={(event) => {
                          handleWorkspaceInfoMouseEnter(workspace.id, event.currentTarget);
                        }}
                        onMouseLeave={handleWorkspaceInfoMouseLeave}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          closeProjectContextMenu();
                          closeWorkspaceMenus();
                          setSelectedRepoId(project.id);
                          setSelectedWorkspaceId(workspace.id);
                          openWorkspaceContextMenu({
                            repoId: project.id,
                            workspaceId: workspace.id,
                            mouseX: event.clientX,
                            mouseY: event.clientY,
                          });
                        }}
                        onRequestDelete={handleRequestWorkspaceDeletion}
                      />
                    );
                  })}
                </List>
              ) : null}
            </Box>
          );
        })}
      </List>
      <ContextMenu
        open={Boolean(projectContextMenu)}
        onClose={closeAllContextMenus}
        anchorPosition={projectContextMenuAnchorPosition}
        items={projectContextMenuItems}
      />
      <ContextMenu
        open={Boolean(workspaceContextMenu)}
        onClose={closeWorkspaceMenus}
        anchorPosition={workspaceContextMenuAnchorPosition}
        items={workspaceContextMenuItems}
      />
      <CreateWorkspaceDialogView
        open={isCreateWorkspaceOpen}
        projectId={createWorkspaceProjectId}
        onClose={() => {
          setIsCreateWorkspaceOpen(false);
          setCreateWorkspaceProjectId("");
        }}
      />
      <CreateWorkspaceDialogView
        mode="rename"
        open={Boolean(renameWorkspaceContext)}
        projectId={renameWorkspaceContext?.projectId ?? ""}
        workspaceId={renameWorkspaceContext?.workspaceId ?? ""}
        onClose={() => {
          setRenameWorkspaceContext(null);
        }}
      />
      <ProjectConfigDialogView
        open={isProjectConfigOpen}
        repoId={projectConfigProjectId}
        onClose={() => {
          setIsProjectConfigOpen(false);
          setProjectConfigProjectId("");
        }}
      />
      <WorkspaceDeleteDialogView
        open={Boolean(pendingWorkspaceDeletion)}
        workspaceName={pendingWorkspaceDeletion?.workspaceName ?? ""}
        allowRemoveBranch={pendingWorkspaceDeletion?.allowRemoveBranch ?? true}
        isDeleting={isDeletingWorkspace}
        onCancel={handleCancelWorkspaceDeletion}
        onConfirm={() => void handleConfirmWorkspaceDeletion()}
        onAllowRemoveBranchChange={(nextValue) => {
          if (!pendingWorkspaceDeletion) {
            return;
          }

          setPendingWorkspaceDeletion({
            ...pendingWorkspaceDeletion,
            allowRemoveBranch: nextValue,
          });
        }}
      />
      <ProjectDeleteDialogView
         open={Boolean(pendingProjectDeletion)}
         repoName={pendingProjectDeletion?.projectName ?? ""}
         isDeleting={isDeletingProject}
         onCancel={handleCancelProjectDeletion}
         onConfirm={() => void handleConfirmProjectDeletion()}
       />
      <WorkspaceInfoPopperView
        open={isWorkspaceInfoOpen}
        anchorEl={workspaceInfoAnchorEl}
        workspace={hoveredWorkspace}
        isPrimaryWorkspace={isHoveredWorkspacePrimary}
        currentBranch={hoveredWorkspaceCurrentBranch}
        pullRequest={hoveredWorkspacePullRequest}
        latestPullRequest={hoveredWorkspaceLatestPullRequest}
        onMouseEnter={handleWorkspaceInfoPopoverMouseEnter}
        onMouseLeave={handleWorkspaceInfoPopoverMouseLeave}
      />
    </>
  );
}
