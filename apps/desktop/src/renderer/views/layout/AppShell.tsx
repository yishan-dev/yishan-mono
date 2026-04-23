import { Box } from "@mui/material";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ACTIONS } from "../../../shared/contracts/actions";
import { subscribeAppActionEvent } from "../../events";
import { useCommands } from "../../hooks/useCommands";
import { useShortcuts } from "../../hooks/useShortcuts";
import { parseWorkspaceSessionNavigationPath } from "../../navigation/workspaceNavigation";
import { isEditableActiveElement } from "../../shortcuts/editableTarget";
import { tabStore } from "../../store/tabStore";
import { workspaceStore } from "../../store/workspaceStore";

/** Renders the app frame and route content. */
export function AppShell() {
  const navigate = useNavigate();
  const {
    setSelectedRepoId,
    setSelectedWorkspaceId,
    setSelectedTabId,
    toggleLeftPaneVisibility,
    toggleRightPaneVisibility,
    deleteSelectedFileTreeEntry,
    undoFileTreeOperation,
  } = useCommands();

  useShortcuts();

  useEffect(() => {
    return subscribeAppActionEvent((payload) => {
      if (payload.action === ACTIONS.NAVIGATE) {
        const targetPath = payload.path.trim();
        if (!targetPath) {
          return;
        }
        const { workspaceId, sessionId, tabId } = parseWorkspaceSessionNavigationPath(targetPath);
        if (workspaceId) {
          const storeState = workspaceStore.getState();
          const workspace = storeState.workspaces.find((item) => item.id === workspaceId);
          if (workspace) {
            setSelectedRepoId(workspace.repoId);
          }
          setSelectedWorkspaceId(workspaceId);

          if (tabId) {
            const tab = tabStore.getState().tabs.find((item) => item.workspaceId === workspaceId && item.id === tabId);
            if (tab) {
              setSelectedTabId(tab.id);
            }
          } else if (sessionId) {
            const sessionTab = tabStore
              .getState()
              .tabs.find(
                (tab) => tab.workspaceId === workspaceId && tab.kind === "session" && tab.data.sessionId === sessionId,
              );
            if (sessionTab) {
              setSelectedTabId(sessionTab.id);
            }
          }
        }

        navigate(targetPath);
        return;
      }

      if (payload.action === ACTIONS.TOGGLE_LEFT_PANE) {
        toggleLeftPaneVisibility();
        return;
      }

      if (payload.action === ACTIONS.TOGGLE_RIGHT_PANE) {
        toggleRightPaneVisibility();
        return;
      }

      if (isEditableActiveElement()) {
        return;
      }

      if (payload.action === ACTIONS.FILE_DELETE) {
        deleteSelectedFileTreeEntry();
        return;
      }

      if (payload.action === ACTIONS.FILE_UNDO) {
        undoFileTreeOperation();
      }
    });
  }, [
    deleteSelectedFileTreeEntry,
    navigate,
    setSelectedRepoId,
    setSelectedWorkspaceId,
    setSelectedTabId,
    toggleLeftPaneVisibility,
    toggleRightPaneVisibility,
    undoFileTreeOperation,
  ]);

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
        color: "text.primary",
        boxSizing: "border-box",
      }}
    >
      <Box sx={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
        <Outlet />
      </Box>
    </Box>
  );
}
