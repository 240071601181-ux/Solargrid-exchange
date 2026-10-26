const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const rawWsUrl = import.meta.env.VITE_WS_URL?.trim();

export const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : "";
export const WS_URL = rawWsUrl ?? "";

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
      "VITE_API_BASE_URL is not configured. Copy .env.example to .env and set the backend URL.",
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
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    if (!response.ok) {
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
