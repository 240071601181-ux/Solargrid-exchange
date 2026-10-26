import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerOffersPage } from "./SellerOffersPage";
import type { EnergyOffer } from "../../types/api";

const queries = vi.hoisted(() => ({
  useSellerOffers: vi.fn(),
  useSellerAvailability: vi.fn(),
}));
const mutations = vi.hoisted(() => ({
  createOffer: { mutateAsync: vi.fn(), isPending: false },
  updateOffer: { mutateAsync: vi.fn(), isPending: false },
  pauseOffer: { mutateAsync: vi.fn(), isPending: false },
  resumeOffer: { mutateAsync: vi.fn(), isPending: false },
  cancelOffer: { mutateAsync: vi.fn(), isPending: false },
  updateProfile: { mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("../../hooks/queries", () => ({
  useSellerOffers: queries.useSellerOffers,
  useSellerAvailability: queries.useSellerAvailability,
}));
vi.mock("../../hooks/useAccountActions", () => ({
  useSellerMutations: () => mutations,
}));

const offer: EnergyOffer = {
  id: 11,
  seller_user_id: 2,
  seller_display_name: "Seller One",
  location_name: "Perur, Coimbatore",
  quantity_kwh: 5,
  remaining_kwh: 3.5,
  sold_kwh: 1.5,
  price_inr_kwh: 5.25,
  estimated_total_inr: 18.375,
  status: "active",
  note: "Rooftop surplus",
  created_at: "2026-10-26T08:00:00Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("seller offers", () => {
  it("requires confirmation before cancelling an offer", async () => {
    queries.useSellerOffers.mockReturnValue({
      data: { items: [offer], count: 1 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    queries.useSellerAvailability.mockReturnValue({
      data: {
        available_to_offer_kwh: 2.5,
        daily_surplus_kwh: 8,
        reserved_offer_kwh: 3.5,
        forecast_freshness: "live",
        has_forecast: true,
      },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mutations.cancelOffer.mutateAsync.mockResolvedValue({ ...offer, status: "cancelled" });
    const user = userEvent.setup();
    render(<SellerOffersPage />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel offer #11?" });
    expect(within(dialog).getByText(/3.5 kWh/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel offer" }));

    await waitFor(() => expect(mutations.cancelOffer.mutateAsync).toHaveBeenCalledWith(11));
  });

  it("disables new offers when no availability estimate is returned", () => {
    queries.useSellerOffers.mockReturnValue({
      data: { items: [], count: 0 },
      isPending: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    queries.useSellerAvailability.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error("forecast unavailable"),
      isFetching: false,
      refetch: vi.fn(),
    });
    render(<SellerOffersPage />);
    expect(screen.getByRole("button", { name: "New offer" })).toBeDisabled();
    expect(screen.getByText(/Availability could not be loaded/)).toBeInTheDocument();
  });
});
