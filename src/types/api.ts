export type WeatherFreshness = "live" | "stale" | "expired" | "unavailable";
export type SimulationStatus = "idle" | "running" | "paused" | "error";
export type HouseholdStatus = "seller" | "buyer" | "balanced" | "unavailable";
export type TradeStatus = "proposed" | "executed" | "failed";
export type StrategyName = "static" | "dynamic";

export interface WeatherCurrent {
  provider: string;
  transport: string;
  mcp_server: string;
  status: WeatherFreshness;
  age_seconds: number | null;
  retrieved_at: string | null;
  observed_at: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  cloud_cover_pct: number | null;
  wind_speed_ms: number | null;
  irradiance_w_m2: number | null;
  is_day: boolean | null;
  last_error: string | null;
  last_attempt_at: string | null;
  cache_ttl_seconds: number;
  note: string;
}

export interface WeatherStatus {
  provider: string;
  transport: string;
  mcp_server: string;
  enabled: boolean;
  status: WeatherFreshness;
  age_seconds: number | null;
  last_retrieved_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  cache_ttl_seconds: number;
}

export interface Household {
  id: string;
  name: string;
  role_hint: string;
  solar_capacity_kw: number;
  generation_kw: number | null;
  demand_kw: number | null;
  net_power_kw: number | null;
  surplus_kw: number | null;
  deficit_kw: number | null;
  available_selling_kw: number | null;
  requested_buying_kw: number | null;
  unmet_demand_kw: number | null;
  served_kw: number | null;
  battery_capacity_kwh: number;
  battery_soc_kwh: number;
  battery_soc_pct: number | null;
  reservation_price_inr_kwh: number;
  status: HouseholdStatus;
  withheld_kw: number | null;
}

export interface HouseholdDetail extends Household {
  recent_transactions: Transaction[];
  assumptions: string[];
}

export interface AllocationItem {
  id: number;
  seller_id: string;
  seller_name: string;
  buyer_id: string;
  buyer_name: string;
  power_kw: number;
  energy_kwh: number;
  value_inr: number;
}

export interface Allocation {
  id: number;
  tick: number;
  status: TradeStatus;
  algorithm: string;
  objective_value: number;
  execution_ms: number;
  total_supply_kw: number;
  total_demand_kw: number;
  allocated_kw: number;
  unmet_kw: number;
  unallocated_kw: number;
  price_inr_kwh: number;
  interval_seconds: number;
  notes: string;
  created_at: string | null;
  executed_at: string | null;
  items: AllocationItem[];
}

export interface Pricing {
  price_inr_kwh: number;
  base_price_inr_kwh: number;
  min_price_inr_kwh: number;
  max_price_inr_kwh: number;
  imbalance: number;
  supply_kw: number;
  demand_kw: number;
  reason: string;
  sensitivity: number;
  smoothing: number;
}

export interface Transaction {
  id: number;
  run_id: number;
  seller_id: string;
  seller_name: string;
  buyer_id: string;
  buyer_name: string;
  power_kw: number;
  interval_seconds?: number | null;
  energy_kwh: number;
  price_inr_kwh: number;
  total_value_inr: number;
  status: string;
  source?: string;
  created_at?: string | null;
  executed_at?: string | null;
}

export interface TransactionDetail extends Transaction {
  allocated_power_kw: number;
  energy_formula: string;
  settlement: string;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SimulationState {
  status: SimulationStatus;
  tick: number;
  seq: number;
  simulated_at: string | null;
  cloud_scenario_pct: number;
  scenario_label: string;
  last_error: string | null;
  tick_seconds: number;
  interval_seconds: number;
  auto_execute_trades: boolean;
}

export interface Totals {
  generation_kw: number | null;
  demand_kw: number | null;
  surplus_kw: number | null;
  deficit_kw: number | null;
  offered_supply_kw: number | null;
  allocated_kw: number | null;
  unmet_kw: number | null;
  unallocated_kw: number | null;
  energy_traded_kwh: number;
  tick_energy_traded_kwh: number | null;
  price_inr_kwh: number | null;
  base_price_inr_kwh: number;
  min_price_inr_kwh: number;
  max_price_inr_kwh: number;
  imbalance: number | null;
  pricing_reason: string | null;
  active_households: number;
  active_transactions: number;
  cloud_cover_pct: number | null;
  irradiance_w_m2: number | null;
  effective_irradiance_w_m2: number | null;
}

export interface HistoryPoint {
  tick: number;
  simulated_at: string | null;
  generation_kw: number;
  demand_kw: number;
  surplus_kw: number;
  deficit_kw: number;
  allocated_kw: number;
  unmet_kw: number;
  unallocated_kw: number;
  energy_traded_kwh: number;
  price_inr_kwh: number;
  base_price_inr_kwh: number;
  imbalance: number;
  cloud_cover_pct: number | null;
  irradiance_w_m2: number | null;
  effective_irradiance_w_m2: number | null;
  scenario_label: string;
}

export interface SimulationSnapshot {
  state: SimulationState;
  weather: WeatherCurrent | null;
  totals: Totals;
  pricing: Pricing;
  households: Household[];
  allocation: Allocation | null;
  recent_transactions: Transaction[];
  history: HistoryPoint[];
}

export interface ForecastPoint {
  timestamp: string;
  kind: "predicted";
  generation_kw: number | null;
  demand_kw: number | null;
  imbalance_kw: number | null;
  irradiance_w_m2: number | null;
  cloud_cover_pct: number | null;
  temperature_c: number | null;
  wind_speed_ms: number | null;
  demand_basis: string | null;
  base_price_inr_kwh: number | null;
}

export interface ForecastObserved {
  tick: number;
  simulated_at: string | null;
  generation_kw: number;
  demand_kw: number;
  price_inr_kwh: number;
  kind: "simulated_current";
}

export interface Forecast {
  generated_at: string | null;
  provider: string;
  transport: string;
  mcp_server: string;
  model: string;
  model_version: string;
  model_status: string;
  freshness: WeatherFreshness;
  horizon_hours: number;
  error: string | null;
  observed: ForecastObserved | null;
  assumptions: string[];
  series: ForecastPoint[];
}

export interface EvaluationMetrics {
  strategy: StrategyName;
  energy_traded_kwh: number;
  unmet_demand_kwh: number;
  unmet_demand_peak_kw: number;
  demand_served_pct: number | null;
  renewable_utilization_pct: number | null;
  surplus_remaining_kwh: number;
  total_generation_kwh: number;
  total_demand_kwh: number;
  price_volatility_inr_kwh: number;
  average_price_inr_kwh: number | null;
  average_transaction_price_inr_kwh: number | null;
  min_price_inr_kwh: number | null;
  max_price_inr_kwh: number | null;
  allocation_avg_execution_ms: number;
  transaction_count: number;
  ticks: number;
}

export interface EvaluationStrategySeries {
  strategy: StrategyName;
  metrics: EvaluationMetrics;
  series: EvaluationPoint[];
}

export interface EvaluationPoint {
  timestamp: string | null;
  tick: number;
  generation_kw: number;
  demand_kw: number;
  physical_surplus_kw: number;
  physical_deficit_kw: number;
  price_inr_kwh: number;
  imbalance: number;
  allocated_kw: number;
  unmet_kw: number;
  surplus_remaining_kw: number;
  energy_traded_kwh: number;
  irradiance_w_m2: number | null;
}

export interface EvaluationComparison {
  unmet_demand_reduction_kwh: number;
  unmet_demand_reduction_pct: number | null;
  energy_traded_change_kwh: number;
  energy_traded_change_pct: number | null;
  utilization_change_pp: number | null;
  price_volatility_change: number;
  average_price_change_inr_kwh: number | null;
}

export interface EvaluationResult {
  id: number;
  created_at: string | null;
  ticks: number;
  interval_seconds: number;
  scenario_cloud_pct: number;
  weather_snapshot_id: number | null;
  replay_start: string | null;
  static: EvaluationMetrics;
  dynamic: EvaluationMetrics;
  comparison: EvaluationComparison;
  series: EvaluationStrategySeries[];
  notes: string;
  methodology: string[];
}

export interface SettingsValues {
  base_price_inr_kwh: number;
  min_price_inr_kwh: number;
  max_price_inr_kwh: number;
  price_sensitivity: number;
  price_smoothing: number;
  forecast_horizon_hours: number;
  tick_seconds: number;
  interval_seconds: number;
  auto_execute_trades: boolean;
  latitude: number;
  longitude: number;
  location_name: string;
  updated_at: string | null;
}

export interface DataSource {
  name: string;
  kind: string;
  provider: string;
  identity: string;
  status: string;
  last_retrieved_at: string | null;
  error: string | null;
}

export interface SettingsPage {
  settings: SettingsValues;
  weather: WeatherStatus;
  backend: Record<string, string>;
  data_sources: DataSource[];
  supported: Record<string, boolean>;
}

export interface SettingsPatch {
  base_price_inr_kwh?: number;
  min_price_inr_kwh?: number;
  max_price_inr_kwh?: number;
  price_sensitivity?: number;
  price_smoothing?: number;
  forecast_horizon_hours?: number;
  tick_seconds?: number;
  interval_seconds?: number;
  auto_execute_trades?: boolean;
  latitude?: number;
  longitude?: number;
  location_name?: string;
}

export interface Health {
  status: string;
  service: string;
  version: string;
  database: string;
  environment: string;
  timestamp: string;
  weather: WeatherStatus;
}

export interface ExecutionResult {
  allocation: Allocation;
  transactions: Transaction[];
  message: string;
}

export interface ServerEvent {
  type: string;
  seq: number;
  data?: Record<string, unknown>;
}

export type AuthRole = "admin" | "seller" | "buyer";
export type AccountRole = "seller" | "buyer";
export type OfferStatus = "active" | "paused" | "cancelled" | "exhausted";

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  role: AuthRole;
  status: string;
  created_at?: string | null;
}

export interface AuthResponse {
  user: AuthUser;
  csrf_token: string;
}

export interface SessionResponse {
  user: AuthUser | null;
  csrf_token: string;
}

export interface SellerProfile {
  user_id: number;
  display_name: string;
  location_name: string;
  latitude: number;
  longitude: number;
  solar_capacity_kw: number;
  has_battery: boolean;
  battery_capacity_kwh: number;
  household_category: string;
  demand_base_kw: number;
  household_id: string;
  updated_at?: string | null;
}

export interface BuyerProfile {
  user_id: number;
  display_name: string;
  location_name: string;
  latitude: number;
  longitude: number;
  household_category: string;
  demand_base_kw: number;
  household_id: string;
  updated_at?: string | null;
}

export interface ProfilePatch {
  display_name?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  solar_capacity_kw?: number;
  has_battery?: boolean;
  battery_capacity_kwh?: number;
  household_category?: string;
  demand_base_kw?: number;
}

export interface EnergyOffer {
  id: number;
  seller_user_id: number;
  seller_display_name: string;
  location_name: string;
  quantity_kwh: number;
  remaining_kwh: number;
  sold_kwh: number;
  price_inr_kwh: number;
  estimated_total_inr: number;
  status: OfferStatus;
  note: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface OfferList {
  items: EnergyOffer[];
  count: number;
}

export interface OfferAvailability {
  available_to_offer_kwh: number;
  daily_surplus_kwh: number;
  reserved_offer_kwh: number;
  forecast_freshness: string;
  has_forecast: boolean;
}

export interface OfferCreate {
  quantity_kwh: number;
  price_inr_kwh: number;
  note?: string;
}

export interface OfferUpdate {
  quantity_kwh?: number;
  price_inr_kwh?: number;
  note?: string;
}

export interface PurchaseOrder {
  id: number;
  offer_id: number;
  buyer_user_id: number;
  seller_user_id: number;
  buyer_display_name: string;
  seller_display_name: string;
  quantity_kwh: number;
  price_inr_kwh: number;
  total_value_inr: number;
  status: string;
  offer_status?: string | null;
  transaction_id?: number | null;
  created_at?: string | null;
}

export interface PurchaseList {
  items: PurchaseOrder[];
  count: number;
}

export interface PurchaseCreate {
  offer_id: number;
  quantity_kwh: number;
}

export interface MarketDemand {
  registered_buyers: number;
  total_baseline_demand_kw: number;
  active_offers: number;
  privacy_note: string;
}

export interface Earnings {
  energy_sold_kwh: number;
  simulated_sales_value_inr: number;
  average_realized_price_inr_kwh: number | null;
  completed_sales: number;
  recent_sales: PurchaseOrder[];
  daily_series: Array<{ date: string; energy_kwh: number; value_inr: number; sales: number }>;
}

export interface Spending {
  energy_purchased_kwh: number;
  simulated_spend_inr: number;
  average_purchase_price_inr_kwh: number | null;
  completed_purchases: number;
  recent_purchases: PurchaseOrder[];
  daily_series: Array<{ date: string; energy_kwh: number; value_inr: number; purchases: number }>;
}

export interface AccountForecastPoint {
  timestamp: string;
  kind: string;
  generation_kw: number;
  demand_kw: number;
  imbalance_kw: number;
  irradiance_w_m2: number | null;
  cloud_cover_pct: number | null;
  temperature_c: number | null;
  demand_basis: string;
}

export interface AccountEnergy {
  household: {
    id: string;
    display_name: string;
    category: string;
    solar_capacity_kw: number;
    has_battery: boolean;
    battery_capacity_kwh: number;
    battery_soc_kwh: number;
    battery_soc_pct: number | null;
    location_name: string;
    demand_base_kw: number;
  };
  current: {
    generation_kw: number | null;
    demand_kw: number | null;
    net_kw: number;
    surplus_kw: number;
    deficit_kw: number;
    estimated_at: string;
  };
  daily: {
    generation_kwh: number;
    demand_kwh: number;
    surplus_kwh: number;
    deficit_kwh: number;
    reserved_offer_kwh: number;
    available_to_offer_kwh: number;
  };
  forecast: {
    provider: string;
    transport: string;
    mcp_server: string;
    freshness: string;
    generated_at: string | null;
    error: string | null;
    horizon_hours: number;
    series: AccountForecastPoint[];
  };
  weather: WeatherCurrent | null;
  weather_error: string | null;
  assumptions: string[];
}

export interface SellerDashboard {
  profile: SellerProfile;
  energy: AccountEnergy;
  offers: EnergyOffer[];
  today: {
    energy_sold_today_kwh: number;
    simulated_value_today_inr: number;
    sales_today: number;
  };
  earnings: Earnings;
  market_demand: MarketDemand;
  pricing: Pricing;
  assumptions: string[];
}

export interface BuyerDashboard {
  profile: BuyerProfile;
  energy: AccountEnergy;
  available_offers: EnergyOffer[];
  spending: Spending;
  pricing: Pricing;
  assumptions: string[];
}

export interface BuyerUsage {
  profile: BuyerProfile;
  energy: AccountEnergy;
  spending: Spending;
}

export interface BuyerPricePoint {
  timestamp: string;
  generation_kw: number;
  demand_kw: number;
  price_inr_kwh: number;
  cloud_cover_pct: number | null;
  irradiance_w_m2: number | null;
  demand_basis: string | null;
}

export interface BuyerPrices {
  current: Pricing;
  history: Array<{
    tick: number;
    simulated_at: string;
    price_inr_kwh: number;
    base_price_inr_kwh: number;
    imbalance: number;
    supply_kw: number;
    demand_kw: number;
    cloud_cover_pct: number | null;
    irradiance_w_m2: number | null;
    reason: string;
  }>;
  forecast: BuyerPricePoint[];
  weather: WeatherCurrent | null;
  freshness: string;
  assumptions: string[];
}

export interface SharedStatus {
  state: SimulationState;
  weather: WeatherCurrent | null;
  pricing: Pricing;
  shared_note: string;
}
