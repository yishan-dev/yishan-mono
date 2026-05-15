const webviewsByTabId = new Map<string, Electron.WebviewTag>();
const requestedUrlByTabId = new Map<string, string>();
const placeholdersByTabId = new Map<string, HTMLElement>();
const resizeObserversByTabId = new Map<string, ResizeObserver>();

let rootHost: HTMLDivElement | null = null;

function getRootHost(): HTMLDivElement {
  if (rootHost) {
    return rootHost;
  }

  const host = document.createElement("div");
  host.setAttribute("data-testid", "webview-root-host");
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "0";
  host.style.height = "0";
  host.style.pointerEvents = "none";
  host.style.zIndex = "0";
  document.body.appendChild(host);
  rootHost = host;
  return host;
}

function updateWebviewLayout(tabId: string): void {
  const webview = webviewsByTabId.get(tabId);
  const placeholder = placeholdersByTabId.get(tabId);
  if (!webview || !placeholder) {
    return;
  }

  const rect = placeholder.getBoundingClientRect();
  webview.style.left = `${rect.left}px`;
  webview.style.top = `${rect.top}px`;
  webview.style.width = `${rect.width}px`;
  webview.style.height = `${rect.height}px`;
}

export function getOrCreateWebview(tabId: string, initialUrl: string): Electron.WebviewTag {
  const existing = webviewsByTabId.get(tabId);
  if (existing) {
    if (!requestedUrlByTabId.has(tabId)) {
      requestedUrlByTabId.set(tabId, existing.getAttribute("src") ?? "");
    }
    return existing;
  }

  const webview = document.createElement("webview") as Electron.WebviewTag;
  webview.style.position = "fixed";
  webview.style.left = "0";
  webview.style.top = "0";
  webview.style.width = "0";
  webview.style.height = "0";
  webview.style.margin = "0";
  webview.style.padding = "0";
  webview.style.border = "none";
  webview.style.visibility = "hidden";
  webview.style.pointerEvents = "auto";
  if (initialUrl) {
    webview.setAttribute("src", initialUrl);
  }
  getRootHost().appendChild(webview);
  webviewsByTabId.set(tabId, webview);
  requestedUrlByTabId.set(tabId, initialUrl);
  return webview;
}

export function syncWebviewUrl(tabId: string, resolvedUrl: string): void {
  const webview = webviewsByTabId.get(tabId);
  if (!webview) {
    return;
  }

  const normalizedUrl = resolvedUrl.trim();
  const requestedUrl = requestedUrlByTabId.get(tabId) ?? "";
  if (requestedUrl === normalizedUrl) {
    return;
  }

  requestedUrlByTabId.set(tabId, normalizedUrl);
  webview.setAttribute("src", normalizedUrl);
}

export function parkWebview(tabId: string): void {
  const webview = webviewsByTabId.get(tabId);
  if (!webview) {
    return;
  }
  webview.style.visibility = "hidden";
  webview.style.width = "0";
  webview.style.height = "0";
  webview.style.pointerEvents = "none";
}

export function attachWebviewPlaceholder(tabId: string, placeholder: HTMLElement): void {
  const webview = webviewsByTabId.get(tabId);
  if (!webview) {
    return;
  }
  placeholdersByTabId.set(tabId, placeholder);
  const existingObserver = resizeObserversByTabId.get(tabId);
  existingObserver?.disconnect();

  const observer = new ResizeObserver(() => {
    updateWebviewLayout(tabId);
  });
  observer.observe(placeholder);
  resizeObserversByTabId.set(tabId, observer);

  updateWebviewLayout(tabId);
  webview.style.visibility = "visible";
  webview.style.pointerEvents = "auto";
}

export function detachWebviewPlaceholder(tabId: string, placeholder: HTMLElement): void {
  const current = placeholdersByTabId.get(tabId);
  if (current !== placeholder) {
    return;
  }
  placeholdersByTabId.delete(tabId);
  const observer = resizeObserversByTabId.get(tabId);
  observer?.disconnect();
  resizeObserversByTabId.delete(tabId);
  parkWebview(tabId);
}

export function removeWebviewsForClosedTabs(openTabIds: ReadonlySet<string>): void {
  for (const [tabId, webview] of webviewsByTabId.entries()) {
    if (openTabIds.has(tabId)) {
      continue;
    }
    webviewsByTabId.delete(tabId);
    requestedUrlByTabId.delete(tabId);
    placeholdersByTabId.delete(tabId);
    const observer = resizeObserversByTabId.get(tabId);
    observer?.disconnect();
    resizeObserversByTabId.delete(tabId);
    webview.remove();
  }

  if (webviewsByTabId.size === 0 && rootHost) {
    rootHost.remove();
    rootHost = null;
  }
}
