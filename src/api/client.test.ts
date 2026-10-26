import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, API_BASE_URL, describeApiError, request } from "../api/client";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    clone: () => jsonResponse(payload, status),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "sg_csrf=; Max-Age=0; path=/";
});

describe("API client", () => {
  it("is configured for the same-origin API", () => {
    expect(API_BASE_URL).toBe("/api/v1");
  });

  it("builds query strings, skips empty values and posts JSON with credentials and CSRF", async () => {
    document.cookie = "sg_csrf=test-token; path=/";
    const fetchMock = vi.fn(async () => jsonResponse({ id: 7 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await request<{ id: number }>("/optimization/run", {
      method: "POST",
      query: { page: 2, empty: "", missing: undefined, flag: false },
      body: { ticks: 24 },
    });

    expect(result).toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/optimization/run?page=2&flag=false");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.body).toBe(JSON.stringify({ ticks: 24 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect((init.headers as Record<string, string>)["X-CSRF-Token"]).toBe("test-token");
  });

  it("retrieves a CSRF token before an unsafe request when the cookie is absent", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/csrf")) return jsonResponse({ csrf_token: "fresh-token" });
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await request("/auth/login", { method: "POST", body: { email: "a@b.com", password: "Password123" } });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [mainUrl, mainInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(mainUrl).toBe("/api/v1/auth/login");
    expect((mainInit.headers as Record<string, string>)["X-CSRF-Token"]).toBe("fresh-token");
  });

  it("refreshes a rejected CSRF token once and retries the request", async () => {
    document.cookie = "sg_csrf=stale-token; path=/";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/csrf")) return jsonResponse({ csrf_token: "fresh-token" });
      const headers = (init?.headers ?? {}) as Record<string, string>;
      if (headers["X-CSRF-Token"] === "stale-token") {
        return jsonResponse({ detail: "CSRF validation failed." }, 403);
      }
      return jsonResponse({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      request("/auth/logout", { method: "POST" }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [csrfUrl] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(csrfUrl).toBe("/api/v1/auth/csrf");
    const [retryUrl, retryInit] = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    expect(retryUrl).toBe("/api/v1/auth/logout");
    expect((retryInit.headers as Record<string, string>)["X-CSRF-Token"]).toBe("fresh-token");
  });

  it("does not refresh a normal authorization 403", async () => {
    document.cookie = "sg_csrf=valid-token; path=/";
    const fetchMock = vi.fn(async () =>
      jsonResponse({ detail: "You do not have permission to access this resource." }, 403),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/settings", { method: "PATCH", body: {} })).rejects.toMatchObject({
      status: 403,
      detail: "You do not have permission to access this resource.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parses a string error detail into ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "No weather available" }, 503)));

    await expect(request("/forecast")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      detail: "No weather available",
    });
  });

  it("joins FastAPI validation messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            detail: [
              { loc: ["body", "ticks"], msg: "Input should be greater than or equal to 8" },
              { loc: ["body", "cloud_cover_pct"], msg: "Input should be less than or equal to 100" },
            ],
          },
          422,
        ),
      ),
    );

    await expect(request("/evaluation/run", { method: "POST", body: {} })).rejects.toThrow(
      "Input should be greater than or equal to 8; Input should be less than or equal to 100",
    );
  });

  it("wraps network failures with the backend URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      }),
    );

    const error = await request("/simulation/state").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).detail).toContain("Cannot reach the backend");
    expect((error as ApiError).detail).toContain("connection refused");
  });

  it("describes known and unknown errors", () => {
    expect(describeApiError(new ApiError(500, "boom", "/x"))).toBe("boom");
    expect(describeApiError(new ApiError(0, "offline", "/x"))).toBe("offline");
    expect(describeApiError(new Error("plain"))).toBe("plain");
    expect(describeApiError("odd")).toBe("An unexpected error occurred.");
  });
});
