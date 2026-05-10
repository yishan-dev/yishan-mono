export const DEFAULT_REMOTE_API_BASE_URL = "https://api.yishan.io";
export const DEFAULT_DEV_REMOTE_API_BASE_URL = "http://localhost:8787";

type RendererHostBridge = {
  getAuthTokens?: () => Promise<{
    authenticated: boolean;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  }>;
};

type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
};

const ACCESS_TOKEN_EARLY_REFRESH_WINDOW_MS = 30_000;
const REFRESH_TOKEN_EXPIRY_GUARD_WINDOW_MS = 30_000;

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function isWithinWindow(timestampMs: number | undefined, windowMs: number): boolean {
  if (timestampMs === undefined) {
    return false;
  }
  return Date.now() >= timestampMs - windowMs;
}

// ---------------------------------------------------------------------------
// Auth-expired event bus
// ---------------------------------------------------------------------------

type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

/** Register a callback invoked when token refresh fails and the session is expired. Returns an unsubscribe function. */
export function onAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => {
    authExpiredListeners.delete(listener);
  };
}

/** Tracks whether auth-expired has already been emitted in this session to avoid repeated notifications. */
let authExpiredEmitted = false;

function emitAuthExpired(): void {
  if (authExpiredEmitted) {
    return;
  }
  authExpiredEmitted = true;

  for (const listener of authExpiredListeners) {
    try {
      listener();
    } catch {
      // best-effort delivery; do not block remaining listeners
    }
  }
}

/** Resets the auth-expired emission flag (called after successful re-authentication). */
export function resetAuthExpiredState(): void {
  authExpiredEmitted = false;
  cachedAccessToken = undefined;
}

// ---------------------------------------------------------------------------
// Token management with mutex-guarded refresh
// ---------------------------------------------------------------------------

/** In-memory cached access token from a successful refresh so subsequent requests reuse it. */
let cachedAccessToken: string | undefined;

/**
 * Pending refresh promise. When a refresh is already in-flight, subsequent
 * callers await the same promise instead of issuing duplicate refresh calls.
 */
let activeRefreshPromise: Promise<string | undefined> | undefined;

function getRendererHostBridge(): RendererHostBridge | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (window as typeof window & { __YISHAN__?: { host?: RendererHostBridge } }).__YISHAN__?.host ?? undefined;
}

async function resolveAuthTokens(): Promise<AuthTokens | undefined> {
  const bridge = getRendererHostBridge();
  if (!bridge?.getAuthTokens) {
    return undefined;
  }

  try {
    const authTokens = await bridge.getAuthTokens();
    if (!authTokens.authenticated || !authTokens.accessToken) {
      return undefined;
    }

    return {
      accessToken: cachedAccessToken ?? authTokens.accessToken,
      refreshToken: authTokens.refreshToken,
      accessTokenExpiresAt: authTokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: authTokens.refreshTokenExpiresAt,
    };
  } catch {
    return undefined;
  }
}

async function ensureFreshAccessToken(tokens: AuthTokens): Promise<AuthTokens | undefined> {
  const refreshTokenExpiryMs = parseTimestamp(tokens.refreshTokenExpiresAt);
  if (tokens.refreshToken && isWithinWindow(refreshTokenExpiryMs, REFRESH_TOKEN_EXPIRY_GUARD_WINDOW_MS)) {
    console.warn("[restClient] Refresh token is expired or near expiry; ending authenticated session", {
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      guardWindowMs: REFRESH_TOKEN_EXPIRY_GUARD_WINDOW_MS,
    });
    emitAuthExpired();
    return undefined;
  }

  const accessTokenExpiryMs = parseTimestamp(tokens.accessTokenExpiresAt);
  const shouldRefreshAccessToken = tokens.refreshToken && isWithinWindow(accessTokenExpiryMs, ACCESS_TOKEN_EARLY_REFRESH_WINDOW_MS);
  if (!shouldRefreshAccessToken) {
    return tokens;
  }

  console.info("[restClient] Proactively refreshing access token before expiry", {
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    earlyRefreshWindowMs: ACCESS_TOKEN_EARLY_REFRESH_WINDOW_MS,
  });

  const freshAccessToken = await refreshAccessToken(tokens.refreshToken);
  if (!freshAccessToken) {
    console.warn("[restClient] Proactive access token refresh failed; ending authenticated session");
    emitAuthExpired();
    return undefined;
  }

  console.info("[restClient] Proactive access token refresh succeeded");

  return {
    ...tokens,
    accessToken: freshAccessToken,
  };
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return import.meta.env.DEV ? DEFAULT_DEV_REMOTE_API_BASE_URL : DEFAULT_REMOTE_API_BASE_URL;
}

/** Attempts to refresh the access token using the refresh token via the API. */
async function refreshAccessTokenRequest(refreshToken: string): Promise<string | undefined> {
  const baseUrl = resolveApiBaseUrl();
  const url = new URL("/auth/refresh", baseUrl);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      accessToken?: string;
      refreshToken?: string;
      accessTokenExpiresAt?: string;
      refreshTokenExpiresAt?: string;
    };
    const accessToken = payload.accessToken?.trim() || undefined;
    if (!accessToken) {
      return undefined;
    }

    try {
      const daemonClient = await getDaemonClient();
      await daemonClient.app.persistAuthTokens({
        accessToken,
        refreshToken: payload.refreshToken?.trim() || undefined,
        accessTokenExpiresAt: payload.accessTokenExpiresAt?.trim() || undefined,
        refreshTokenExpiresAt: payload.refreshTokenExpiresAt?.trim() || undefined,
      });
    } catch {
      // Best-effort daemon sync. Keep in-memory token so current renderer
      // request can still recover even if daemon persistence is temporarily
      // unavailable.
    }

    return accessToken;
  } catch {
    return undefined;
  }
}

/**
 * Mutex-guarded token refresh. If a refresh is already in progress, all
 * concurrent callers share the same pending promise so only one network
 * request is issued. When the refresh fails, an auth-expired event is
 * emitted so the UI can prompt re-authentication.
 */
async function refreshAccessToken(refreshToken: string): Promise<string | undefined> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = refreshAccessTokenRequest(refreshToken);

  try {
    const result = await activeRefreshPromise;
    if (result) {
      cachedAccessToken = result;
    }
    return result;
  } finally {
    activeRefreshPromise = undefined;
  }
}

export class RestApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RestApiError";
    this.status = status;
  }
}

/** Builds the standard headers for a JSON request. */
function buildHeaders(accessToken: string | undefined, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

/** Executes a single fetch call to the remote api-service. */
async function executeFetch(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: unknown | undefined,
): Promise<Response> {
  return fetch(url, {
    method,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Reads an error message from a failed response body, falling back to a generic status message. */
async function readErrorMessage(response: Response): Promise<string> {
  let message = `Request failed with status ${response.status}`;
  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error?.trim()) {
      message = payload.error;
    }
  } catch {
    // ignore parse errors and keep fallback message
  }
  return message;
}

/** Sends one JSON request to remote api-service and returns parsed JSON response body. */
export async function requestJson<T>(
  path: string,
  input?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
): Promise<T> {
  const tokens = await resolveAuthTokens();
  const freshTokens = tokens ? await ensureFreshAccessToken(tokens) : undefined;
  const baseUrl = resolveApiBaseUrl();
  const url = new URL(path, baseUrl).toString();
  const method = input?.method ?? "GET";
  const hasBody = input?.body !== undefined;
  const headers = buildHeaders(freshTokens?.accessToken, hasBody);

  const response = await executeFetch(url, method, headers, input?.body);

  // On 401, attempt to refresh the access token and retry the request once.
  if (response.status === 401) {
    if (freshTokens?.refreshToken) {
      const freshAccessToken = await refreshAccessToken(freshTokens.refreshToken);
      if (freshAccessToken) {
        const retryHeaders = buildHeaders(freshAccessToken, hasBody);
        const retryResponse = await executeFetch(url, method, retryHeaders, input?.body);

        if (!retryResponse.ok) {
          const message = await readErrorMessage(retryResponse);
          throw new RestApiError(message, retryResponse.status);
        }

        return (await retryResponse.json()) as T;
      }
    }

    // Either no refresh token is available or the refresh itself failed.
    // The session is expired — notify listeners so the UI can transition
    // to a re-authentication state, then throw so the caller knows the
    // request was not completed.
    emitAuthExpired();
    const message = await readErrorMessage(response);
    throw new RestApiError(message, 401);
  }

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new RestApiError(message, response.status);
  }

  return (await response.json()) as T;
}
import { getDaemonClient } from "../rpc/rpcTransport";
