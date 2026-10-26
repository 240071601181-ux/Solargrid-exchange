import { request } from "./client";
import type {
  AccountEnergy,
  BuyerDashboard,
  BuyerPrices,
  BuyerProfile,
  BuyerUsage,
  ProfilePatch,
  PurchaseCreate,
  PurchaseList,
  PurchaseOrder,
  Spending,
} from "../types/api";

export const buyerApi = {
  dashboard: () => request<BuyerDashboard>("/buyer/dashboard", { timeoutMs: 90_000 }),
  profile: () => request<BuyerProfile>("/buyer/profile"),
  updateProfile: (payload: ProfilePatch) =>
    request<BuyerProfile>("/buyer/profile", { method: "PATCH", body: payload }),
  usage: () => request<BuyerUsage>("/buyer/usage", { timeoutMs: 90_000 }),
  purchases: () => request<PurchaseList>("/buyer/purchases"),
  createPurchase: (payload: PurchaseCreate) =>
    request<PurchaseOrder>("/buyer/purchases", { method: "POST", body: payload }),
  spending: () => request<Spending>("/buyer/spending"),
  prices: () => request<BuyerPrices>("/buyer/prices", { timeoutMs: 90_000 }),
  solar: () => request<AccountEnergy>("/buyer/usage", { timeoutMs: 90_000 }),
};
