import { request } from "./client";
import type { SettingsPage, SettingsPatch } from "../types/api";

export const settingsApi = {
  get: () => request<SettingsPage>("/settings"),
  update: (patch: SettingsPatch) =>
    request<SettingsPage>("/settings", {
      method: "PATCH",
      body: patch,
      timeoutMs: 60_000,
    }),
};
