import { Box, TextField } from "@mui/material";
import { MdOutlineKeyboardArrowRight } from "react-icons/md";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ClipboardEvent, DragEvent, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isEditableTarget } from "../../shortcuts/editableTarget";
import { handleFileTreeShortcutFromRegistry } from "../fileTreeActionRegistry";
import { getFileTreeIcon } from "../fileTreeIcons";
import { extractSourcePathsFromDataTransferAsync, hasExternalFileDragIntent } from "./dataTransfer";
import {
  collectAncestorDirectoryPaths,
  getEntryName,
  joinChildPath,
  resolveDestinationDirectoryPath,
  resolveUniqueChildName,
} from "./treeUtils";
import type {
  EditingEntry,
  FileTreeContextMenuRequest,
  FileTreeGitChangeKind,
  FileTreeProps,
  VisibleRow,
} from "./types";
import { useVisibleFileTree } from "./useVisibleFileTree";

const ROW_HEIGHT = 28;
const INDENT_SIZE = 2;

const EMPTY_IGNORED_PATHS: string[] = [];
const EMPTY_GIT_CHANGES_BY_PATH: Record<string, FileTreeGitChangeKind> = {};

function getGitChangeIndicatorMeta(kind: FileTreeGitChangeKind): { textColor: string } {
  if (kind === "added") {
    return { textColor: "success.main" };
  }

  if (kind === "renamed") {
    return { textColor: "info.main" };
  }

  return { textColor: "warning.main" };
}

function FlatTreeRow({
  row,
  isSelected,
  isEditing,
  editingName,
  editingInputRef,
  gitChangeKind,
  isIgnored,
  isExpanded,
  onSelect,
  onToggle,
  onOpen,
  onContextMenu,
  onEditingNameChange,
  onRenameKeyDown,
  onRenameBlur,
  onExternalDragOver,
  onExternalDrop,
  hasDescendantGitChange,
}: {
  row: VisibleRow;
  isSelected: boolean;
  isEditing: boolean;
  editingName: string;
  editingInputRef: React.RefObject<HTMLInputElement | null>;
  gitChangeKind: FileTreeGitChangeKind | undefined;
  hasDescendantGitChange: boolean;
  isIgnored: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onOpen: () => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onEditingNameChange: (value: string) => void;
  onRenameKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onRenameBlur: () => void;
  onExternalDragOver: (event: DragEvent<HTMLElement>) => void;
  onExternalDrop: (event: DragEvent<HTMLElement>, targetPath: string, targetIsDirectory: boolean) => void;
}) {
  if (isEditing) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: ROW_HEIGHT,
          pl: row.depth * INDENT_SIZE + 0.5,
          pr: 1,
          borderRadius: 1,
          bgcolor: "action.hover",
        }}
      >
        <Box sx={{ width: 16, flexShrink: 0 }} />
        <Box
          component="img"
          src={getFileTreeIcon(editingName || row.path, row.isDirectory)}
          alt=""
          sx={{ width: 16, height: 16, flexShrink: 0, ml: 0.25 }}
        />
        <TextField
          autoFocus
          inputRef={editingInputRef}
          value={editingName}
          variant="standard"
          size="small"
          autoComplete="off"
          spellCheck={false}
          slotProps={{
            htmlInput: {
              autoCorrect: "off",
              autoCapitalize: "none",
              "data-gramm": "false",
            },
          }}
          onChange={(event) => onEditingNameChange(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            onRenameKeyDown(event);
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onBlur={onRenameBlur}
          sx={{
            minWidth: 100,
            ml: 0.75,
            "& .MuiInputBase-input": {
              py: 0,
              typography: "body2",
            },
          }}
        />
      </Box>
    );
  }

  const icon = getFileTreeIcon(row.path, row.isDirectory, isExpanded);
  const indicatorMeta = gitChangeKind
    ? getGitChangeIndicatorMeta(gitChangeKind)
    : hasDescendantGitChange
      ? { textColor: "warning.main" as const }
      : null;

  return (
    <Box
      data-path={row.path}
      data-testid={`tree-row-${row.path}`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
        if (row.isDirectory) {
          onToggle();
        }
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      onContextMenu={onContextMenu}
      onDragOver={onExternalDragOver}
      onDrop={(event) => onExternalDrop(event, row.path, row.isDirectory)}
      sx={{
        display: "flex",
        alignItems: "center",
        height: ROW_HEIGHT,
        pl: row.depth * INDENT_SIZE + 0.5,
        pr: 1,
        borderRadius: 1,
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        bgcolor: isSelected ? "action.selected" : "transparent",
        "&:hover": {
          bgcolor: isSelected ? "action.selected" : "action.hover",
        },
      }}
    >
      {row.isDirectory ? (
        <Box
          sx={{
            width: 16,
            height: ROW_HEIGHT,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            color: "text.secondary",
            "& svg": { display: "block" },
          }}
        >
          <MdOutlineKeyboardArrowRight size={16} />
        </Box>
      ) : (
        <Box sx={{ width: 16, flexShrink: 0 }} />
      )}
      <Box component="img" src={icon} alt="" sx={{ width: 16, height: 16, flexShrink: 0, ml: 0.25 }} />
      <Box
        component="span"
        data-ignored={isIgnored ? "true" : "false"}
        data-git-change-kind={gitChangeKind ?? "none"}
        sx={{
          ml: 0.75,
          typography: "body2",
          color: isIgnored ? "text.disabled" : indicatorMeta?.textColor ?? "text.primary",
          fontWeight: indicatorMeta ? 500 : 400,
          whiteSpace: "nowrap",
        }}
      >
        {row.name}
      </Box>
    </Box>
  );
}

export function FileTree({
  files,
  gitChangesByPath,
  ignoredPaths = EMPTY_IGNORED_PATHS,
  expandedItems: expandedItemsOverride,
  selectionRequest,
  createEntryRequest,
  onSelectEntry,
  onOpenEntry,
  onExpandedItemsChange,
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
}: FileTreeProps) {  const gitChangesByPathResolved = gitChangesByPath ?? EMPTY_GIT_CHANGES_BY_PATH;
  const ancestorOfGitChangePaths = useMemo(() => {
    const set = new Set<string>();
    for (const path of Object.keys(gitChangesByPathResolved)) {
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i++) {
        set.add(parts.slice(0, i).join("/"));
      }
    }
    return set;
  }, [gitChangesByPathResolved]);
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [editingName, setEditingName] = useState("");
  const [selectedEntryPath, setSelectedEntryPath] = useState("");
  const ignoredPathSet = useMemo(
    () => new Set(ignoredPaths.map((path) => path.replace(/\/+$/, "")).filter(Boolean)),
    [ignoredPaths],
  );

  const { visibleRows, directoryPaths, expandedItems, setExpandedItems } = useVisibleFileTree({
    files,
    ignoredPathSet,
    editingEntry,
    expandedItemsOverride,
    onExpandedItemsChange,
  });

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const ignoreRenameBlurUntilRef = useRef(0);
  const didApplyInitialSelectionRef = useRef(false);
  const lastAppliedSelectionRequestIdRef = useRef<number | null>(null);
  const lastAppliedCreateRequestIdRef = useRef<number | null>(null);
  const expandedPathSet = useMemo(() => new Set(expandedItems), [expandedItems]);
  const rowByPath = useMemo(() => {
    const map = new Map<string, { row: VisibleRow; index: number }>();
    for (let i = 0; i < visibleRows.length; i++) {
      map.set(visibleRows[i]!.path, { row: visibleRows[i]!, index: i });
    }
    return map;
  }, [visibleRows]);

  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

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

    const ancestorDirectoryPaths = collectAncestorDirectoryPaths(requestedPath);
    if (ancestorDirectoryPaths.length > 0) {
      setExpandedItems((currentItems) => [...new Set([...currentItems, ...ancestorDirectoryPaths])]);
    }

    void onEnsurePathLoaded?.(requestedPath);

    if (!rowByPath.has(requestedPath)) {
      return;
    }

    setSelectedEntryPath(requestedPath);
    if (selectionRequest.focus) {
      scrollRef.current?.focus();
    }
    lastAppliedSelectionRequestIdRef.current = selectionRequest.requestId;
  }, [onEnsurePathLoaded, rowByPath, selectionRequest, setExpandedItems]);

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

  const handleTreeKeyDown = async (event: KeyboardEvent<HTMLElement>) => {
    if (editingEntry || isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const current = rowByPath.get(selectedEntryPath);
      if (!current) {
        const firstRow = visibleRows[0];
        if (firstRow) {
          setSelectedEntryPath(firstRow.path);
          onSelectEntry?.({ path: firstRow.path, isDirectory: firstRow.isDirectory });
          virtualizer.scrollToIndex(0, { align: "auto" });
        }
        return;
      }

      const nextRow = visibleRows[current.index + 1];
      if (nextRow) {
        setSelectedEntryPath(nextRow.path);
        onSelectEntry?.({ path: nextRow.path, isDirectory: nextRow.isDirectory });
        virtualizer.scrollToIndex(current.index + 1, { align: "auto" });
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const current = rowByPath.get(selectedEntryPath);
      if (!current || current.index === 0) {
        return;
      }

      const prevRow = visibleRows[current.index - 1];
      if (prevRow) {
        setSelectedEntryPath(prevRow.path);
        onSelectEntry?.({ path: prevRow.path, isDirectory: prevRow.isDirectory });
        virtualizer.scrollToIndex(current.index - 1, { align: "auto" });
      }
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const current = rowByPath.get(selectedEntryPath);
      if (current?.row.isDirectory) {
        if (!expandedPathSet.has(selectedEntryPath)) {
          setExpandedItems((items) => [...new Set([...items, selectedEntryPath])]);
        } else {
          const firstChild = visibleRows[current.index + 1];
          if (firstChild && firstChild.path.startsWith(selectedEntryPath + "/")) {
            setSelectedEntryPath(firstChild.path);
            onSelectEntry?.({ path: firstChild.path, isDirectory: firstChild.isDirectory });
          }
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const current = rowByPath.get(selectedEntryPath);
      if (current?.row.isDirectory && expandedPathSet.has(selectedEntryPath)) {
        setExpandedItems((items) => items.filter((item) => item !== selectedEntryPath));
      } else {
        const pathParts = selectedEntryPath.split("/").filter(Boolean);
        if (pathParts.length > 1) {
          const parentPath = pathParts.slice(0, -1).join("/");
          setSelectedEntryPath(parentPath);
          onSelectEntry?.({ path: parentPath, isDirectory: true });
        }
      }
      return;
    }

    if (event.key === "Enter" && selectedEntryPath) {
      event.preventDefault();
      const current = rowByPath.get(selectedEntryPath);
      if (current?.row.isDirectory) {
        setExpandedItems((items) => {
          const isCurrentlyExpanded = items.includes(selectedEntryPath);
          return isCurrentlyExpanded
            ? items.filter((item) => item !== selectedEntryPath)
            : [...items, selectedEntryPath];
        });
      } else {
        await onOpenEntry?.({ path: selectedEntryPath, isDirectory: false });
      }
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

  const selectFirstTreeEntryOnFocus = () => {
    if (selectedEntryPath) {
      return;
    }

    if (selectionRequest?.path?.trim()) {
      return;
    }

    const firstRow = visibleRows[0];
    if (!firstRow) {
      return;
    }

    setSelectedEntryPath(firstRow.path);
    onSelectEntry?.({ path: firstRow.path, isDirectory: firstRow.isDirectory });
  };

  return (
    <Box
      ref={scrollRef}
      data-testid="repo-file-tree-area"
      sx={{ flex: 1, minHeight: 0, px: 1.5, py: 1, overflowY: "auto", overflowX: "auto" }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!onItemContextMenu) {
          return;
        }

        onItemContextMenu({
          mouseX: event.clientX,
          mouseY: event.clientY,
          basePath: "",
          targetPath: "",
          targetIsDirectory: false,
          startCreateFile: () => startCreate("", false),
          startCreateFolder: () => startCreate("", true),
        });
      }}
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
      <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = visibleRows[virtualItem.index];
          if (!row) {
            return null;
          }

          const isExpanded = expandedPathSet.has(row.path);
          const isSelected = selectedEntryPath === row.path;
          const isIgnored = ignoredPathSet.has(row.path);
          const gitChangeKind = gitChangesByPathResolved[row.path];
          const isEditing = editingEntry?.path === row.path;
          const hasDescendantGitChange = row.isDirectory && ancestorOfGitChangePaths.has(row.path);

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <FlatTreeRow
                row={row}
                isSelected={isSelected}
                isEditing={isEditing}
                editingName={editingName}
                editingInputRef={editingInputRef}
                gitChangeKind={gitChangeKind}
                hasDescendantGitChange={hasDescendantGitChange}
                isIgnored={isIgnored}
                isExpanded={isExpanded}
                onSelect={() => {
                  setSelectedEntryPath(row.path);
                  onSelectEntry?.({ path: row.path, isDirectory: row.isDirectory });
                }}
                onToggle={() => {
                  setExpandedItems((items) => {
                    const isCurrentlyExpanded = items.includes(row.path);
                    return isCurrentlyExpanded ? items.filter((item) => item !== row.path) : [...items, row.path];
                  });
                }}
                onOpen={() => {
                  if (row.isDirectory) {
                    setExpandedItems((items) => [...new Set([...items, row.path])]);
                  } else {
                    onOpenEntry?.({ path: row.path, isDirectory: false });
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!onItemContextMenu) {
                    return;
                  }

                  setSelectedEntryPath(row.path);
                  const basePath = row.isDirectory ? row.path : row.path.split("/").slice(0, -1).join("/");
                  onItemContextMenu({
                    mouseX: event.clientX,
                    mouseY: event.clientY,
                    basePath,
                    targetPath: row.path,
                    targetIsDirectory: row.isDirectory,
                    startCreateFile: () => startCreate(row.isDirectory ? row.path : basePath, false),
                    startCreateFolder: () => startCreate(row.isDirectory ? row.path : basePath, true),
                    startRename: onRenameEntry
                      ? () => startRename(row.path, row.isDirectory ? row.path : basePath)
                      : undefined,
                  });
                }}
                onEditingNameChange={setEditingName}
                onRenameKeyDown={handleRenameInputKeyDown}
                onRenameBlur={handleRenameInputBlur}
                onExternalDragOver={handleExternalDragOver}
                onExternalDrop={(event, targetPath, targetIsDirectory) => {
                  void handleExternalDrop(event, targetPath, targetIsDirectory);
                }}
              />
            </div>
          );
        })}
      </div>
    </Box>
  );
}
