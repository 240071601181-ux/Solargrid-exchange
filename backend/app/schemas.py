from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator


class WeatherCurrentOut(BaseModel):
    provider: str
    transport: str
    mcp_server: str
    status: Literal["live", "stale", "expired", "unavailable"]
    age_seconds: int | None = None
    retrieved_at: datetime | None = None
    observed_at: datetime | None = None
    location_name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    temperature_c: float | None = None
    humidity_pct: float | None = None
    cloud_cover_pct: float | None = None
    wind_speed_ms: float | None = None
    irradiance_w_m2: float | None = None
    is_day: bool | None = None
    last_error: str | None = None
    last_attempt_at: datetime | None = None
    cache_ttl_seconds: int
    note: str = ""


class WeatherStatusOut(BaseModel):
    provider: str
    transport: str
    mcp_server: str
    enabled: bool
    status: str
    age_seconds: int | None
    last_retrieved_at: datetime | None
    last_attempt_at: datetime | None
    last_error: str | None
    cache_ttl_seconds: int


class ForecastPointOut(BaseModel):
    timestamp: str
    kind: str = "predicted"
    generation_kw: float | None = None
    demand_kw: float | None = None
    imbalance_kw: float | None = None
    irradiance_w_m2: float | None = None
    cloud_cover_pct: float | None = None
    temperature_c: float | None = None
    wind_speed_ms: float | None = None
    demand_basis: str | None = None
    base_price_inr_kwh: float | None = None


class ForecastOut(BaseModel):
    generated_at: datetime | None
    provider: str
    transport: str
    mcp_server: str
    model: str
    model_version: str
    model_status: str
    freshness: str
    horizon_hours: int
    error: str | None = None
    observed: dict[str, Any] | None = None
    assumptions: list[str] = Field(default_factory=list)
    series: list[ForecastPointOut] = Field(default_factory=list)


class HouseholdOut(BaseModel):
    id: str
    name: str
    role_hint: str
    solar_capacity_kw: float
    generation_kw: float | None
    demand_kw: float | None
    net_power_kw: float | None
    surplus_kw: float | None
    deficit_kw: float | None
    available_selling_kw: float | None
    requested_buying_kw: float | None
    unmet_demand_kw: float | None
    served_kw: float | None
    battery_capacity_kwh: float
    battery_soc_kwh: float
    battery_soc_pct: float | None
    reservation_price_inr_kwh: float
    status: str
    withheld_kw: float | None


class HouseholdDetailOut(HouseholdOut):
    recent_transactions: list[dict[str, Any]] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)


class AllocationItemOut(BaseModel):
    id: int
    seller_id: str
    seller_name: str
    buyer_id: str
    buyer_name: str
    power_kw: float
    energy_kwh: float
    value_inr: float


class AllocationOut(BaseModel):
    id: int
    tick: int
    status: str
    algorithm: str
    objective_value: float
    execution_ms: float
    total_supply_kw: float
    total_demand_kw: float
    allocated_kw: float
    unmet_kw: float
    unallocated_kw: float
    price_inr_kwh: float
    interval_seconds: int
    notes: str
    created_at: datetime | None
    executed_at: datetime | None
    items: list[AllocationItemOut]


class PricingOut(BaseModel):
    price_inr_kwh: float
    base_price_inr_kwh: float
    min_price_inr_kwh: float
    max_price_inr_kwh: float
    imbalance: float
    supply_kw: float
    demand_kw: float
    reason: str
    sensitivity: float
    smoothing: float


class TransactionOut(BaseModel):
    id: int
    run_id: int
    seller_id: str
    seller_name: str
    buyer_id: str
    buyer_name: str
    power_kw: float
    interval_seconds: int | None = None
    energy_kwh: float
    price_inr_kwh: float
    total_value_inr: float
    status: str
    source: str = "simulation"
    created_at: datetime | None = None
    executed_at: datetime | None = None


class TransactionPageOut(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
    pages: int


class SimulationStatusOut(BaseModel):
    status: str
    tick: int
    seq: int
    simulated_at: datetime | None
    cloud_scenario_pct: float
    scenario_label: str
    last_error: str | None
    tick_seconds: float
    interval_seconds: int
    auto_execute_trades: bool


class TotalsOut(BaseModel):
    generation_kw: float | None
    demand_kw: float | None
    surplus_kw: float | None
    deficit_kw: float | None
    offered_supply_kw: float | None
    allocated_kw: float | None
    unmet_kw: float | None
    unallocated_kw: float | None
    energy_traded_kwh: float
    tick_energy_traded_kwh: float | None
    price_inr_kwh: float | None
    base_price_inr_kwh: float
    min_price_inr_kwh: float
    max_price_inr_kwh: float
    imbalance: float | None
    pricing_reason: str | None
    active_households: int
    active_transactions: int
    cloud_cover_pct: float | None
    irradiance_w_m2: float | None
    effective_irradiance_w_m2: float | None


class HistoryPointOut(BaseModel):
    tick: int
    simulated_at: datetime | None
    generation_kw: float
    demand_kw: float
    surplus_kw: float
    deficit_kw: float
    allocated_kw: float
    unmet_kw: float
    unallocated_kw: float
    energy_traded_kwh: float
    price_inr_kwh: float
    base_price_inr_kwh: float
    imbalance: float
    cloud_cover_pct: float | None
    irradiance_w_m2: float | None
    effective_irradiance_w_m2: float | None
    scenario_label: str


class SimulationSnapshotOut(BaseModel):
    state: SimulationStatusOut
    weather: WeatherCurrentOut | None
    totals: TotalsOut
    pricing: PricingOut
    households: list[HouseholdOut]
    allocation: AllocationOut | None
    recent_transactions: list[TransactionOut]
    history: list[HistoryPointOut]


class SimulationControlRequest(BaseModel):
    pass


class ScenarioRequest(BaseModel):
    cloud_cover_pct: float = Field(ge=0, le=90)
    advance: bool = True


class EvaluationRequest(BaseModel):
    ticks: int = Field(default=24, ge=8, le=96)
    cloud_cover_pct: float = Field(default=25, ge=0, le=90)


class EvaluationOut(BaseModel):
    id: int
    created_at: datetime | None
    ticks: int
    interval_seconds: int
    scenario_cloud_pct: float
    weather_snapshot_id: int | None
    replay_start: datetime | None = None
    static: dict[str, Any]
    dynamic: dict[str, Any]
    comparison: dict[str, Any]
    series: list[dict[str, Any]]
    notes: str
    methodology: list[str]


class SettingsPatch(BaseModel):
    base_price_inr_kwh: float | None = Field(default=None, ge=0.5, le=50)
    min_price_inr_kwh: float | None = Field(default=None, ge=0.1, le=50)
    max_price_inr_kwh: float | None = Field(default=None, ge=0.1, le=100)
    price_sensitivity: float | None = Field(default=None, ge=0, le=20)
    price_smoothing: float | None = Field(default=None, ge=0, le=0.95)
    forecast_horizon_hours: int | None = Field(default=None, ge=4, le=72)
    tick_seconds: float | None = Field(default=None, ge=1, le=60)
    interval_seconds: int | None = Field(default=None, ge=60, le=3600)
    auto_execute_trades: bool | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    location_name: str | None = Field(default=None, min_length=2, max_length=120)

    @model_validator(mode="after")
    def validate_price_bounds(self) -> "SettingsPatch":
        if (
            self.min_price_inr_kwh is not None
            and self.max_price_inr_kwh is not None
            and self.min_price_inr_kwh > self.max_price_inr_kwh
        ):
            raise ValueError("Minimum price cannot exceed maximum price")
        if (
            self.base_price_inr_kwh is not None
            and self.min_price_inr_kwh is not None
            and self.base_price_inr_kwh < self.min_price_inr_kwh
        ):
            raise ValueError("Base price cannot be below minimum price")
        if (
            self.base_price_inr_kwh is not None
            and self.max_price_inr_kwh is not None
            and self.base_price_inr_kwh > self.max_price_inr_kwh
        ):
            raise ValueError("Base price cannot exceed maximum price")
        return self


class SettingsOut(BaseModel):
    base_price_inr_kwh: float
    min_price_inr_kwh: float
    max_price_inr_kwh: float
    price_sensitivity: float
    price_smoothing: float
    forecast_horizon_hours: int
    tick_seconds: float
    interval_seconds: int
    auto_execute_trades: bool
    latitude: float
    longitude: float
    location_name: str
    updated_at: datetime | None


class SettingsPageOut(BaseModel):
    settings: SettingsOut
    weather: WeatherStatusOut
    backend: dict[str, Any]
    data_sources: list[dict[str, Any]]
    supported: dict[str, bool]


class HealthOut(BaseModel):
    status: str
    service: str
    version: str
    database: str
    environment: str
    timestamp: datetime
    weather: WeatherStatusOut


class EvaluationSummaryOut(BaseModel):
    count: int
    latest: EvaluationOut | None


class ExecuteRequest(BaseModel):
    run_id: int | None = None


class ExecutionResultOut(BaseModel):
    allocation: AllocationOut
    transactions: list[TransactionOut]
    message: str


class MessageOut(BaseModel):
    message: str


class ErrorOut(BaseModel):
    detail: str


class AIResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=128)
    confirm_password: str = Field(min_length=10, max_length=128)
    role: Literal["seller", "buyer"]
    display_name: str | None = Field(default=None, max_length=80)
    location_name: str = Field(default="Perur, Coimbatore, Tamil Nadu", min_length=2, max_length=120)
    latitude: float = Field(default=10.976, ge=-90, le=90)
    longitude: float = Field(default=76.914, ge=-180, le=180)
    solar_capacity_kw: float | None = Field(default=None, ge=0, le=50)
    has_battery: bool = False
    battery_capacity_kwh: float | None = Field(default=None, ge=0, le=40)
    household_category: Literal[
        "residential", "apartment", "small_business", "shop", "farm", "other"
    ] = "residential"
    demand_base_kw: float | None = Field(default=None, ge=0.1, le=20)
    terms_accepted: bool = False

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        from .services.security import normalize_email, valid_email

        normalized = normalize_email(value)
        if not valid_email(normalized):
            raise ValueError("Enter a valid email address.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        from .services.security import validate_password_policy

        validate_password_policy(value)
        return value

    @model_validator(mode="after")
    def validate_registration(self) -> "RegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match.")
        if not self.terms_accepted:
            raise ValueError("You must acknowledge the simulation and privacy terms.")
        if self.role == "seller" and (self.solar_capacity_kw or 0.0) < 0:
            raise ValueError("Solar capacity cannot be negative.")
        return self


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize(cls, value: str) -> str:
        from .services.security import normalize_email

        return normalize_email(value)


class AuthUserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: Literal["seller", "buyer", "admin"]
    status: str
    created_at: datetime | None = None


class SessionOut(BaseModel):
    user: AuthUserOut | None
    csrf_token: str


class AuthResponse(BaseModel):
    user: AuthUserOut
    csrf_token: str


class CsrfOut(BaseModel):
    csrf_token: str


class SellerProfileOut(BaseModel):
    user_id: int
    display_name: str
    location_name: str
    latitude: float
    longitude: float
    solar_capacity_kw: float
    has_battery: bool
    battery_capacity_kwh: float
    household_category: str
    demand_base_kw: float
    household_id: str
    updated_at: datetime | None = None


class BuyerProfileOut(BaseModel):
    user_id: int
    display_name: str
    location_name: str
    latitude: float
    longitude: float
    household_category: str
    demand_base_kw: float
    household_id: str
    updated_at: datetime | None = None


class ProfilePatch(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=80)
    location_name: str | None = Field(default=None, min_length=2, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    solar_capacity_kw: float | None = Field(default=None, ge=0, le=50)
    has_battery: bool | None = None
    battery_capacity_kwh: float | None = Field(default=None, ge=0, le=40)
    household_category: Literal[
        "residential", "apartment", "small_business", "shop", "farm", "other"
    ] | None = None
    demand_base_kw: float | None = Field(default=None, ge=0.1, le=20)


class OfferCreate(BaseModel):
    quantity_kwh: float = Field(gt=0, le=10000)
    price_inr_kwh: float = Field(ge=0.5, le=50)
    note: str = Field(default="", max_length=280)


class OfferUpdate(BaseModel):
    quantity_kwh: float | None = Field(default=None, gt=0, le=10000)
    price_inr_kwh: float | None = Field(default=None, ge=0.5, le=50)
    note: str | None = Field(default=None, max_length=280)


class OfferOut(BaseModel):
    id: int
    seller_user_id: int
    seller_display_name: str
    location_name: str
    quantity_kwh: float
    remaining_kwh: float
    sold_kwh: float
    price_inr_kwh: float
    estimated_total_inr: float
    status: str
    note: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None


class OfferListOut(BaseModel):
    items: list[OfferOut]
    count: int


class OfferAvailabilityOut(BaseModel):
    available_to_offer_kwh: float
    daily_surplus_kwh: float
    reserved_offer_kwh: float
    forecast_freshness: str
    has_forecast: bool


class PurchaseCreate(BaseModel):
    offer_id: int = Field(gt=0)
    quantity_kwh: float = Field(gt=0, le=10000)


class PurchaseOut(BaseModel):
    id: int
    offer_id: int
    buyer_user_id: int
    seller_user_id: int
    buyer_display_name: str
    seller_display_name: str
    quantity_kwh: float
    price_inr_kwh: float
    total_value_inr: float
    status: str
    offer_status: str | None = None
    transaction_id: int | None = None
    created_at: datetime | None = None


class PurchaseListOut(BaseModel):
    items: list[PurchaseOut]
    count: int


class MarketDemandOut(BaseModel):
    registered_buyers: int
    total_baseline_demand_kw: float
    active_offers: int
    privacy_note: str


class EarningsOut(BaseModel):
    energy_sold_kwh: float
    simulated_sales_value_inr: float
    average_realized_price_inr_kwh: float | None
    completed_sales: int
    recent_sales: list[PurchaseOut]
    daily_series: list[dict[str, Any]]


class SpendingOut(BaseModel):
    energy_purchased_kwh: float
    simulated_spend_inr: float
    average_purchase_price_inr_kwh: float | None
    completed_purchases: int
    recent_purchases: list[PurchaseOut]
    daily_series: list[dict[str, Any]]


class AccountEnergyOut(BaseModel):
    household: dict[str, Any]
    current: dict[str, Any]
    daily: dict[str, Any]
    forecast: dict[str, Any]
    weather: WeatherCurrentOut | None
    weather_error: str | None = None
    assumptions: list[str]


class SellerDashboardOut(BaseModel):
    profile: SellerProfileOut
    energy: AccountEnergyOut
    offers: list[OfferOut]
    today: dict[str, Any]
    earnings: EarningsOut
    market_demand: MarketDemandOut
    pricing: dict[str, Any]
    assumptions: list[str]


class BuyerDashboardOut(BaseModel):
    profile: BuyerProfileOut
    energy: AccountEnergyOut
    available_offers: list[OfferOut]
    spending: SpendingOut
    pricing: dict[str, Any]
    assumptions: list[str]


class BuyerUsageOut(BaseModel):
    profile: BuyerProfileOut
    energy: AccountEnergyOut
    spending: SpendingOut


class BuyerPricesPoint(BaseModel):
    timestamp: str
    generation_kw: float
    demand_kw: float
    price_inr_kwh: float
    cloud_cover_pct: float | None = None
    irradiance_w_m2: float | None = None
    demand_basis: str | None = None


class BuyerPricesOut(BaseModel):
    current: PricingOut
    history: list[dict[str, Any]]
    forecast: list[BuyerPricesPoint]
    weather: WeatherCurrentOut | None
    freshness: str
    assumptions: list[str]


class SharedStatusOut(BaseModel):
    state: SimulationStatusOut
    weather: WeatherCurrentOut | None
    pricing: PricingOut
    shared_note: str

