import {
  Activity,
  ChartNoAxesCombined,
  Gauge,
  LayoutDashboard,
  Network,
  ReceiptText,
  Scale,
  Settings,
  Store,
  SunMedium,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Overview", to: "/", icon: LayoutDashboard, end: true },
      { label: "Microgrid", to: "/microgrid", icon: Network },
      { label: "Marketplace", to: "/marketplace", icon: Store },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Forecasting", to: "/forecasting", icon: TrendingUp },
      { label: "Optimization", to: "/optimization", icon: Gauge },
      { label: "Evaluation", to: "/evaluation", icon: Scale },
    ],
  },
  {
    label: "Records",
    items: [
      { label: "Transactions", to: "/transactions", icon: ReceiptText },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

export const PAGE_META: Array<{ path: string; title: string; icon: LucideIcon }> = [
  { path: "/", title: "Microgrid overview", icon: LayoutDashboard },
  { path: "/microgrid", title: "Microgrid network", icon: Network },
  { path: "/marketplace", title: "Energy marketplace", icon: Store },
  { path: "/forecasting", title: "Forecasting", icon: ChartNoAxesCombined },
  { path: "/optimization", title: "Allocation optimization", icon: Gauge },
  { path: "/evaluation", title: "Pricing evaluation", icon: Scale },
  { path: "/transactions", title: "Transactions", icon: ReceiptText },
  { path: "/settings", title: "Settings", icon: Settings },
  { path: "/households", title: "Households", icon: SunMedium },
];

export const PRODUCT_ICON = SunMedium;
export const LIVE_ICON = Activity;
