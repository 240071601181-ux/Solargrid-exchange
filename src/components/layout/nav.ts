import {
  Activity,
  BarChart3,
  BatteryCharging,
  ChartNoAxesCombined,
  ClipboardList,
  Gauge,
  HandCoins,
  Home,
  IndianRupee,
  LayoutDashboard,
  Network,
  ReceiptText,
  Scale,
  Settings,
  ShoppingBag,
  Store,
  SunMedium,
  TrendingUp,
  WalletCards,
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

export const SELLER_NAV_GROUPS: NavGroup[] = [
  {
    label: "Seller workspace",
    items: [
      { label: "Dashboard", to: "/seller", icon: LayoutDashboard, end: true },
      { label: "My solar", to: "/seller/solar", icon: SunMedium },
      { label: "My offers", to: "/seller/offers", icon: ClipboardList },
      { label: "Marketplace", to: "/seller/marketplace", icon: Store },
    ],
  },
  {
    label: "Performance",
    items: [
      { label: "Sales", to: "/seller/sales", icon: ReceiptText },
      { label: "Earnings", to: "/seller/earnings", icon: IndianRupee },
      { label: "Forecasting", to: "/seller/forecasting", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Profile & settings", to: "/seller/settings", icon: Settings }],
  },
];

export const BUYER_NAV_GROUPS: NavGroup[] = [
  {
    label: "Buyer workspace",
    items: [
      { label: "Dashboard", to: "/buyer", icon: LayoutDashboard, end: true },
      { label: "Marketplace", to: "/buyer/marketplace", icon: Store },
      { label: "Purchases", to: "/buyer/purchases", icon: ShoppingBag },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Usage", to: "/buyer/usage", icon: BatteryCharging },
      { label: "Price outlook", to: "/buyer/prices", icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Profile & settings", to: "/buyer/settings", icon: Settings }],
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
  { path: "/seller", title: "Seller dashboard", icon: Home },
  { path: "/seller/solar", title: "My solar system", icon: SunMedium },
  { path: "/seller/offers", title: "My offers", icon: ClipboardList },
  { path: "/seller/marketplace", title: "Marketplace demand", icon: Store },
  { path: "/seller/sales", title: "My sales", icon: ReceiptText },
  { path: "/seller/earnings", title: "Earnings", icon: HandCoins },
  { path: "/seller/forecasting", title: "Forecasting", icon: ChartNoAxesCombined },
  { path: "/seller/settings", title: "Seller profile & settings", icon: Settings },
  { path: "/buyer", title: "Buyer dashboard", icon: Home },
  { path: "/buyer/marketplace", title: "Browse energy offers", icon: Store },
  { path: "/buyer/purchases", title: "My purchases", icon: ShoppingBag },
  { path: "/buyer/usage", title: "Usage & demand", icon: BatteryCharging },
  { path: "/buyer/prices", title: "Price outlook", icon: BarChart3 },
  { path: "/buyer/settings", title: "Buyer profile & settings", icon: Settings },
];

export function navGroupsForRole(role: "admin" | "seller" | "buyer"): NavGroup[] {
  if (role === "seller") return SELLER_NAV_GROUPS;
  if (role === "buyer") return BUYER_NAV_GROUPS;
  return NAV_GROUPS;
}

export function roleLabel(role: "admin" | "seller" | "buyer"): string {
  if (role === "seller") return "Seller workspace";
  if (role === "buyer") return "Buyer workspace";
  return "P2P microgrid control";
}

export function metaForPath(pathname: string): { title: string; icon: LucideIcon } | undefined {
  const matches = PAGE_META.filter((item) =>
    item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  return matches.sort((a, b) => b.path.length - a.path.length)[0];
}

export const PRODUCT_ICON = SunMedium;
export const LIVE_ICON = Activity;
export const SPEND_ICON = WalletCards;
