const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const preciseFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 3,
  minimumFractionDigits: 0,
});

export const DASH = "—";

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return DASH;
  if (digits > 2) return preciseFormatter.format(value);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatKw(value: number | null | undefined, digits = 2): string {
  return `${formatNumber(value, digits)}`;
}

export function formatKwh(value: number | null | undefined, digits = 3): string {
  return `${formatNumber(value, digits)}`;
}

export function formatPrice(value: number | null | undefined): string {
  return `₹${formatNumber(value, 2)}`;
}

export function formatInr(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return DASH;
  return `₹${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)}`;
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return DASH;
  return `${formatNumber(value, digits)}%`;
}

export function formatSigned(value: number | null | undefined, unit: string, digits = 2): string {
  if (value === null || value === undefined) return DASH;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value, digits)} ${unit}`.trim();
}

export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});

const dayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export function formatTime(value: string | null | undefined): string {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return timeFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return `${dateTimeFormatter.format(date)} IST`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return dayFormatter.format(date);
}

export function formatAge(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "no data";
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

export function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function relativeToTick(timestamp: string | null, now: number): string {
  if (!timestamp) return "awaiting tick";
  const delta = Math.max(0, now - new Date(timestamp).getTime());
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export function formatIrradiance(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return `${formatNumber(value, 0)} W/m²`;
}

export function formatPowerDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return `${formatNumber(value, 2)} kW`;
}

export function truncate(value: string, length = 26): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export { numberFormatter };
