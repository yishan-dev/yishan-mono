import { Alert, Box, Divider, IconButton, Menu, MenuItem, Snackbar, TextField } from "@mui/material";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LuArrowLeft, LuArrowRight, LuCamera, LuCookie, LuDatabaseZap, LuHistory, LuRefreshCcw, LuTrash2, LuWrench } from "react-icons/lu";
import { useCommands } from "../../../hooks/useCommands";

function normalizeUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

type BrowserViewProps = {
  tabId: string;
  initialUrl: string;
};

export function BrowserView({ tabId, initialUrl }: BrowserViewProps) {
  const cmd = useCommands();
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [activeUrl, setActiveUrl] = useState(initialUrl);
  const [errorMessage, setErrorMessage] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isWebviewReady, setIsWebviewReady] = useState(false);
  const [toolsAnchor, setToolsAnchor] = useState<HTMLElement | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  useEffect(() => {
    setUrlInput(initialUrl);
    setActiveUrl(initialUrl);
  }, [initialUrl]);

  const resolvedUrl = useMemo(() => normalizeUrl(activeUrl), [activeUrl]);

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    const handlePageTitleUpdated = (event: Event) => {
      const nextTitle = (event as { title?: string }).title?.trim();
      if (!nextTitle) {
        return;
      }
      cmd.renameTab(tabId, nextTitle);
    };

    const handleFaviconUpdated = (event: Event) => {
      const favicons = (event as { favicons?: string[] }).favicons;
      cmd.setBrowserTabFaviconUrl(tabId, favicons?.[0]);
    };

    const updateNavigationState = () => {
      if (!isWebviewReady) {
        setCanGoBack(false);
        setCanGoForward(false);
        return;
      }
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
    };

    const handleDomReady = () => {
      setIsWebviewReady(true);
      updateNavigationState();
    };

    webview.addEventListener("page-title-updated", handlePageTitleUpdated);
    webview.addEventListener("page-favicon-updated", handleFaviconUpdated);
    webview.addEventListener("dom-ready", handleDomReady);
    webview.addEventListener("did-navigate", updateNavigationState);
    webview.addEventListener("did-navigate-in-page", updateNavigationState);
    webview.addEventListener("did-start-navigation", updateNavigationState);
    webview.addEventListener("did-stop-loading", updateNavigationState);
    updateNavigationState();

    return () => {
      webview.removeEventListener("page-title-updated", handlePageTitleUpdated);
      webview.removeEventListener("page-favicon-updated", handleFaviconUpdated);
      webview.removeEventListener("dom-ready", handleDomReady);
      webview.removeEventListener("did-navigate", updateNavigationState);
      webview.removeEventListener("did-navigate-in-page", updateNavigationState);
      webview.removeEventListener("did-start-navigation", updateNavigationState);
      webview.removeEventListener("did-stop-loading", updateNavigationState);
    };
  }, [cmd, isWebviewReady, tabId, resolvedUrl]);

  useEffect(() => {
    setIsWebviewReady(false);
    setCanGoBack(false);
    setCanGoForward(false);
  }, [resolvedUrl]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUrl = normalizeUrl(urlInput);
    if (!nextUrl) {
      setErrorMessage("Enter a valid URL to load a page.");
      return;
    }

    setErrorMessage("");
    cmd.setBrowserTabFaviconUrl(tabId, undefined);
    setActiveUrl(nextUrl);
  };

  const closeToolsMenu = () => {
    setToolsAnchor(null);
  };

  const notifySuccess = (message: string) => {
    setSnackbarMessage(message);
  };

  const handleOpenDevTools = () => {
    closeToolsMenu();
    webviewRef.current?.openDevTools();
  };

  const handleForceReload = () => {
    closeToolsMenu();
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    const candidate = webview as unknown as { reloadIgnoringCache?: () => void };
    candidate.reloadIgnoringCache?.();
  };

  const handleTakeSnapshot = async () => {
    closeToolsMenu();
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }
    try {
      const image = await webview.capturePage();
      const link = document.createElement("a");
      link.download = `snapshot-${Date.now()}.png`;
      link.href = image.toDataURL();
      link.click();
      notifySuccess("Snapshot saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Failed to take snapshot: ${message}`);
    }
  };

  const handleClearCache = async () => {
    closeToolsMenu();
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    try {
      const candidate = webview as unknown as { clearCache?: () => void | Promise<void>; reload?: () => void };
      if (typeof candidate.clearCache === "function") {
        await candidate.clearCache();
      }
      candidate.reload?.();
      setErrorMessage("");
      notifySuccess("Clear Cache succeeded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Failed to clear browser cache: ${message}`);
    }
  };

  const handleClearHistory = () => {
    closeToolsMenu();
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    try {
      const candidate = webview as unknown as { clearHistory?: () => void };
      if (typeof candidate.clearHistory === "function") {
        candidate.clearHistory();
      }
      setCanGoBack(false);
      setCanGoForward(false);
      setErrorMessage("");
      notifySuccess("Clear History succeeded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Failed to clear browser history: ${message}`);
    }
  };

  const handleClearCookies = async () => {
    closeToolsMenu();
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    try {
      const candidate = webview as unknown as {
        clearStorageData?: (options?: { storages?: string[] }) => void | Promise<void>;
        reload?: () => void;
      };

      if (typeof candidate.clearStorageData === "function") {
        await candidate.clearStorageData({ storages: ["cookies"] });
      }

      candidate.reload?.();
      setErrorMessage("");
      notifySuccess("Clear Cookies succeeded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Failed to clear browser cookies: ${message}`);
    }
  };

  const handleClearAllData = async () => {
    closeToolsMenu();
    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    try {
      const candidate = webview as unknown as {
        clearHistory?: () => void;
        clearStorageData?: (options?: { storages?: string[] }) => void | Promise<void>;
        clearCache?: () => void | Promise<void>;
        reload?: () => void;
      };

      candidate.clearHistory?.();
      if (typeof candidate.clearStorageData === "function") {
        await candidate.clearStorageData();
      }
      if (typeof candidate.clearCache === "function") {
        await candidate.clearCache();
      }

      setCanGoBack(false);
      setCanGoForward(false);
      candidate.reload?.();
      setErrorMessage("");
      notifySuccess("Clear All Data succeeded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Failed to clear browser data: ${message}`);
    }
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", p: 1.25, gap: 1 }}>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", gap: 1 }}>
        <IconButton aria-label="Go back" disabled={!canGoBack} onClick={() => webviewRef.current?.goBack()}>
          <LuArrowLeft size={14} />
        </IconButton>
        <IconButton aria-label="Go forward" disabled={!canGoForward} onClick={() => webviewRef.current?.goForward()}>
          <LuArrowRight size={14} />
        </IconButton>
        <IconButton aria-label="Reload page" onClick={() => webviewRef.current?.reload()}>
          <LuRefreshCcw size={14} />
        </IconButton>
        <TextField
          size="small"
          value={urlInput}
          onChange={(event) => setUrlInput(event.target.value)}
          placeholder="https://example.com"
          fullWidth
          sx={{
            "& .MuiInputBase-input": {
              py: 0.75,
              fontSize: 13,
            },
          }}
        />
        <IconButton aria-label="Browser tools" onClick={(event) => setToolsAnchor(event.currentTarget)}>
          <LuWrench size={14} />
        </IconButton>
        <Menu
          anchorEl={toolsAnchor}
          open={Boolean(toolsAnchor)}
          onClose={closeToolsMenu}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem onClick={handleOpenDevTools}>
            <LuWrench size={14} style={{ marginRight: 8 }} />
            Open Devtool
          </MenuItem>
          <MenuItem onClick={handleForceReload}>
            <LuRefreshCcw size={14} style={{ marginRight: 8 }} />
            Force Reload
          </MenuItem>
          <MenuItem onClick={() => void handleTakeSnapshot()}>
            <LuCamera size={14} style={{ marginRight: 8 }} />
            Take Snapshot
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => void handleClearCache()}>
            <LuTrash2 size={14} style={{ marginRight: 8 }} />
            Clear Cache
          </MenuItem>
          <MenuItem onClick={() => void handleClearCookies()}>
            <LuCookie size={14} style={{ marginRight: 8 }} />
            Clear Cookies
          </MenuItem>
          <MenuItem onClick={handleClearHistory}>
            <LuHistory size={14} style={{ marginRight: 8 }} />
            Clear History
          </MenuItem>
          <MenuItem onClick={() => void handleClearAllData()}>
            <LuDatabaseZap size={14} style={{ marginRight: 8 }} />
            Clear All Data
          </MenuItem>
        </Menu>
      </Box>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={1800}
        onClose={() => setSnackbarMessage("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ mt: 10 }}
      >
        <Alert severity="success" onClose={() => setSnackbarMessage("")}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
      <Box sx={{ flex: 1, minHeight: 0, border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
        {resolvedUrl ? (
          <webview
            ref={(element) => {
              webviewRef.current = element as Electron.WebviewTag | null;
            }}
            src={resolvedUrl}
            style={{ width: "100%", height: "100%", display: "inline-flex" }}
            allowpopups
            onDidFailLoad={(event: { errorDescription?: string; validatedURL?: string }) => {
              const message = event?.errorDescription?.trim() || "Navigation failed.";
              const target = event?.validatedURL?.trim() || resolvedUrl;
              setErrorMessage(`${message} Check the URL and your network, then retry: ${target}`);
            }}
            onDidStartLoading={() => {
              setErrorMessage("");
            }}
          />
        ) : (
          <Box sx={{ p: 2 }}>Enter a URL to load web content.</Box>
        )}
      </Box>
    </Box>
  );
}
