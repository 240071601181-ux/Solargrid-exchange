import { request } from "./client";
import type { SharedStatus } from "../types/api";

export const sharedApi = {
  status: () => request<SharedStatus>("/shared/status", { timeoutMs: 45_000 }),
};
