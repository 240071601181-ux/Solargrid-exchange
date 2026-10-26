import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";
import type { AuthUser } from "../types/api";

const api = vi.hoisted(() => ({
  session: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../api/authApi", () => ({ authApi: api }));

const seller: AuthUser = {
  id: 2,
  full_name: "Seller One",
  email: "seller@example.com",
  role: "seller",
  status: "active",
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="identity">{auth.user ? `${auth.user.role} ${auth.user.email}` : "none"}</p>
      <button type="button" onClick={() => void auth.logout()}>Sign out</button>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("restores a server session without any private-content flash", async () => {
    api.session.mockResolvedValue({ user: seller, csrf_token: "csrf" });
    renderProvider();
    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("identity")).toHaveTextContent("seller seller@example.com");
    expect(api.session).toHaveBeenCalledTimes(1);
  });

  it("settles as anonymous when no session exists", async () => {
    api.session.mockResolvedValue({ user: null, csrf_token: "csrf" });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("identity")).toHaveTextContent("none");
  });

  it("clears the user and query cache on logout", async () => {
    api.session.mockResolvedValue({ user: seller, csrf_token: "csrf" });
    api.logout.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(api.logout).toHaveBeenCalledTimes(1);
  });

  it("clears the session when any API request emits an expiry event", async () => {
    api.session.mockResolvedValue({ user: seller, csrf_token: "csrf" });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    act(() => {
      window.dispatchEvent(new Event("solargrid:session-expired"));
    });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
  });
});
