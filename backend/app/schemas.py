from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, ConfigDict, model_validator


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
