from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class UTCDateTime(TypeDecorator[datetime]):
    """SQLite drops timezone info; always round-trip UTC-aware datetimes."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):  # type: ignore[no-untyped-def]
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: datetime | None, dialect):  # type: ignore[no-untyped-def]
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AppSetting(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    base_price_inr_kwh: Mapped[float] = mapped_column(Float, default=6.0)
    min_price_inr_kwh: Mapped[float] = mapped_column(Float, default=3.0)
    max_price_inr_kwh: Mapped[float] = mapped_column(Float, default=12.0)
    price_sensitivity: Mapped[float] = mapped_column(Float, default=3.0)
    price_smoothing: Mapped[float] = mapped_column(Float, default=0.65)
    forecast_horizon_hours: Mapped[int] = mapped_column(Integer, default=24)
    tick_seconds: Mapped[float] = mapped_column(Float, default=5.0)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=300)
    auto_execute_trades: Mapped[bool] = mapped_column(Boolean, default=True)
    latitude: Mapped[float] = mapped_column(Float, default=10.976)
    longitude: Mapped[float] = mapped_column(Float, default=76.914)
    location_name: Mapped[str] = mapped_column(String(120), default="Perur, Coimbatore, Tamil Nadu")
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    role_hint: Mapped[str] = mapped_column(String(40), default="residential")
    solar_capacity_kw: Mapped[float] = mapped_column(Float, nullable=False)
    orientation_factor: Mapped[float] = mapped_column(Float, default=0.92)
    demand_base_kw: Mapped[float] = mapped_column(Float, default=1.0)
    battery_capacity_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    battery_soc_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    battery_max_rate_kw: Mapped[float] = mapped_column(Float, default=0.0)
    reservation_price_ratio: Mapped[float] = mapped_column(Float, default=1.0)
    # Account-owned households are excluded from the seeded microgrid simulation.
    owner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class SimulationState(Base):
    __tablename__ = "simulation_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    status: Mapped[str] = mapped_column(String(20), default="idle")
    tick: Mapped[int] = mapped_column(Integer, default=0)
    seq: Mapped[int] = mapped_column(Integer, default=0)
    simulated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    cloud_scenario_pct: Mapped[float] = mapped_column(Float, default=0.0)
    scenario_label: Mapped[str] = mapped_column(String(120), default="Live weather")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), default="current")
    provider: Mapped[str] = mapped_column(String(60), default="open-meteo")
    transport: Mapped[str] = mapped_column(String(40), default="mcp-stdio")
    location_name: Mapped[str] = mapped_column(String(120))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    retrieved_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    observed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    cloud_cover_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    irradiance_w_m2: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_day: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="ok")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class TickSnapshot(Base):
    __tablename__ = "tick_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tick: Mapped[int] = mapped_column(Integer, index=True)
    simulated_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    generation_kw: Mapped[float] = mapped_column(Float, default=0.0)
    demand_kw: Mapped[float] = mapped_column(Float, default=0.0)
    physical_surplus_kw: Mapped[float] = mapped_column(Float, default=0.0)
    physical_deficit_kw: Mapped[float] = mapped_column(Float, default=0.0)
    offered_supply_kw: Mapped[float] = mapped_column(Float, default=0.0)
    requested_demand_kw: Mapped[float] = mapped_column(Float, default=0.0)
    allocated_kw: Mapped[float] = mapped_column(Float, default=0.0)
    unmet_kw: Mapped[float] = mapped_column(Float, default=0.0)
    unallocated_kw: Mapped[float] = mapped_column(Float, default=0.0)
    energy_traded_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    price_inr_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    base_price_inr_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    imbalance: Mapped[float] = mapped_column(Float, default=0.0)
    cloud_cover_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    irradiance_w_m2: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_irradiance_w_m2: Mapped[float | None] = mapped_column(Float, nullable=True)
    pricing_reason: Mapped[str] = mapped_column(Text, default="")
    weather_snapshot_id: Mapped[int | None] = mapped_column(ForeignKey("weather_snapshots.id"), nullable=True)
    scenario_label: Mapped[str] = mapped_column(String(120), default="Live weather")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class HouseholdSnapshot(Base):
    __tablename__ = "household_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tick: Mapped[int] = mapped_column(Integer, index=True)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    simulated_at: Mapped[datetime] = mapped_column(UTCDateTime)
    generation_kw: Mapped[float] = mapped_column(Float, default=0.0)
    demand_kw: Mapped[float] = mapped_column(Float, default=0.0)
    battery_soc_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    surplus_kw: Mapped[float] = mapped_column(Float, default=0.0)
    deficit_kw: Mapped[float] = mapped_column(Float, default=0.0)
    sell_offer_kw: Mapped[float] = mapped_column(Float, default=0.0)
    buy_request_kw: Mapped[float] = mapped_column(Float, default=0.0)
    served_kw: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="balanced")

    household: Mapped[Household] = relationship()


class AllocationRun(Base):
    __tablename__ = "allocation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tick: Mapped[int] = mapped_column(Integer, index=True)
    status: Mapped[str] = mapped_column(String(20), default="proposed")
    algorithm: Mapped[str] = mapped_column(String(80), default="bipartite_max_flow")
    objective_value: Mapped[float] = mapped_column(Float, default=0.0)
    execution_ms: Mapped[float] = mapped_column(Float, default=0.0)
    total_supply_kw: Mapped[float] = mapped_column(Float, default=0.0)
    total_demand_kw: Mapped[float] = mapped_column(Float, default=0.0)
    allocated_kw: Mapped[float] = mapped_column(Float, default=0.0)
    unmet_kw: Mapped[float] = mapped_column(Float, default=0.0)
    unallocated_kw: Mapped[float] = mapped_column(Float, default=0.0)
    price_inr_kwh: Mapped[float] = mapped_column(Float, default=0.0)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=300)
    notes: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(30), default="simulation", index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    executed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    items: Mapped[list[AllocationItem]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="AllocationItem.id"
    )
    transactions: Mapped[list[Transaction]] = relationship(back_populates="run")


class AllocationItem(Base):
    __tablename__ = "allocation_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("allocation_runs.id"), index=True)
    seller_id: Mapped[str] = mapped_column(ForeignKey("households.id"))
    buyer_id: Mapped[str] = mapped_column(ForeignKey("households.id"))
    power_kw: Mapped[float] = mapped_column(Float)

    run: Mapped[AllocationRun] = relationship(back_populates="items")
    seller: Mapped[Household] = relationship(foreign_keys=[seller_id])
    buyer: Mapped[Household] = relationship(foreign_keys=[buyer_id])


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (UniqueConstraint("run_id", "seller_id", "buyer_id", name="uq_transaction_allocation"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("allocation_runs.id"), index=True)
    seller_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    buyer_id: Mapped[str] = mapped_column(ForeignKey("households.id"), index=True)
    power_kw: Mapped[float] = mapped_column(Float)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=300)
    energy_kwh: Mapped[float] = mapped_column(Float)
    price_inr_kwh: Mapped[float] = mapped_column(Float)
    total_value_inr: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="executed")
    source: Mapped[str] = mapped_column(String(30), default="simulation", index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    executed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    run: Mapped[AllocationRun] = relationship(back_populates="transactions")
    seller: Mapped[Household] = relationship(foreign_keys=[seller_id])
    buyer: Mapped[Household] = relationship(foreign_keys=[buyer_id])


class EvaluationRun(Base):
    __tablename__ = "evaluation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticks: Mapped[int] = mapped_column(Integer)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=300)
    scenario_cloud_pct: Mapped[float] = mapped_column(Float, default=0.0)
    weather_snapshot_id: Mapped[int | None] = mapped_column(ForeignKey("weather_snapshots.id"), nullable=True)
    static_metrics: Mapped[dict[str, Any]] = mapped_column(JSON)
    dynamic_metrics: Mapped[dict[str, Any]] = mapped_column(JSON)
    series: Mapped[list[dict[str, Any]]] = mapped_column(JSON)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user: Mapped[User] = relationship()


class SellerProfile(Base):
    __tablename__ = "seller_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    location_name: Mapped[str] = mapped_column(String(120), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    solar_capacity_kw: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    has_battery: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    battery_capacity_kwh: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    household_category: Mapped[str] = mapped_column(String(60), default="residential", nullable=False)
    demand_base_kw: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    household_id: Mapped[str] = mapped_column(
        ForeignKey("households.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship()
    household: Mapped[Household] = relationship()


class BuyerProfile(Base):
    __tablename__ = "buyer_profiles"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    location_name: Mapped[str] = mapped_column(String(120), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    household_category: Mapped[str] = mapped_column(String(60), default="residential", nullable=False)
    demand_base_kw: Mapped[float] = mapped_column(Float, default=0.9, nullable=False)
    household_id: Mapped[str] = mapped_column(
        ForeignKey("households.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship()
    household: Mapped[Household] = relationship()


class EnergyOffer(Base):
    __tablename__ = "energy_offers"
    __table_args__ = (
        UniqueConstraint("id", "seller_user_id", name="uq_offer_owner"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    seller_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seller_household_id: Mapped[str] = mapped_column(
        ForeignKey("households.id", ondelete="RESTRICT"), nullable=False
    )
    quantity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    remaining_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    price_inr_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    note: Mapped[str] = mapped_column(String(280), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    seller: Mapped[User] = relationship()


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    buyer_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seller_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    offer_id: Mapped[int] = mapped_column(
        ForeignKey("energy_offers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True, unique=True
    )
    quantity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    price_inr_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    total_value_inr: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="completed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    buyer: Mapped[User] = relationship(foreign_keys=[buyer_user_id])
    seller: Mapped[User] = relationship(foreign_keys=[seller_user_id])
    offer: Mapped[EnergyOffer] = relationship()
    transaction: Mapped[Transaction | None] = relationship()
