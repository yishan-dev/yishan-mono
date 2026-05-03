import { Box, TextField } from "@mui/material";
import { TreeItem } from "@mui/x-tree-view";
import type { DragEvent, KeyboardEvent, MouseEvent, RefObject } from "react";
import { getFileTreeIcon } from "../fileTreeIcons";
import { getParentDirectoryPath, sortNodes } from "./treeUtils";
import type { TreeNode } from "./types";

type NodeContextMenuInput = {
  basePath: string;
  targetPath: string;
  targetIsDirectory: boolean;
};

type TreeNodeItemProps = {
  node: TreeNode;
  ignoredPathSet: Set<string>;
  loadedDirectoryPathSet: Set<string>;
  expandableDirectoryPathSet: Set<string>;
  expandedPathSet: Set<string>;
  editingPath: string;
  editingName: string;
  editingInputRef: RefObject<HTMLInputElement | null>;
  onEditingNameChange: (value: string) => void;
  onRenameKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onRenameBlur: () => void;
  onOpenEntry?: (path: string, isDirectory: boolean) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>, input: NodeContextMenuInput) => void;
  onExternalDragOver: (event: DragEvent<HTMLElement>) => void;
  onExternalDrop: (event: DragEvent<HTMLElement>, targetPath: string, targetIsDirectory: boolean) => void;
};

function renderLabel(node: TreeNode, isIgnored: boolean, isExpanded: boolean) {
  const icon = getFileTreeIcon(node.path, node.isDirectory || node.children.size > 0, isExpanded);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, whiteSpace: "nowrap" }}>
      <Box component="img" src={icon} alt="" sx={{ width: 16, height: 16, flexShrink: 0 }} />
      <Box
        component="span"
        data-ignored={isIgnored ? "true" : "false"}
        style={{ userSelect: "none", WebkitUserSelect: "none" }}
        sx={{
          color: isIgnored ? "text.disabled" : "text.primary",
        }}
      >
        {node.name}
      </Box>
    </Box>
  );
}

function EditingLabel({
  iconPath,
  iconIsDirectory,
  editingName,
  editingInputRef,
  onEditingNameChange,
  onRenameKeyDown,
  onRenameBlur,
}: {
  iconPath: string;
  iconIsDirectory: boolean;
  editingName: string;
  editingInputRef: RefObject<HTMLInputElement | null>;
  onEditingNameChange: (value: string) => void;
  onRenameKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onRenameBlur: () => void;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box component="img" src={getFileTreeIcon(iconPath, iconIsDirectory)} alt="" sx={{ width: 16, height: 16 }} />
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
          "& .MuiInputBase-input": {
            py: 0,
            typography: "body2",
          },
        }}
      />
    </Box>
  );
}

/** Renders one file-tree node with rename/edit UI and recursive children. */
export function TreeNodeItem({
  node,
  ignoredPathSet,
  loadedDirectoryPathSet,
  expandableDirectoryPathSet,
  expandedPathSet,
  editingPath,
  editingName,
  editingInputRef,
  onEditingNameChange,
  onRenameKeyDown,
  onRenameBlur,
  onOpenEntry,
  onContextMenu,
  onExternalDragOver,
  onExternalDrop,
}: TreeNodeItemProps) {
  const children = [...node.children.values()].sort(sortNodes);
  const isDirectory = node.isDirectory || children.length > 0;
  const isIgnored = ignoredPathSet.has(node.path);
  const isLoadedDirectory = loadedDirectoryPathSet.has(node.path);
  const isExpandableDirectory = expandableDirectoryPathSet.has(node.path);
  const isExpanded = expandedPathSet.has(node.path);

  if (!isDirectory) {
    const parentPath = getParentDirectoryPath(node.path);

    return (
      <TreeItem
        itemId={node.path}
        label={
          editingPath === node.path ? (
            <EditingLabel
              iconPath={editingName || node.path}
              iconIsDirectory={false}
              editingName={editingName}
              editingInputRef={editingInputRef}
              onEditingNameChange={onEditingNameChange}
              onRenameKeyDown={onRenameKeyDown}
              onRenameBlur={onRenameBlur}
            />
          ) : (
            <Box onDragOver={onExternalDragOver} onDrop={(event) => onExternalDrop(event, node.path, false)}>
              {renderLabel(node, isIgnored, false)}
            </Box>
          )
        }
        onContextMenu={(event) =>
          onContextMenu(event, { basePath: parentPath, targetPath: node.path, targetIsDirectory: false })
        }
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpenEntry?.(node.path, false);
        }}
      />
    );
  }

  return (
    <TreeItem
      itemId={node.path}
      slotProps={{
        groupTransition: {
          timeout: 0,
        },
      }}
      label={
        editingPath === node.path ? (
          <EditingLabel
            iconPath={node.path}
            iconIsDirectory
            editingName={editingName}
            editingInputRef={editingInputRef}
            onEditingNameChange={onEditingNameChange}
            onRenameKeyDown={onRenameKeyDown}
            onRenameBlur={onRenameBlur}
          />
        ) : (
          <Box onDragOver={onExternalDragOver} onDrop={(event) => onExternalDrop(event, node.path, true)}>
            {renderLabel(node, isIgnored, isExpanded)}
          </Box>
        )
      }
      onContextMenu={(event) =>
        onContextMenu(event, { basePath: node.path, targetPath: node.path, targetIsDirectory: true })
      }
    >
      {(!isLoadedDirectory || isExpandableDirectory) && children.length === 0 ? (
        <TreeItem itemId={`${node.path}::__placeholder`} label="" sx={{ display: "none" }} />
      ) : null}
      {children.map((child) => (
        <TreeNodeItem
          key={child.path}
          node={child}
          ignoredPathSet={ignoredPathSet}
          loadedDirectoryPathSet={loadedDirectoryPathSet}
          expandableDirectoryPathSet={expandableDirectoryPathSet}
          expandedPathSet={expandedPathSet}
          editingPath={editingPath}
          editingName={editingName}
          editingInputRef={editingInputRef}
          onEditingNameChange={onEditingNameChange}
          onRenameKeyDown={onRenameKeyDown}
          onRenameBlur={onRenameBlur}
          onOpenEntry={onOpenEntry}
          onContextMenu={onContextMenu}
          onExternalDragOver={onExternalDragOver}
          onExternalDrop={onExternalDrop}
        />
      ))}
    </TreeItem>
  );
}
