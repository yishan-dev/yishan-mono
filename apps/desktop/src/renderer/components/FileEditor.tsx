import { Box, Typography, useTheme } from "@mui/material";
import { useEffect, useMemo, useRef } from "react";
import { getLanguageId } from "../helpers/editorLanguage";
import { ensureEditorThemes, monaco, YISHAN_THEME_DARK, YISHAN_THEME_LIGHT } from "../helpers/monacoSetup";

type FileEditorProps = {
  path: string;
  content: string;
  focusRequestKey?: number;
  onContentChange?: (content: string) => void;
  onSave?: (content: string) => void | Promise<void>;
};

/** Renders a Monaco file editor with local edit tracking and Cmd/Ctrl+S save shortcut. */
export function FileEditor({ path, content, focusRequestKey = 0, onContentChange, onSave }: FileEditorProps) {
  const theme = useTheme();
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const contentRef = useRef(content);
  const onContentChangeRef = useRef(onContentChange);
  const onSaveRef = useRef(onSave);

  const monacoTheme = useMemo(
    () => (theme.palette.mode === "dark" ? YISHAN_THEME_DARK : YISHAN_THEME_LIGHT),
    [theme.palette.mode],
  );

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Create and destroy the editor instance.
  useEffect(() => {
    if (!editorHostRef.current) return;

    ensureEditorThemes();

    const language = getLanguageId(path) ?? undefined;

    // Create a model with a file:// URI matching the real file path so that
    // Monaco's language services (e.g. TypeScript) can resolve relative imports
    // and understand the project structure even when the file lives outside the app.
    const fileUri = monaco.Uri.file(path);
    const existingModel = monaco.editor.getModel(fileUri);
    const model =
      existingModel ?? monaco.editor.createModel(contentRef.current, language, fileUri);

    if (existingModel) {
      // Reuse existing model but update language if needed.
      monaco.editor.setModelLanguage(model, language ?? "plaintext");
      model.setValue(contentRef.current);
    }

    const editor = monaco.editor.create(editorHostRef.current, {
      model,
      theme: monacoTheme,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, monospace',
      lineHeight: 1.5,
      wordWrap: "on",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      padding: { top: 12 },
      renderLineHighlight: "line",
      tabSize: 2,
      insertSpaces: true,
    });

    // Register Cmd/Ctrl+S save shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void onSaveRef.current?.(editor.getValue());
    });

    // Listen for content changes
    editor.onDidChangeModelContent(() => {
      onContentChangeRef.current?.(editor.getValue());
    });

    editorRef.current = editor;

    return () => {
      editor.dispose();
      model.dispose();
      editorRef.current = null;
    };
  }, [monacoTheme, path]);

  // Sync external content changes into the editor.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const currentValue = editor.getValue();
    if (currentValue === content) return;

    editor.setValue(content);
  }, [content]);

  // Update theme without recreating the editor.
  useEffect(() => {
    monaco.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // Focus the editor when requested.
  useEffect(() => {
    if (focusRequestKey <= 0) return;

    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusRequestKey]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
        <Typography variant="caption" color="text.secondary" noWrap>
          {path}
        </Typography>
      </Box>
      <Box ref={editorHostRef} sx={{ flex: 1, minHeight: 0 }} />
    </Box>
  );
}
