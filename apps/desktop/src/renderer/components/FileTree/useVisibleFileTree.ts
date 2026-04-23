import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { buildTree, collectDirectoryPaths, collectExpandedItems, sortNodes } from "./treeUtils";
import type { EditingEntry, TreeNode } from "./types";

type UseVisibleFileTreeInput = {
  files: string[];
  ignoredPathSet: Set<string>;
  editingEntry: EditingEntry | null;
  expandedItemsOverride?: string[];
  onExpandedItemsChange?: (items: string[]) => void;
};

type UseVisibleFileTreeResult = {
  topLevelNodes: TreeNode[];
  directoryPaths: Set<string>;
  expandedItems: string[];
  setExpandedItems: Dispatch<SetStateAction<string[]>>;
};

/** Computes visible tree nodes and expansion state from files and create-draft state. */
export function useVisibleFileTree({
  files,
  ignoredPathSet,
  editingEntry,
  expandedItemsOverride,
  onExpandedItemsChange,
}: UseVisibleFileTreeInput): UseVisibleFileTreeResult {
  const createDraftPath = useMemo(() => {
    if (!editingEntry || editingEntry.mode !== "create") {
      return null;
    }

    return editingEntry.isDirectory ? `${editingEntry.path}/` : editingEntry.path;
  }, [editingEntry]);

  const editableFiles = useMemo(() => {
    if (!createDraftPath) {
      return files;
    }

    return [...files, createDraftPath];
  }, [createDraftPath, files]);
  const explicitDirectoryPathSet = useMemo(
    () => new Set(editableFiles.filter((path) => path.endsWith("/")).map((path) => path.replace(/\/+$/, ""))),
    [editableFiles],
  );

  const { topLevelNodes, defaultExpandedItems, directoryPaths } = useMemo(() => {
    const root = buildTree(editableFiles);
    const nodes = [...root.children.values()].sort(sortNodes);

    return {
      topLevelNodes: nodes,
      defaultExpandedItems: collectExpandedItems(nodes, ignoredPathSet, explicitDirectoryPathSet),
      directoryPaths: collectDirectoryPaths(nodes),
    };
  }, [editableFiles, explicitDirectoryPathSet, ignoredPathSet]);

  const [uncontrolledExpandedItems, setUncontrolledExpandedItems] = useState<string[]>(defaultExpandedItems);
  const expandedItems = expandedItemsOverride ?? uncontrolledExpandedItems;

  /** Applies one expanded-item update in controlled or uncontrolled mode. */
  const setExpandedItems = useCallback<Dispatch<SetStateAction<string[]>>>(
    (input) => {
      const nextExpandedItems = typeof input === "function" ? input(expandedItems) : input;

      if (expandedItemsOverride) {
        onExpandedItemsChange?.(nextExpandedItems);
        return;
      }

      setUncontrolledExpandedItems(nextExpandedItems);
    },
    [expandedItems, expandedItemsOverride, onExpandedItemsChange],
  );

  useEffect(() => {
    const nextExpandedItems = expandedItems.filter((item) => directoryPaths.has(item));

    if (
      nextExpandedItems.length === expandedItems.length &&
      nextExpandedItems.every((item, index) => item === expandedItems[index])
    ) {
      return;
    }

    const finalExpandedItems =
      nextExpandedItems.length > 0 || defaultExpandedItems.length === 0 ? nextExpandedItems : defaultExpandedItems;

    if (expandedItemsOverride) {
      onExpandedItemsChange?.(finalExpandedItems);
      return;
    }

    setUncontrolledExpandedItems(finalExpandedItems);
  }, [defaultExpandedItems, directoryPaths, expandedItems, expandedItemsOverride, onExpandedItemsChange]);

  return {
    topLevelNodes,
    directoryPaths,
    expandedItems,
    setExpandedItems,
  };
}
