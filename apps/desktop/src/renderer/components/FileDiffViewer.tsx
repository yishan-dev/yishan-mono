import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useCallback, useEffect, useRef, useState } from "react";
import { LuColumns2, LuFileText, LuDiff, LuRows2 } from "react-icons/lu";
import { getLanguageId } from "../helpers/editorLanguage";
import { ensureEditorThemes, monaco, YISHAN_THEME_DARK, YISHAN_THEME_LIGHT } from "../helpers/monacoSetup";

type FileDiffViewerProps = {
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

export function FileDiffViewer({ filePath, oldContent, newContent }: FileDiffViewerProps) {
  const theme = useTheme();
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const oldContentRef = useRef(oldContent);
  const newContentRef = useRef(newContent);
  const [sideBySide, setSideBySide] = useState(false);
  const [changesOnly, setChangesOnly] = useState(true);

  const monacoTheme = theme.palette.mode === "dark" ? YISHAN_THEME_DARK : YISHAN_THEME_LIGHT;
  const monacoThemeRef = useRef(monacoTheme);
  monacoThemeRef.current = monacoTheme;

  const handleToggleLayout = useCallback(() => {
    setSideBySide((prev) => !prev);
  }, []);

  const handleToggleChangesOnly = useCallback(() => {
    setChangesOnly((prev) => !prev);
  }, []);

  // Keep refs in sync for use during editor creation.
  useEffect(() => {
    oldContentRef.current = oldContent;
  }, [oldContent]);

  useEffect(() => {
    newContentRef.current = newContent;
  }, [newContent]);

  // Create and destroy the diff editor instance.
  useEffect(() => {
    if (!editorHostRef.current) return;

    ensureEditorThemes();

    const language = getLanguageId(filePath) ?? "plaintext";

    const originalModel = monaco.editor.createModel(oldContentRef.current, language);
    const modifiedModel = monaco.editor.createModel(newContentRef.current, language);

    const diffEditor = monaco.editor.createDiffEditor(editorHostRef.current, {
      theme: monacoThemeRef.current,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      lineHeight: 1.5,
      wordWrap: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 12 },
      renderSideBySide: sideBySide,
      useInlineViewWhenSpaceIsLimited: false,
      hideUnchangedRegions: { enabled: changesOnly },
      readOnly: true,
      originalEditable: false,
      enableSplitViewResizing: true,
      renderOverviewRuler: false,
    });

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    diffEditorRef.current = diffEditor;

    return () => {
      diffEditor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
      diffEditorRef.current = null;
    };
  }, [filePath]);

  // Sync external content changes into the diff editor models.
  useEffect(() => {
    const diffEditor = diffEditorRef.current;
    if (!diffEditor) return;

    const model = diffEditor.getModel();
    if (!model) return;

    if (model.original.getValue() !== oldContent) {
      model.original.setValue(oldContent);
    }
    if (model.modified.getValue() !== newContent) {
      model.modified.setValue(newContent);
    }
  }, [oldContent, newContent]);

  // Update theme without recreating the editor.
  useEffect(() => {
    monaco.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // Update side-by-side mode without recreating the editor.
  useEffect(() => {
    diffEditorRef.current?.updateOptions({ renderSideBySide: sideBySide });
  }, [sideBySide]);

  // Update changes-only mode without recreating the editor.
  useEffect(() => {
    diffEditorRef.current?.updateOptions({ hideUnchangedRegions: { enabled: changesOnly } });
  }, [changesOnly]);

  if (isBinaryPath(filePath)) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Binary file: {filePath}
        </Typography>
      </Box>
    );
  }

  if (!oldContent.trim() && !newContent.trim()) {
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
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          minHeight: 34,
          px: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          bgcolor: (muiTheme) =>
            muiTheme.palette.mode === "dark" ? "background.default" : muiTheme.palette.background.paper,
        }}
      >
        <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
          {filePath}
        </Typography>
        <Tooltip title={changesOnly ? "Show entire file" : "Show changes only"}>
          <IconButton size="small" onClick={handleToggleChangesOnly} sx={{ ml: 0.5 }}>
            {changesOnly ? <LuFileText size={14} /> : <LuDiff size={14} />}
          </IconButton>
        </Tooltip>
        <Tooltip title={sideBySide ? "Switch to inline view" : "Switch to side-by-side view"}>
          <IconButton size="small" onClick={handleToggleLayout} sx={{ ml: 0.5 }}>
            {sideBySide ? <LuRows2 size={14} /> : <LuColumns2 size={14} />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box ref={editorHostRef} sx={{ flex: 1, minHeight: 0 }} />
    </Box>
  );
}
