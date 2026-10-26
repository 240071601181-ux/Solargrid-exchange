import { request } from "./client";
import type { AuthResponse, SessionResponse } from "../types/api";

export const authApi = {
  session: () =>
    request<SessionResponse>("/auth/session", {
      suppressAuthEvent: true,
      timeoutMs: 20_000,
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      suppressAuthEvent: true,
    }),
  register: (payload: Record<string, unknown>) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: payload,
      suppressAuthEvent: true,
    }),
  logout: () =>
    request<void>("/auth/logout", {
      method: "POST",
      suppressAuthEvent: true,
    }),
};
