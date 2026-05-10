import { Alert, Box, LinearProgress, Typography } from "@mui/material";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  findExternalAppPreset,
  isExternalAppPlatformSupported,
} from "../../../../shared/contracts/externalApps";
import { ContextMenu } from "../../../components/ContextMenu";
import { FileQuickOpenDialog } from "../../../components/FileQuickOpenDialog";
import { FileTree } from "../../../components/FileTree";
import { FileTreeToolbar } from "../../../components/FileTree/FileTreeToolbar";
import type { FileTreeContextMenuRequest } from "../../../components/FileTree/types";
import { getRendererPlatform } from "../../../helpers/platform";
import { useCommands } from "../../../hooks/useCommands";
import { useContextMenuState } from "../../../hooks/useContextMenuState";
import { useSuppressNativeContextMenuWhileOpen } from "../../../hooks/useSuppressNativeContextMenuWhileOpen";
import { tabStore } from "../../../store/tabStore";
import { workspaceFileTreeStore } from "../../../store/workspaceFileTreeStore";
import { workspaceStore } from "../../../store/workspaceStore";
import { useFileSearchController } from "./useFileSearchController";
import { useFileTreeContextMenuItems } from "./useFileTreeContextMenuItems";
import { useFileTreeCreateEntryRequest } from "./useFileTreeCreateEntryRequest";
import { useFileTreeGitChanges } from "./useFileTreeGitChanges";
import { CONTEXT_DIRECTORY_PATHS, useFileTreeOperations } from "./useFileTreeOperations";

type FileManagerViewProps = {
  openFileSearchRequestKey?: number;
  lastHandledFileSearchRequestKey?: number;
  onFileSearchRequestHandled?: (requestKey: number) => void;
};

/** Computes one bounded progress percentage value for file operations. */
function getFileOperationProgressValue(operation: {
  processed: number;
  total: number;
}): number {
  if (operation.total <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((operation.processed / operation.total) * 100));
}

/** Renders file tree + quick-open and delegates file operations to useFileTreeOperations. */
export function FileManagerView({
  openFileSearchRequestKey = 0,
  lastHandledFileSearchRequestKey = 0,
  onFileSearchRequestHandled,
}: FileManagerViewProps) {
  const { t } = useTranslation();
  const {
    repoFiles,
    ignoredRepoPaths,
    loadedDirectoryPaths,
    searchRepoFiles,
    searchIgnoredRepoPaths,
    fileOperationState,
    fileOperationError,
    fileTreeSelectionRequest,
    canPasteEntries,
    canUndoLastEntryOperation,
    revealFileInTree,
    loadExpandedDirectory,
    ensurePathLoaded,
    loadAllRepoFiles,
    openWorkspaceFile,
    onCreateFile,
    onCreateFolder,
    onRenameEntry,
    onDeleteEntry,
    onCopyPath,
    onCopyRelativePath,
    onOpenInFileManager,
    onOpenInExternalApp,
    onCopyEntry,
    onCutEntry,
    onPasteEntries,
    onDropExternalEntries,
    onRefresh,
    onUndoLastEntryOperation,
  } = useFileTreeOperations();
  const rendererPlatform = getRendererPlatform();
  const cmd = useCommands();
  const canOpenInExternalApp = isExternalAppPlatformSupported(rendererPlatform);
  const lastUsedExternalAppId = workspaceStore((state) => state.lastUsedExternalAppId);
  const selectedWorkspaceId = workspaceStore((state) => state.selectedWorkspaceId);
  const selectedWorkspaceWorktreePath = workspaceStore(
    (state) => state.workspaces.find((workspace) => workspace.id === state.selectedWorkspaceId)?.worktreePath?.trim() ?? "",
  );
  const workspaceGitRefreshVersion = workspaceStore((state) => {
    if (!selectedWorkspaceWorktreePath) {
      return 0;
    }

    return state.gitRefreshVersionByWorktreePath?.[selectedWorkspaceWorktreePath] ?? 0;
  });
  const lastUsedWorkspaceExternalAppPreset = lastUsedExternalAppId
    ? findExternalAppPreset(lastUsedExternalAppId)
    : null;

  const { createEntryRequest, requestCreateFile, requestCreateFolder } = useFileTreeCreateEntryRequest();
  const {
    menu: contextMenu,
    openMenu: openContextMenu,
    closeMenu: closeContextMenu,
    isOpen: hasOpenContextMenu,
  } = useContextMenuState<FileTreeContextMenuRequest>();
  const selectedEntryPath = workspaceFileTreeStore((state) => state.selectedEntryPath);
  const deleteSelectionRequestId = workspaceFileTreeStore((state) => state.deleteSelectionRequestId);
  const undoRequestId = workspaceFileTreeStore((state) => state.undoRequestId);
  const setSelectedEntryPath = workspaceFileTreeStore((state) => state.setSelectedEntryPath);
  const [lastHandledDeleteSelectionRequestId, setLastHandledDeleteSelectionRequestId] = useState(0);
  const [lastHandledUndoRequestId, setLastHandledUndoRequestId] = useState(0);
  const [expandedItemsByWorkspaceId, setExpandedItemsByWorkspaceId] = useState<Record<string, string[]>>({});
  const selectedTabId = tabStore((state) => state.selectedTabId);
  const tabs = tabStore((state) => state.tabs);
  const lastRevealedTabIdRef = useRef("");

  const expandedItems = selectedWorkspaceId ? (expandedItemsByWorkspaceId[selectedWorkspaceId] ?? []) : [];

  /** Stores the current workspace's expanded directory list so it can be restored on switch-back. */
  const handleExpandedItemsChange = useCallback(
    (items: string[]) => {
      if (!selectedWorkspaceId) {
        return;
      }

      setExpandedItemsByWorkspaceId((currentState) => ({
        ...currentState,
        [selectedWorkspaceId]: items,
      }));
    },
    [selectedWorkspaceId],
  );

  useEffect(() => {
    return () => {
      setSelectedEntryPath("");
    };
  }, [setSelectedEntryPath]);

  useSuppressNativeContextMenuWhileOpen(hasOpenContextMenu);

  const visibleTreeFiles = repoFiles;
  const ignoredSearchRepoPathSet = useMemo(
    () => new Set(searchIgnoredRepoPaths.map((path) => path.replace(/\/+$/, ""))),
    [searchIgnoredRepoPaths],
  );
  const searchableFiles = useMemo(
    () => searchRepoFiles.filter((path) => !ignoredSearchRepoPathSet.has(path.replace(/\/+$/, ""))),
    [ignoredSearchRepoPathSet, searchRepoFiles],
  );
  const gitChangesByPath = useFileTreeGitChanges({
    listGitChanges: cmd.listGitChanges,
    selectedWorkspaceWorktreePath,
    workspaceGitRefreshVersion,
  });

  useEffect(() => {
    if (!fileTreeSelectionRequest?.path) {
      return;
    }

    setSelectedEntryPath(fileTreeSelectionRequest.path);
  }, [fileTreeSelectionRequest, setSelectedEntryPath]);

  useEffect(() => {
    const selectedTab = tabs.find((tab) => tab.id === selectedTabId && tab.workspaceId === selectedWorkspaceId);
    if (!selectedTab || selectedTab.kind !== "file") {
      lastRevealedTabIdRef.current = "";
      return;
    }

    if (lastRevealedTabIdRef.current === selectedTab.id) {
      return;
    }

    lastRevealedTabIdRef.current = selectedTab.id;
    revealFileInTree(selectedTab.data.path);
  }, [revealFileInTree, selectedTabId, selectedWorkspaceId, tabs]);

  useEffect(() => {
    if (deleteSelectionRequestId <= lastHandledDeleteSelectionRequestId) {
      return;
    }

    setLastHandledDeleteSelectionRequestId(deleteSelectionRequestId);
    if (!selectedEntryPath) {
      return;
    }

    void onDeleteEntry(selectedEntryPath);
  }, [deleteSelectionRequestId, lastHandledDeleteSelectionRequestId, onDeleteEntry, selectedEntryPath]);

  useEffect(() => {
    if (undoRequestId <= lastHandledUndoRequestId) {
      return;
    }

    setLastHandledUndoRequestId(undoRequestId);
    if (!canUndoLastEntryOperation) {
      return;
    }

    void onUndoLastEntryOperation();
  }, [canUndoLastEntryOperation, lastHandledUndoRequestId, onUndoLastEntryOperation, undoRequestId]);

  const openSearchResult = useCallback(
    async (path: string) => {
      if (path.endsWith("/")) {
        const directoryPath = path.replace(/\/+$/, "");
        await loadExpandedDirectory(directoryPath);
        if (!expandedItems.includes(directoryPath)) {
          handleExpandedItemsChange([...expandedItems, directoryPath]);
        }
        setSelectedEntryPath(directoryPath);
        setIsFileSearchOpen(false);
        return;
      }

      await openWorkspaceFile(path);
      setIsFileSearchOpen(false);
    },
    [expandedItems, handleExpandedItemsChange, loadExpandedDirectory, openWorkspaceFile, setSelectedEntryPath],
  );
  const {
    isFileSearchOpen,
    setIsFileSearchOpen,
    fileSearchQuery,
    setFileSearchQuery,
    selectedSearchResultIndex,
    setSelectedSearchResultIndex,
    fileSearchResults,
    handleFileSearchInputKeyDown,
  } = useFileSearchController({
    searchableFiles,
    loadAllRepoFiles,
    openFileSearchRequestKey,
    lastHandledFileSearchRequestKey,
    onFileSearchRequestHandled,
    openSearchResult,
  });

  const fileOperationModeLabel = fileOperationState ? t(`files.operations.modes.${fileOperationState.mode}`) : "";

  const { items: contextMenuItems, anchorPosition: contextMenuAnchorPosition } = useFileTreeContextMenuItems({
    t,
    rendererPlatform,
    contextMenu,
    closeContextMenu,
    canOpenInExternalApp,
    lastUsedWorkspaceExternalAppPreset,
    canPasteEntries,
    handlers: {
      onCreateFile,
      onCreateFolder,
      onRenameEntry,
      onDeleteEntry,
      onCopyPath,
      onCopyRelativePath,
      onOpenInFileManager,
      onOpenInExternalApp,
      onCopyEntry,
      onCutEntry,
      onPasteEntries,
    },
  });

  const fileOperationProgressText = fileOperationState
    ? fileOperationState.currentPath
      ? t("files.operations.progressWithPath", {
          mode: fileOperationModeLabel,
          processed: fileOperationState.processed,
          total: fileOperationState.total,
          path: fileOperationState.currentPath,
        })
      : t("files.operations.progress", {
          mode: fileOperationModeLabel,
          processed: fileOperationState.processed,
          total: fileOperationState.total,
        })
    : "";

  return (
    <Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      {fileOperationState?.status === "running" ? (
        <Box sx={{ px: 1.5, pt: 1, pb: 0.25, display: "flex", flexDirection: "column", gap: 0.5, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" data-testid="file-operation-progress-label">
            {fileOperationProgressText}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={getFileOperationProgressValue(fileOperationState)}
            data-testid="file-operation-progress-bar"
          />
        </Box>
      ) : null}
      {fileOperationError ? (
        <Box sx={{ px: 1.5, pt: 1, flexShrink: 0 }}>
          <Alert severity="error" data-testid="file-operation-error">
            {fileOperationError}
          </Alert>
        </Box>
      ) : null}
      <FileTreeToolbar
        createFileActionLabel={t("files.actions.createFile")}
        createFolderActionLabel={t("files.actions.createFolder")}
        refreshActionLabel={t("files.actions.refresh")}
        canCreateFile={Boolean(onCreateFile)}
        canCreateFolder={Boolean(onCreateFolder)}
        canRefresh={Boolean(onRefresh)}
        onCreateFile={() => {
          requestCreateFile();
        }}
        onCreateFolder={() => {
          requestCreateFolder();
        }}
        onRefresh={() => {
          void onRefresh?.();
        }}
      />
      <FileTree
        files={visibleTreeFiles}
        gitChangesByPath={gitChangesByPath}
        ignoredPaths={ignoredRepoPaths}
        loadedDirectoryPaths={loadedDirectoryPaths}
        expandableDirectoryPaths={CONTEXT_DIRECTORY_PATHS}
        expandedItems={expandedItems}
        selectionRequest={fileTreeSelectionRequest}
        createEntryRequest={createEntryRequest}
        onExpandedItemsChange={handleExpandedItemsChange}
        onLoadDirectory={loadExpandedDirectory}
        onEnsurePathLoaded={ensurePathLoaded}
        onSelectEntry={({ path, isDirectory }) => {
          setSelectedEntryPath(path);
          if (isDirectory) {
            return;
          }

          void openWorkspaceFile(path, { temporary: true });
        }}
        onOpenEntry={({ path, isDirectory }) => {
          if (isDirectory) {
            return;
          }

          void openWorkspaceFile(path);
        }}
        onCreateEntry={async ({ path, isDirectory }) => {
          if (isDirectory) {
            await onCreateFolder(path);
            return;
          }

          await onCreateFile(path);
        }}
        onRenameEntry={onRenameEntry}
        onDeleteEntry={onDeleteEntry}
        onCopyEntry={onCopyEntry}
        onCutEntry={onCutEntry}
        canPasteEntries={canPasteEntries}
        onPasteEntries={onPasteEntries}
        onDropExternalEntries={onDropExternalEntries}
        canUndoLastEntryOperation={canUndoLastEntryOperation}
        onUndoLastEntryOperation={onUndoLastEntryOperation}
        onItemContextMenu={(request) => {
          openContextMenu(request);
        }}
        />
      <ContextMenu
        open={Boolean(contextMenu)}
        onClose={closeContextMenu}
        anchorPosition={contextMenuAnchorPosition}
        marginThreshold={0}
        submenuDirection="left"
        items={contextMenuItems}
      />
      <FileQuickOpenDialog
        open={isFileSearchOpen}
        query={fileSearchQuery}
        selectedResultIndex={selectedSearchResultIndex}
        results={fileSearchResults}
        placeholder={t("files.search.placeholder")}
        emptyText={t("files.search.empty")}
        onClose={() => {
          setIsFileSearchOpen(false);
        }}
        onQueryChange={(nextQuery) => {
          setFileSearchQuery(nextQuery);
          setSelectedSearchResultIndex(0);
        }}
        onInputKeyDown={handleFileSearchInputKeyDown}
        onSelectResultIndex={setSelectedSearchResultIndex}
        onOpenResult={(path, index) => {
          setSelectedSearchResultIndex(index);
          void openSearchResult(path);
        }}
      />
    </Box>
  );
}
