import { generateDiffFile } from "@git-diff-view/file";
import { DiffModeEnum, DiffView } from "@git-diff-view/react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import "@git-diff-view/react/styles/diff-view-pure.css";
import { useMemo } from "react";

type ProjectDiffViewerProps = {
  filePath: string;
  oldContent: string;
  newContent: string;
};

const BINARY_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "ico",
  "svg",
  "webp",
  "tiff",
  "tif",
  "avif",
  "mp3",
  "mp4",
  "wav",
  "ogg",
  "flac",
  "aac",
  "webm",
  "mkv",
  "avi",
  "mov",
  "wmv",
  "flv",
  "pdf",
  "zip",
  "tar",
  "gz",
  "bz2",
  "xz",
  "7z",
  "rar",
  "dmg",
  "iso",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "exe",
  "dll",
  "so",
  "dylib",
  "class",
  "o",
  "obj",
  "pyc",
  "wasm",
]);

function isBinaryPath(filePath: string): boolean {
  const extension = filePath.split(".").pop()?.toLowerCase() ?? "";
  return BINARY_EXTENSIONS.has(extension);
}

function getLanguage(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();

  if (extension === "ts" || extension === "tsx") {
    return "typescript";
  }

  if (extension === "js" || extension === "jsx") {
    return "javascript";
  }

  if (extension === "json") {
    return "json";
  }

  if (extension === "css") {
    return "css";
  }

  if (extension === "html" || extension === "htm") {
    return "html";
  }

  if (extension === "md") {
    return "markdown";
  }

  if (extension === "go") {
    return "go";
  }

  if (extension === "rs") {
    return "rust";
  }

  if (extension === "py") {
    return "python";
  }

  if (extension === "yaml" || extension === "yml") {
    return "yaml";
  }

  if (extension === "sh" || extension === "bash") {
    return "shell";
  }

  return "plaintext";
}

export function ProjectDiffViewer({ filePath, oldContent, newContent }: ProjectDiffViewerProps) {
  const theme = useTheme();

  if (isBinaryPath(filePath)) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Binary file: {filePath}
        </Typography>
      </Box>
    );
  }

  const diffFile = useMemo(() => {
    if (!oldContent.trim() && !newContent.trim()) {
      return null;
    }

    const language = getLanguage(filePath);

    const file = generateDiffFile(filePath, oldContent, filePath, newContent, language, language);

    file.initTheme(theme.palette.mode);
    file.init();
    file.buildSplitDiffLines();

    return file;
  }, [filePath, oldContent, newContent, theme.palette.mode]);

  if (!diffFile) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No diff available for {filePath}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100%",
        minHeight: 0,
        boxSizing: "border-box",
        overflow: "auto",
      }}
    >
      <Typography variant="body2" sx={{ p: 1, color: "text.secondary" }}>
        {filePath}
      </Typography>
      <DiffView
        diffViewFontSize={12}
        diffFile={diffFile}
        diffViewMode={DiffModeEnum.Split}
        diffViewTheme={theme.palette.mode}
        diffViewWrap
      />
    </Box>
  );
}
