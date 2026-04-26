import { Box } from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view";
import type { ClipboardEvent, DragEvent, KeyboardEvent, MouseEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isEditableTarget } from "../../shortcuts/editableTarget";
import { handleFileTreeShortcutFromRegistry } from "../fileTreeActionRegistry";
import { TreeNodeItem } from "./TreeNodeItem";
import { extractSourcePathsFromDataTransferAsync, hasExternalFileDragIntent } from "./dataTransfer";
import {
  collectAncestorDirectoryPaths,
  getEntryName,
  joinChildPath,
  resolveDestinationDirectoryPath,
  resolveUniqueChildName,
} from "./treeUtils";
import type { EditingEntry, FileTreeContextMenuRequest, FileTreeProps, TreeNode } from "./types";
import { useVisibleFileTree } from "./useVisibleFileTree";

const EMPTY_IGNORED_PATHS: string[] = [];
const EMPTY_LOADED_DIRECTORY_PATHS: string[] = [];

/** Renders workspace files as one tree and exposes user intents to the owning view. */
export function FileTree({
  files,
  ignoredPaths = EMPTY_IGNORED_PATHS,
  loadedDirectoryPaths = EMPTY_LOADED_DIRECTORY_PATHS,
  expandedItems: expandedItemsOverride,
  selectionRequest,
  createEntryRequest,
  onSelectEntry,
  onOpenEntry,
  onExpandedItemsChange,
  onLoadDirectory,
  onEnsurePathLoaded,
  onCreateEntry,
  onRenameEntry,
  onDeleteEntry,
  onCopyEntry,
  onCutEntry,
  onPasteEntries,
  canPasteEntries,
  onUndoLastEntryOperation,
  canUndoLastEntryOperation,
  onDropExternalEntries,
  onItemContextMenu,
}: FileTreeProps) {
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedEntryPath, setSelectedEntryPath] = useState("");
  const ignoredPathSet = useMemo(
    () => new Set(ignoredPaths.map((path) => path.replace(/\/+$/, "")).filter(Boolean)),
    [ignoredPaths],
  );
  const loadedDirectoryPathSet = useMemo(
    () => new Set(loadedDirectoryPaths.map((path) => path.replace(/\/+$/, ""))),
    [loadedDirectoryPaths],
  );

  const { topLevelNodes, directoryPaths, expandedItems, setExpandedItems } = useVisibleFileTree({
    files,
    ignoredPathSet,
    editingEntry,
    expandedItemsOverride,
    onExpandedItemsChange,
  });

  const treeAreaRef = useRef<HTMLDivElement | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const ignoreRenameBlurUntilRef = useRef(0);
  const didApplyInitialSelectionRef = useRef(false);
  const lastAppliedSelectionRequestIdRef = useRef<number | null>(null);
  const lastAppliedCreateRequestIdRef = useRef<number | null>(null);
  const selectableEntryPaths = useMemo(
    () => new Set(files.map((path) => path.replace(/\/$/, "")).filter(Boolean)),
    [files],
  );
  const expandedPathSet = useMemo(() => new Set(expandedItems), [expandedItems]);

  /** Applies one external selection request and optionally focuses the tree for keyboard actions. */
  useEffect(() => {
    if (!selectionRequest) {
      return;
    }

    if (selectionRequest.requestId === lastAppliedSelectionRequestIdRef.current) {
      return;
    }

    const requestedPath = selectionRequest.path.trim().replace(/\/+$/, "");
    if (!requestedPath) {
      return;
    }

    void onEnsurePathLoaded?.(requestedPath);

    const ancestorDirectoryPaths = collectAncestorDirectoryPaths(requestedPath);
    if (ancestorDirectoryPaths.length > 0) {
      setExpandedItems((currentItems) => [...new Set([...currentItems, ...ancestorDirectoryPaths])]);
    }

    if (!selectableEntryPaths.has(requestedPath)) {
      return;
    }

    setSelectedEntryPath(requestedPath);
    if (selectionRequest.focus) {
      treeAreaRef.current?.focus();
    }
    lastAppliedSelectionRequestIdRef.current = selectionRequest.requestId;
  }, [onEnsurePathLoaded, selectableEntryPaths, selectionRequest, setExpandedItems]);

  /** Applies one create-entry request from the owning view and starts inline create mode. */
  useEffect(() => {
    if (!createEntryRequest) {
      return;
    }

    if (createEntryRequest.requestId === lastAppliedCreateRequestIdRef.current) {
      return;
    }

    startCreate(createEntryRequest.basePath ?? "", createEntryRequest.kind === "folder");
    lastAppliedCreateRequestIdRef.current = createEntryRequest.requestId;
  }, [createEntryRequest]);

  useEffect(() => {
    if (!editingEntry?.path || !editingInputRef.current) {
      didApplyInitialSelectionRef.current = false;
      return;
    }

    if (didApplyInitialSelectionRef.current) {
      return;
    }

    const input = editingInputRef.current;
    const lastDotIndex = editingName.lastIndexOf(".");
    const selectionEnd = lastDotIndex > 0 ? lastDotIndex : editingName.length;
    input.focus();
    input.setSelectionRange(0, selectionEnd);
    didApplyInitialSelectionRef.current = true;
  }, [editingEntry, editingName]);

  const cancelRename = () => {
    setEditingEntry(null);
    setEditingName("");
    didApplyInitialSelectionRef.current = false;
  };

  const commitRename = async () => {
    if (!editingEntry) {
      cancelRename();
      return;
    }

    const nextName = editingName.trim();
    if (!nextName || nextName.includes("/") || nextName.includes("\\")) {
      cancelRename();
      return;
    }

    if (editingEntry.mode === "create") {
      const nextPath = joinChildPath(editingEntry.basePath, nextName);
      try {
        if (!onCreateEntry) {
          return;
        }

        await onCreateEntry({ path: nextPath, isDirectory: editingEntry.isDirectory });
      } finally {
        cancelRename();
      }
      return;
    }

    if (!onRenameEntry) {
      cancelRename();
      return;
    }

    const currentName = getEntryName(editingEntry.path);
    if (nextName === currentName) {
      cancelRename();
      return;
    }

    try {
      await onRenameEntry(editingEntry.path, nextName);
    } finally {
      cancelRename();
    }
  };

  const startCreate = (basePath: string, isDirectory: boolean) => {
    if (!onCreateEntry) {
      return;
    }

    const draftName = resolveUniqueChildName(files, basePath, isDirectory ? "new-folder" : "new-file");
    if (basePath) {
      setExpandedItems((currentItems) => [
        ...new Set([...currentItems, ...collectAncestorDirectoryPaths(basePath), basePath]),
      ]);
    }
    ignoreRenameBlurUntilRef.current = Date.now() + 150;
    didApplyInitialSelectionRef.current = false;
    setEditingEntry({
      mode: "create",
      path: joinChildPath(basePath, draftName),
      basePath,
      isDirectory,
    });
    setEditingName("");
  };

  const startRename = (targetPath: string, basePath: string) => {
    if (!targetPath || !onRenameEntry) {
      return;
    }

    ignoreRenameBlurUntilRef.current = Date.now() + 150;
    didApplyInitialSelectionRef.current = false;
    setEditingEntry({
      mode: "rename",
      path: targetPath,
      basePath,
      isDirectory: false,
    });
    setEditingName(getEntryName(targetPath));
  };

  const openContextMenu = (
    event: MouseEvent<HTMLElement>,
    input: { basePath: string; targetPath: string; targetIsDirectory: boolean },
  ) => {
    if (!onItemContextMenu) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedEntryPath(input.targetPath);

    const request: FileTreeContextMenuRequest = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      basePath: input.basePath,
      targetPath: input.targetPath,
      targetIsDirectory: input.targetIsDirectory,
      startCreateFile: () => {
        startCreate(input.basePath, false);
      },
      startCreateFolder: () => {
        startCreate(input.basePath, true);
      },
      startRename: input.targetPath
        ? () => {
            startRename(input.targetPath, input.basePath);
          }
        : undefined,
    };

    onItemContextMenu(request);
  };

  const handleNodeContextMenu = (
    event: MouseEvent<HTMLElement>,
    input: { basePath: string; targetPath: string; targetIsDirectory: boolean },
  ) => {
    openContextMenu(event, input);
  };

  const handleEmptyAreaContextMenu = (event: MouseEvent<HTMLElement>) => {
    openContextMenu(event, {
      basePath: "",
      targetPath: "",
      targetIsDirectory: false,
    });
  };

  const handleExternalDragOver = (event: DragEvent<HTMLElement>) => {
    if (!onDropExternalEntries || !hasExternalFileDragIntent(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleExternalDrop = async (event: DragEvent<HTMLElement>, targetPath: string, targetIsDirectory: boolean) => {
    if (!onDropExternalEntries) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const sourcePaths = await extractSourcePathsFromDataTransferAsync(event.dataTransfer);
    const destinationPath = resolveDestinationDirectoryPath(targetPath, targetIsDirectory);
    if (sourcePaths.length === 0) {
      return;
    }

    await onDropExternalEntries(sourcePaths, destinationPath);
  };

  const handleExternalPaste = async (event: ClipboardEvent<HTMLElement>) => {
    if (!onDropExternalEntries || editingEntry || isEditableTarget(event.target)) {
      return;
    }

    const clipboardData = event.clipboardData;
    if (!clipboardData) {
      return;
    }

    const sourcePaths = await extractSourcePathsFromDataTransferAsync(clipboardData);
    if (sourcePaths.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    await onDropExternalEntries(
      sourcePaths,
      resolveDestinationDirectoryPath(selectedEntryPath, directoryPaths.has(selectedEntryPath)),
    );
  };

  /** Handles file-tree keyboard shortcuts for copy/cut/paste/delete and local undo. */
  const handleTreeKeyDown = async (event: KeyboardEvent<HTMLElement>) => {
    if (editingEntry || isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "Enter" && selectedEntryPath && !directoryPaths.has(selectedEntryPath)) {
      event.preventDefault();
      await onOpenEntry?.({
        path: selectedEntryPath,
        isDirectory: false,
      });
      return;
    }

    await handleFileTreeShortcutFromRegistry(
      {
        event,
        selectedEntryPath,
        canPasteEntries: Boolean(canPasteEntries),
        canUndoLastEntryOperation: Boolean(canUndoLastEntryOperation),
        onCopyEntry,
        onCutEntry,
        onPasteEntries,
        onDeleteEntry,
        onUndoLastEntryOperation,
        resolveSelectedPasteDestination: () =>
          resolveDestinationDirectoryPath(selectedEntryPath, directoryPaths.has(selectedEntryPath)),
      },
      [],
    );
  };

  const handleRenameInputKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  const handleRenameInputBlur = () => {
    if (Date.now() < ignoreRenameBlurUntilRef.current) {
      return;
    }

    cancelRename();
  };

  /** Returns the first visible file path from current tree expansion state. */
  const findFirstVisibleFilePath = (nodes: readonly TreeNode[]): string | null => {
    for (const node of nodes) {
      if (!node.isDirectory) {
        return node.path;
      }

      if (!expandedItems.includes(node.path)) {
        continue;
      }

      const childNodes = [...node.children.values()];
      const firstChildPath = findFirstVisibleFilePath(childNodes);
      if (firstChildPath) {
        return firstChildPath;
      }
    }

    return null;
  };

  /** Selects the first visible tree entry when focus enters without an existing selection. */
  const selectFirstTreeEntryOnFocus = () => {
    if (selectedEntryPath) {
      return;
    }

    if (selectionRequest?.path?.trim()) {
      return;
    }

    const firstVisibleEntryPath = findFirstVisibleFilePath(topLevelNodes) ?? topLevelNodes[0]?.path;
    if (!firstVisibleEntryPath) {
      return;
    }

    setSelectedEntryPath(firstVisibleEntryPath);
    onSelectEntry?.({
      path: firstVisibleEntryPath,
      isDirectory: directoryPaths.has(firstVisibleEntryPath),
    });
  };

  return (
    <Box
      ref={treeAreaRef}
      data-testid="repo-file-tree-area"
      sx={{ flex: 1, minHeight: 0, px: 1.5, py: 1, overflowY: "auto" }}
      onContextMenu={handleEmptyAreaContextMenu}
      onKeyDown={(event) => {
        void handleTreeKeyDown(event);
      }}
      onDragOver={handleExternalDragOver}
      onDrop={(event) => {
        void handleExternalDrop(event, "", true);
      }}
      onPaste={(event) => {
        void handleExternalPaste(event);
      }}
      onFocus={selectFirstTreeEntryOnFocus}
      tabIndex={0}
    >
      <SimpleTreeView
        expandedItems={expandedItems}
        onExpandedItemsChange={(_, nextExpandedItems) => {
          setExpandedItems(nextExpandedItems);

          const addedExpandedItems = nextExpandedItems.filter((item) => !expandedItems.includes(item));
          for (const directoryPath of addedExpandedItems) {
            if (!directoryPaths.has(directoryPath)) {
              continue;
            }

            void onLoadDirectory?.(directoryPath);
          }
        }}
        selectedItems={selectedEntryPath}
        onSelectedItemsChange={(_, selectedItems) => {
          if (!selectedItems) {
            setSelectedEntryPath("");
            return;
          }

          if (typeof selectedItems === "string") {
            setSelectedEntryPath(selectedItems);
            onSelectEntry?.({
              path: selectedItems,
              isDirectory: directoryPaths.has(selectedItems),
            });
            return;
          }

          const nextSelectedEntryPath = selectedItems[0] ?? "";
          setSelectedEntryPath(nextSelectedEntryPath);
          if (!nextSelectedEntryPath) {
            return;
          }

          onSelectEntry?.({
            path: nextSelectedEntryPath,
            isDirectory: directoryPaths.has(nextSelectedEntryPath),
          });
        }}
        sx={{
          minWidth: 0,
          "& .MuiTreeItem-content": {
            minHeight: 28,
            borderRadius: 1,
          },
          "& .MuiTreeItem-label": {
            typography: "body2",
          },
        }}
      >
        {topLevelNodes.map((node) => (
          <TreeNodeItem
            key={node.path}
            node={node}
            ignoredPathSet={ignoredPathSet}
            loadedDirectoryPathSet={loadedDirectoryPathSet}
            editingPath={editingEntry?.path ?? ""}
            editingName={editingName}
            editingInputRef={editingInputRef}
            onEditingNameChange={setEditingName}
            onRenameKeyDown={handleRenameInputKeyDown}
            onRenameBlur={handleRenameInputBlur}
            onOpenEntry={(path, isDirectory) => {
              onOpenEntry?.({ path, isDirectory });
            }}
            onContextMenu={handleNodeContextMenu}
            onExternalDragOver={handleExternalDragOver}
            onExternalDrop={(event, targetPath, targetIsDirectory) => {
              void handleExternalDrop(event, targetPath, targetIsDirectory);
            }}
            expandedPathSet={expandedPathSet}
          />
        ))}
      </SimpleTreeView>
    </Box>
  );
}
