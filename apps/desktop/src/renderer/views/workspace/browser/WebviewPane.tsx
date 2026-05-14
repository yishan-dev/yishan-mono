import { Alert, Box, Button, Snackbar, Typography } from "@mui/material";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { LuRefreshCcw, LuTriangle } from "react-icons/lu";

type WebviewPaneProps = {
  resolvedUrl: string;
  errorMessage: string;
  snackbarMessage: string;
  onSetErrorMessage: (msg: string) => void;
  onSetSnackbarMessage: (msg: string) => void;
  setWebviewRef: (element: Electron.WebviewTag | null) => void;
  blankContent: ReactNode;
};

export function WebviewPane({
  resolvedUrl,
  errorMessage,
  snackbarMessage,
  onSetErrorMessage,
  onSetSnackbarMessage,
  setWebviewRef,
  blankContent,
}: WebviewPaneProps) {
  const webviewElRef = useRef<Electron.WebviewTag | null>(null);
  const [hasError, setHasError] = useState(false);

  const handleReload = useCallback(() => {
    onSetErrorMessage("");
    setHasError(false);
    webviewElRef.current?.reload();
  }, [onSetErrorMessage]);

  return (
    <>
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={1800}
        onClose={() => onSetSnackbarMessage("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 10 }}
      >
        <Alert severity="success" onClose={() => onSetSnackbarMessage("")}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      <Box sx={{ flex: 1, minHeight: 0, border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden", position: "relative" }}>
        {resolvedUrl ? (
          <>
            <webview
              ref={(element) => {
                const wv = element as Electron.WebviewTag | null;
                webviewElRef.current = wv;
                setWebviewRef(wv);
              }}
              src={resolvedUrl}
              style={{ width: "100%", height: "100%", display: hasError ? "none" : "inline-flex" }}
              allowpopups
              // @ts-expect-error — Electron webview custom JSX event props
              onDidFailLoad={(event: { errorDescription?: string; validatedURL?: string; errorColumn?: number; errorLine?: number }) => {
                const desc = event?.errorDescription?.trim() || "Navigation failed.";
                const target = event?.validatedURL?.trim() || resolvedUrl;
                onSetErrorMessage(`${desc}: ${target}`);
                setHasError(true);
              }}
              onDidStartLoading={() => {
                onSetErrorMessage("");
                setHasError(false);
              }}
            />
            {hasError ? (
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, p: 4, bgcolor: "background.paper" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: "50%", bgcolor: "error.lighter" }}>
                  <LuTriangle size={24} color="#f44336" />
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 600, color: "text.primary" }}>This page can't be loaded</Typography>
                <Typography sx={{ fontSize: 13, color: "text.secondary", textAlign: "center", maxWidth: 400 }}>
                  {errorMessage}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<LuRefreshCcw size={14} />} onClick={handleReload}>
                    Retry
                  </Button>
                </Box>
              </Box>
            ) : null}
          </>
        ) : (
          blankContent
        )}
      </Box>
    </>
  );
}
