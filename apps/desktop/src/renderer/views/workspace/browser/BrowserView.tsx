import { Alert, Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LuArrowLeft, LuArrowRight, LuBug, LuRefreshCcw } from "react-icons/lu";
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
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Open browser tab DevTools"
                  size="small"
                  onClick={() => webviewRef.current?.openDevTools()}
                >
                  <LuBug size={14} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
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
