import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { useMemo } from "react";
import { PiCubeThin } from "react-icons/pi";
import { LuCopy, LuExternalLink } from "react-icons/lu";
import { getFileTreeIcon } from "./fileTreeIcons";

type UnsupportedFileViewProps = {
  path: string;
  title: string;
  description: string;
  hint?: string;
  onCopyPath?: (path: string) => void | Promise<void>;
  onOpenExternalApp?: (path: string) => void | Promise<void>;
  openExternalAppLabel?: string;
};

/** Renders one centered empty-state for unsupported editor file types. */
export function UnsupportedFileView({
  path,
  title,
  description,
  hint,
  onCopyPath,
  onOpenExternalApp,
  openExternalAppLabel = "Open in external app",
}: UnsupportedFileViewProps) {
  const fileIcon = useMemo(() => getFileTreeIcon(path, false), [path]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          minHeight: 34,
          bgcolor: (muiTheme) =>
            muiTheme.palette.mode === "dark" ? "background.default" : muiTheme.palette.background.paper,
        }}
      >
        <Box component="img" src={fileIcon} alt="" sx={{ width: 14, height: 14, mr: 0.75, flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0, flex: 1 }}>
          {path}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, ml: 0.75, flexShrink: 0 }}>
          <Tooltip title="Copy file path" arrow>
            <span>
              <IconButton
                size="small"
                aria-label="Copy file path"
                onClick={() => {
                  void onCopyPath?.(path);
                }}
                disabled={!onCopyPath}
                sx={{ p: 0.375, color: "text.secondary" }}
              >
                <LuCopy size={14} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={openExternalAppLabel} arrow>
            <span>
              <IconButton
                size="small"
                aria-label={openExternalAppLabel}
                onClick={() => {
                  void onOpenExternalApp?.(path);
                }}
                disabled={!onOpenExternalApp}
                sx={{ p: 0.375, color: "text.secondary" }}
              >
                <LuExternalLink size={14} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          px: 3,
          textAlign: "center",
        }}
      >
        <PiCubeThin size={88} color="currentColor" style={{ opacity: 0.32 }} />
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {hint ? (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
