import { request } from "./client";
import type {
  AccountEnergy,
  Earnings,
  EnergyOffer,
  MarketDemand,
  OfferAvailability,
  OfferCreate,
  OfferList,
  OfferUpdate,
  ProfilePatch,
  PurchaseList,
  SellerDashboard,
  SellerProfile,
} from "../types/api";

export const sellerApi = {
  dashboard: () => request<SellerDashboard>("/seller/dashboard", { timeoutMs: 90_000 }),
  profile: () => request<SellerProfile>("/seller/profile"),
  updateProfile: (payload: ProfilePatch) =>
    request<SellerProfile>("/seller/profile", { method: "PATCH", body: payload }),
  solar: () => request<AccountEnergy>("/seller/solar", { timeoutMs: 90_000 }),
  forecast: () => request<AccountEnergy>("/seller/forecast", { timeoutMs: 90_000 }),
  offers: () => request<OfferList>("/seller/offers"),
  availability: () => request<OfferAvailability>("/seller/offers/availability", { timeoutMs: 90_000 }),
  offer: (id: number) => request<EnergyOffer>(`/seller/offers/${id}`),
  createOffer: (payload: OfferCreate) =>
    request<EnergyOffer>("/seller/offers", { method: "POST", body: payload, timeoutMs: 90_000 }),
  updateOffer: (id: number, payload: OfferUpdate) =>
    request<EnergyOffer>(`/seller/offers/${id}`, { method: "PATCH", body: payload, timeoutMs: 90_000 }),
  pauseOffer: (id: number) =>
    request<EnergyOffer>(`/seller/offers/${id}/pause`, { method: "POST" }),
  resumeOffer: (id: number) =>
    request<EnergyOffer>(`/seller/offers/${id}/resume`, { method: "POST" }),
  cancelOffer: (id: number) =>
    request<EnergyOffer>(`/seller/offers/${id}/cancel`, { method: "POST" }),
  sales: () => request<PurchaseList>("/seller/sales"),
  earnings: () => request<Earnings>("/seller/earnings"),
  marketDemand: () => request<MarketDemand>("/seller/market-demand"),
};
