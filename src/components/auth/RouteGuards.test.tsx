import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth, RequireGuest, RequireRole } from "./RouteGuards";
import type { AuthUser } from "../../types/api";

const auth = vi.hoisted(() => ({
  current: {
    status: "anonymous" as "loading" | "authenticated" | "anonymous",
    user: null as AuthUser | null,
  },
}));

vi.mock("../../context/AuthProvider", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useAuth: () => auth.current };
});

const seller: AuthUser = {
  id: 2,
  full_name: "Seller One",
  email: "seller@example.com",
  role: "seller",
  status: "active",
};

describe("route guards", () => {
  it("shows a session restoration gate while auth status is loading", () => {
    auth.current = { status: "loading", user: null };
    render(
      <MemoryRouter initialEntries={["/seller"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/seller" element={<div>private seller content</div>} />
          </Route>
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Restoring your secure session…")).toBeInTheDocument();
    expect(screen.queryByText("private seller content")).not.toBeInTheDocument();
  });

  it("redirects anonymous users to login and preserves the next path", () => {
    auth.current = { status: "anonymous", user: null };
    render(
      <MemoryRouter initialEntries={["/seller/offers"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/seller/offers" element={<div>private offers</div>} />
          </Route>
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("login screen")).toBeInTheDocument();
    expect(screen.queryByText("private offers")).not.toBeInTheDocument();
  });

  it("renders private content only after authentication resolves", () => {
    auth.current = { status: "authenticated", user: seller };
    render(
      <MemoryRouter initialEntries={["/seller"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/seller" element={<div>private seller content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("private seller content")).toBeInTheDocument();
  });

  it("blocks the wrong role without rendering the protected outlet", () => {
    auth.current = {
      status: "authenticated",
      user: { ...seller, role: "buyer" },
    };
    render(
      <MemoryRouter initialEntries={["/seller"]}>
        <Routes>
          <Route element={<RequireRole role="seller" />}>
            <Route path="/seller" element={<div>private seller content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("This workspace is restricted")).toBeInTheDocument();
    expect(screen.queryByText("private seller content")).not.toBeInTheDocument();
  });

  it("redirects authenticated users away from public auth screens", () => {
    auth.current = { status: "authenticated", user: seller };
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route
            path="/login"
            element={
              <RequireGuest>
                <div>login form</div>
              </RequireGuest>
            }
          />
          <Route path="/seller" element={<div>seller home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("seller home")).toBeInTheDocument();
    expect(screen.queryByText("login form")).not.toBeInTheDocument();
  });
});
