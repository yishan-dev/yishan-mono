import { Box, IconButton, Tooltip } from "@mui/material";
import { LuFilePlus2, LuFolderPlus, LuRefreshCw } from "react-icons/lu";

type FileTreeToolbarProps = {
  createFileActionLabel: string;
  createFolderActionLabel: string;
  refreshActionLabel: string;
  canCreateFile: boolean;
  canCreateFolder: boolean;
  canRefresh: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRefresh: () => void;
};

/** Renders the file-tree toolbar actions for create file, create folder, and refresh. */
export function FileTreeToolbar({
  createFileActionLabel,
  createFolderActionLabel,
  refreshActionLabel,
  canCreateFile,
  canCreateFolder,
  canRefresh,
  onCreateFile,
  onCreateFolder,
  onRefresh,
}: FileTreeToolbarProps) {
  return (
    <Box
      data-testid="repo-file-tree-toolbar"
      sx={{
        minHeight: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        px: 0.5,
        pb: 0.5,
        mb: 0.5,
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Tooltip title={createFileActionLabel}>
        <span>
          <IconButton size="small" aria-label={createFileActionLabel} onClick={onCreateFile} disabled={!canCreateFile}>
            <LuFilePlus2 size={14} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={createFolderActionLabel}>
        <span>
          <IconButton
            size="small"
            aria-label={createFolderActionLabel}
            onClick={onCreateFolder}
            disabled={!canCreateFolder}
          >
            <LuFolderPlus size={16} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={refreshActionLabel}>
        <span>
          <IconButton size="small" aria-label={refreshActionLabel} onClick={onRefresh} disabled={!canRefresh}>
            <LuRefreshCw size={14} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
