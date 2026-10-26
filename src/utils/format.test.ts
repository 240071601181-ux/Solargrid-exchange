import { describe, expect, it } from "vitest";
import {
  DASH,
  formatAge,
  formatDateTime,
  formatInr,
  formatInteger,
  formatIrradiance,
  formatNumber,
  formatPct,
  formatPrice,
  formatSigned,
  formatTime,
  relativeToTick,
  titleCase,
  truncate,
} from "../utils/format";

describe("format utilities", () => {
  it("renders a dash for missing or invalid numbers", () => {
    expect(formatNumber(null)).toBe(DASH);
    expect(formatNumber(undefined)).toBe(DASH);
    expect(formatNumber(Number.NaN)).toBe(DASH);
    expect(formatInteger(null)).toBe(DASH);
    expect(formatSigned(null, "kW")).toBe(DASH);
  });

  it("formats numbers and currencies with Indian grouping", () => {
    expect(formatNumber(1234.567, 2)).toBe("1,234.57");
    expect(formatNumber(0.125, 3)).toBe("0.125");
    expect(formatInr(1234.5)).toBe("₹1,234.5");
    expect(formatPrice(7.25)).toBe("₹7.25");
    expect(formatInteger(12345)).toBe("12,345");
  });

  it("formats percentages and signed values without inventing a sign", () => {
    expect(formatPct(42.126, 1)).toBe("42.1%");
    expect(formatPct(null)).toBe(DASH);
    expect(formatSigned(1.2, "kW")).toBe("+1.2 kW");
    expect(formatSigned(-1.2, "kW")).toBe("-1.2 kW");
    expect(formatSigned(0, "kW")).toBe("0 kW");
  });

  it("formats irradiance with units", () => {
    expect(formatIrradiance(812.4)).toBe("812 W/m²");
    expect(formatIrradiance(null)).toBe(DASH);
  });

  it("formats ages at every documented boundary", () => {
    expect(formatAge(null)).toBe("no data");
    expect(formatAge(3)).toBe("just now");
    expect(formatAge(45)).toBe("45s ago");
    expect(formatAge(120)).toBe("2m ago");
    expect(formatAge(7_200)).toBe("2h ago");
    expect(formatAge(172_800)).toBe("2d ago");
  });

  it("formats IST timestamps and rejects invalid input", () => {
    expect(formatTime("2026-10-26T00:00:00Z")).toBe("05:30");
    expect(formatTime("not-a-date")).toBe(DASH);
    expect(formatDateTime("2026-10-26T00:00:00Z")).toContain("26 Oct");
    expect(formatDateTime("2026-10-26T00:00:00Z")).toContain("IST");
    expect(formatDateTime(null)).toBe(DASH);
  });

  it("formats relative tick times", () => {
    const now = Date.parse("2026-10-26T00:01:00Z");
    expect(relativeToTick(null, now)).toBe("awaiting tick");
    expect(relativeToTick("2026-10-26T00:00:30Z", now)).toBe("30s ago");
    expect(relativeToTick("2025-10-26T00:00:00Z", now)).toMatch(/m ago$/);
  });

  it("normalizes labels and truncates long strings", () => {
    expect(titleCase("auto_execute-trades")).toBe("Auto Execute Trades");
    expect(truncate("short", 10)).toBe("short");
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
});
