import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuyerMarketplacePage } from "./BuyerMarketplacePage";
import { ApiError } from "../../api/client";
import type { EnergyOffer, PurchaseOrder } from "../../types/api";

const queries = vi.hoisted(() => ({
  useMarketOffers: vi.fn(),
}));
const actions = vi.hoisted(() => ({
  purchase: {
    mutateAsync: vi.fn(),
  },
}));

vi.mock("../../hooks/queries", () => ({
  useMarketOffers: queries.useMarketOffers,
}));
vi.mock("../../hooks/useAccountActions", () => ({
  useBuyerMutations: () => actions,
}));

const offer: EnergyOffer = {
  id: 11,
  seller_user_id: 2,
  seller_display_name: "Ravi's rooftop",
  location_name: "Perur, Coimbatore",
  quantity_kwh: 5,
  remaining_kwh: 2.5,
  sold_kwh: 2.5,
  price_inr_kwh: 5.5,
  estimated_total_inr: 13.75,
  status: "active",
  note: "Midday surplus",
  created_at: "2026-10-26T08:00:00Z",
};

const order: PurchaseOrder = {
  id: 21,
  offer_id: 11,
  buyer_user_id: 3,
  seller_user_id: 2,
  buyer_display_name: "You",
  seller_display_name: "Ravi's rooftop",
  quantity_kwh: 1.5,
  price_inr_kwh: 5.5,
  total_value_inr: 8.25,
  status: "completed",
  transaction_id: 7,
  created_at: "2026-10-26T08:30:00Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("buyer marketplace", () => {
  it("renders an accessible empty state when no offers exist", () => {
    queries.useMarketOffers.mockReturnValue({
      data: { items: [], count: 0 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    render(<BuyerMarketplacePage />);
    expect(screen.getByText("The marketplace is empty")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Refresh" }).length).toBeGreaterThan(0);
  });

  it("surfaces an API failure with a retry action", () => {
    queries.useMarketOffers.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(500, "Marketplace exploded", "/market/offers"),
      isFetching: false,
      refetch: vi.fn(),
    });
    render(<BuyerMarketplacePage />);
    expect(screen.getByText("Marketplace exploded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("requires explicit confirmation and sends only offer id plus quantity", async () => {
    queries.useMarketOffers.mockReturnValue({
      data: { items: [offer], count: 1 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    actions.purchase.mutateAsync.mockResolvedValue(order);
    const user = userEvent.setup();
    render(<BuyerMarketplacePage />);

    expect(screen.getByText("₹13.75")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Buy energy" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm energy purchase" });
    const quantity = within(dialog).getByLabelText("Quantity to purchase (kWh)");
    await user.clear(quantity);
    await user.type(quantity, "1.5");
    await user.click(within(dialog).getByRole("button", { name: "Confirm purchase" }));

    await waitFor(() =>
      expect(actions.purchase.mutateAsync).toHaveBeenCalledWith({ offer_id: 11, quantity_kwh: 1.5 }),
    );
    expect(await screen.findByText(/Purchased 1.5 kWh from Ravi's rooftop/)).toBeInTheDocument();
    expect(actions.purchase.mutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("price_inr_kwh");
  });
});
