export const DEFAULT_REMOTE_API_BASE_URL = "https://api.yishan.io";
export const DEFAULT_DEV_REMOTE_API_BASE_URL = "http://localhost:8787";

type RendererHostBridge = {
  getAuthTokens?: () => Promise<{
    authenticated: boolean;
    accessToken?: string;
    refreshToken?: string;
  }>;
};

type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

/** In-memory cached access token from a successful refresh so subsequent requests reuse it. */
let cachedAccessToken: string | undefined;

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
    };
  } catch {
    return undefined;
  }
}

function resolveApiBaseUrl(): string {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  return import.meta.env.DEV ? DEFAULT_DEV_REMOTE_API_BASE_URL : DEFAULT_REMOTE_API_BASE_URL;
}

/** Attempts to refresh the access token using the refresh token via the API. */
async function refreshAccessToken(refreshToken: string): Promise<string | undefined> {
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

    const payload = (await response.json()) as { accessToken?: string };
    return payload.accessToken?.trim() || undefined;
  } catch {
    return undefined;
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

/** Sends one JSON request to remote api-service and returns parsed JSON response body. */
export async function requestJson<T>(
  path: string,
  input?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
): Promise<T> {
  const tokens = await resolveAuthTokens();
  const baseUrl = resolveApiBaseUrl();
  const url = new URL(path, baseUrl);
  const headers: Record<string, string> = {};
  if (input?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  const response = await fetch(url.toString(), {
    method: input?.method ?? "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    credentials: "include",
    body: input?.body === undefined ? undefined : JSON.stringify(input.body),
  });

  // On 401, attempt to refresh the access token and retry the request once.
  if (response.status === 401 && tokens?.refreshToken) {
    const freshAccessToken = await refreshAccessToken(tokens.refreshToken);
    if (freshAccessToken) {
      cachedAccessToken = freshAccessToken;

      const retryHeaders: Record<string, string> = {};
      if (input?.body !== undefined) {
        retryHeaders["Content-Type"] = "application/json";
      }
      retryHeaders.Authorization = `Bearer ${freshAccessToken}`;

      const retryResponse = await fetch(url.toString(), {
        method: input?.method ?? "GET",
        headers: retryHeaders,
        credentials: "include",
        body: input?.body === undefined ? undefined : JSON.stringify(input.body),
      });

      if (!retryResponse.ok) {
        let message = `Request failed with status ${retryResponse.status}`;
        try {
          const payload = (await retryResponse.json()) as { error?: string };
          if (payload?.error?.trim()) {
            message = payload.error;
          }
        } catch {
          // ignore parse errors and keep fallback message
        }

        throw new RestApiError(message, retryResponse.status);
      }

      return (await retryResponse.json()) as T;
    }
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error?.trim()) {
        message = payload.error;
      }
    } catch {
      // ignore parse errors and keep fallback message
    }

    throw new RestApiError(message, response.status);
  }

  return (await response.json()) as T;
}
