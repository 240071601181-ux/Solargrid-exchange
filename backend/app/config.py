from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration. Values can be overridden through the repository .env file."""

    app_name: str = "Solar Microgrid Exchange API"
    api_prefix: str = "/api/v1"
    environment: str = "development"

    database_url: str = f"sqlite:///{(BASE_DIR / 'data' / 'microgrid.db').as_posix()}"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    latitude: float = 10.976
    longitude: float = 76.914
    location_name: str = "Perur, Coimbatore, Tamil Nadu"
    timezone: str = "Asia/Kolkata"

    # MCP weather integration. The bundled server speaks MCP over stdio and calls Open-Meteo.
    weather_mcp_enabled: bool = True
    weather_mcp_script: Path = BASE_DIR / "mcp_weather_server.py"
    weather_mcp_command: str | None = None
    weather_mcp_timeout_seconds: float = 45.0
    weather_cache_ttl_seconds: int = 600
    weather_stale_after_seconds: int = 1800
    weather_expire_after_seconds: int = 21600
    weather_forecast_hours: int = 24

    simulation_tick_seconds: float = 5.0
    simulation_interval_seconds: int = 300
    simulation_seed: int = 20261026
    auto_execute_trades: bool = True

    base_price_inr_kwh: float = 6.0
    min_price_inr_kwh: float = 3.0
    max_price_inr_kwh: float = 12.0
    price_sensitivity: float = 3.0
    price_smoothing: float = 0.65

    max_trade_kw_per_household: float = 4.0
    battery_max_rate_ratio: float = 0.5

    # Authentication / sessions. In production set SESSION_COOKIE_SECURE=true and
    # provision administrator credentials through the environment or admin_cli.
    session_cookie_name: str = "sg_session"
    csrf_cookie_name: str = "sg_csrf"
    session_ttl_hours: int = 12
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    login_rate_limit_attempts: int = 8
    login_rate_limit_window_seconds: int = 600
    registration_rate_limit_attempts: int = 10
    registration_rate_limit_window_seconds: int = 3600
    bootstrap_admin_email: str | None = None
    bootstrap_admin_password: str | None = None
    bootstrap_admin_name: str = "SolarGrid Operator"

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_DIR / ".env"), str(BASE_DIR / ".env")),
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
