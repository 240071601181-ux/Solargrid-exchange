import { request } from "./client";
import type { Household, HouseholdDetail } from "../types/api";

export const householdApi = {
  list: () => request<Household[]>("/households"),
  detail: (id: string) => request<HouseholdDetail>(`/households/${encodeURIComponent(id)}`),
};
