import { request } from "./client";
import type { EnergyOffer, OfferList } from "../types/api";

export interface MarketOfferFilters {
  q?: string;
  max_price?: number;
  min_quantity?: number;
  sort?: "price_asc" | "price_desc" | "quantity_desc" | "newest";
  limit?: number;
}

export const marketApi = {
  offers: (filters: MarketOfferFilters = {}) =>
    request<OfferList>("/market/offers", {
      query: filters as Record<string, string | number | boolean | null | undefined>,
    }),
  offer: (id: number) => request<EnergyOffer>(`/market/offers/${id}`),
};
