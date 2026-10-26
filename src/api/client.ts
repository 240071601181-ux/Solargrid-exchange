const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const rawWsUrl = import.meta.env.VITE_WS_URL?.trim();
const rawCsrfCookie = import.meta.env.VITE_CSRF_COOKIE_NAME?.trim();

export const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : "/api/v1";
export const CSRF_COOKIE_NAME = rawCsrfCookie || "sg_csrf";

function resolveWebSocketUrl(value: string | undefined): string {
  if (!value) return "";
  if (/^wss?:\/\//i.test(value)) return value;
  if (typeof window === "undefined") return value;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${protocol}//${window.location.host}${path}`;
}

export const WS_URL = resolveWebSocketUrl(rawWsUrl);

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const CSRF_FAILURE_DETAIL = "CSRF validation failed.";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly url: string;

  constructor(status: number, detail: string, url: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.url = url;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  timeoutMs?: number;
  signal?: AbortSignal;
  suppressAuthEvent?: boolean;
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

let csrfRequest: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  const pending = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/csrf`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return null;
      let bodyToken: string | undefined;
      try {
        const body = (await response.json()) as { csrf_token?: string };
        bodyToken = body.csrf_token;
      } catch {
        // The cookie may still have been set even if the body was not JSON.
      }
      // Prefer the body: it is the token the server just issued. The readable
      // cookie is the value that must accompany it in the next request.
      return bodyToken ?? readCookie(CSRF_COOKIE_NAME) ?? null;
    } catch {
      return null;
    }
  })();

  csrfRequest = pending;
  try {
    return await pending;
  } finally {
    if (csrfRequest === pending) csrfRequest = null;
  }
}

async function ensureCsrfToken(): Promise<string | null> {
  return readCookie(CSRF_COOKIE_NAME) ?? csrfRequest ?? fetchCsrfToken();
}

async function refreshCsrfToken(): Promise<string | null> {
  // Always ask the server. This rotates the token when the cookie is missing,
  // stale, or was issued for a different session.
  return fetchCsrfToken();
}

async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.clone().json();
    if (typeof payload === "object" && payload !== null && "detail" in payload) {
      const detail = (payload as { detail: unknown }).detail;
      return typeof detail === "string" ? detail : null;
    }
  } catch {
    // Not JSON; the caller will parse the final response normally.
  }
  return null;
}

function withQuery(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function parseError(response: Response, url: string): Promise<ApiError> {
  let detail = `Request failed with HTTP ${response.status}`;
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "detail" in payload) {
      const raw = (payload as { detail: unknown }).detail;
      if (typeof raw === "string") {
        detail = raw;
      } else if (Array.isArray(raw)) {
        const messages = raw
          .map((entry) => {
            if (typeof entry === "object" && entry !== null && "msg" in entry) {
              return String((entry as { msg: unknown }).msg);
            }
            return String(entry);
          })
          .filter(Boolean);
        if (messages.length) detail = messages.join("; ");
      } else if (raw !== undefined) {
        detail = JSON.stringify(raw);
      }
    }
  } catch {
    // The response body was not JSON; keep the status-based message.
  }
  return new ApiError(response.status, detail, url);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError(
      0,
      "VITE_API_BASE_URL is not configured. Copy .env.example to .env and use /api/v1 (same-origin) or the backend URL.",
      path,
    );
  }

  const url = `${API_BASE_URL}${withQuery(path, options.query)}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const method = options.method ?? "GET";
    const unsafe = UNSAFE_METHODS.has(method);
    let csrfToken = unsafe ? await ensureCsrfToken() : null;
    const send = (token: string | null) =>
      fetch(url, {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { "X-CSRF-Token": token } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

    let response = await send(csrfToken);

    // A stale or cross-session token is recoverable: obtain the current token
    // once and retry. Do not retry ordinary authorization 403 responses.
    if (response.status === 403 && unsafe && (await readErrorDetail(response)) === CSRF_FAILURE_DETAIL) {
      const refreshed = await refreshCsrfToken();
      if (refreshed && refreshed !== csrfToken) {
        csrfToken = refreshed;
        response = await send(csrfToken);
      }
    }

    if (!response.ok) {
      if (response.status === 401 && !options.suppressAuthEvent && typeof window !== "undefined") {
        window.dispatchEvent(new Event("solargrid:session-expired"));
      }
      throw await parseError(response, url);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(0, "The request took too long and was cancelled.", url);
    }
    throw new ApiError(
      0,
      error instanceof Error
        ? `Cannot reach the backend at ${API_BASE_URL}. ${error.message}`
        : "Cannot reach the backend.",
      url,
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export function describeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return error.detail;
    return error.detail || `Request failed (${error.status}).`;
  }
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred.";
}
