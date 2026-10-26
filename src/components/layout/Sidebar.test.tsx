import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { BUYER_NAV_GROUPS, SELLER_NAV_GROUPS, navGroupsForRole } from "./nav";

vi.mock("../../hooks/queries", () => ({
  useSharedStatus: () => ({
    data: {
      state: { status: "running", tick: 1, simulated_at: null },
      weather: {
        provider: "open-meteo",
        transport: "mcp stdio",
        status: "live",
        temperature_c: 31,
        cloud_cover_pct: 20,
        observed_at: null,
      },
    },
  }),
}));
vi.mock("../../hooks/useSimulationSocket", () => ({
  useSimulationSocket: () => ({ status: "connected" }),
}));
vi.mock("../../context/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: 2, full_name: "Seller One", email: "seller@example.com", role: "seller", status: "active" },
  }),
}));

describe("role-aware navigation", () => {
  it("maps each role to its own navigation tree", () => {
    expect(navGroupsForRole("seller")).toBe(SELLER_NAV_GROUPS);
    expect(navGroupsForRole("buyer")).toBe(BUYER_NAV_GROUPS);
    expect(BUYER_NAV_GROUPS.flatMap((group) => group.items).map((item) => item.to)).toEqual([
      "/buyer",
      "/buyer/marketplace",
      "/buyer/purchases",
      "/buyer/usage",
      "/buyer/prices",
      "/buyer/settings",
    ]);
  });

  it("renders seller links and the signed-in account without admin controls", () => {
    render(
      <MemoryRouter initialEntries={["/seller"]}>
        <Sidebar groups={SELLER_NAV_GROUPS} role="seller" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Dashboard/ })).toHaveAttribute("href", "/seller");
    expect(screen.getByRole("link", { name: /My offers/ })).toHaveAttribute("href", "/seller/offers");
    expect(screen.getByRole("link", { name: /Earnings/ })).toHaveAttribute("href", "/seller/earnings");
    expect(screen.getByText("Seller One")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Optimization/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Transactions/ })).not.toBeInTheDocument();
  });
});
