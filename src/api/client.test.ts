import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, API_BASE_URL, describeApiError, request } from "../api/client";

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("is configured for the backend", () => {
    expect(API_BASE_URL).toBe("http://127.0.0.1:8010/api/v1");
  });

  it("builds query strings, skips empty values and posts JSON", async () => {
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
    expect(url).toBe("http://127.0.0.1:8010/api/v1/optimization/run?page=2&flag=false");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ ticks: 24 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
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
