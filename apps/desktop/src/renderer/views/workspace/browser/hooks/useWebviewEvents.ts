import { useCallback, useEffect, useRef, useState } from "react";
import { useCommands } from "../../../../hooks/useCommands";

export function useWebviewEvents(args: {
  tabId: string;
  resolvedUrl: string;
  pageTitle: string;
  addHistoryEntry: (url: string, title: string, faviconUrl?: string) => void;
  setPageTitle: (title: string) => void;
}) {
  const { tabId, resolvedUrl, pageTitle, addHistoryEntry, setPageTitle } = args;
  const cmd = useCommands();
  const webviewRef = useRef<Electron.WebviewTag | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isWebviewReady, setIsWebviewReady] = useState(false);

  useEffect(() => {
    setIsWebviewReady(false);
    setCanGoBack(false);
    setCanGoForward(false);
  }, [resolvedUrl]);

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
      setPageTitle(nextTitle);
      addHistoryEntry(resolvedUrl, nextTitle);
      cmd.renameTab(tabId, nextTitle);
    };

    const handleFaviconUpdated = (event: Event) => {
      const favicons = (event as { favicons?: string[] }).favicons;
      const faviconUrl = favicons?.[0];
      cmd.setBrowserTabFaviconUrl(tabId, faviconUrl);
      if (faviconUrl) {
        addHistoryEntry(resolvedUrl, pageTitle, faviconUrl);
      }
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
  }, [cmd, isWebviewReady, tabId, resolvedUrl, addHistoryEntry, pageTitle, setPageTitle]);

  const setWebviewRef = useCallback((element: Electron.WebviewTag | null) => {
    webviewRef.current = element;
  }, []);

  return { webviewRef, setWebviewRef, canGoBack, canGoForward, isWebviewReady };
}
