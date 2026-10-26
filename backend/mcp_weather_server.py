"""Local MCP weather server used by the FastAPI backend.

Exposes two MCP tools over stdio:
  - get_current_weather
  - get_weather_forecast

The tools call Open-Meteo's public forecast API. Every response records the
provider, retrieval time and observation/forecast timestamps so the caller can
present freshness honestly. No values are invented when the upstream call fails.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from mcp.server.fastmcp import FastMCP

PROVIDER = "open-meteo"
PROVIDER_URL = "https://open-meteo.com/"
API_URL = "https://api.open-meteo.com/v1/forecast"
mcp = FastMCP("open-meteo-weather")


def _iso_utc(value: str, tz: str) -> str:
    """Open-Meteo returns local naive timestamps. Attach the location timezone."""
    naive = datetime.fromisoformat(value)
    return naive.replace(tzinfo=ZoneInfo(tz)).astimezone(timezone.utc).isoformat()


async def _fetch(params: dict[str, Any]) -> dict[str, Any]:
    headers = {"User-Agent": "solar-microgrid-exchange/1.0 (MCP weather server)"}
    async with httpx.AsyncClient(timeout=25.0, headers=headers) as client:
        response = await client.get(API_URL, params=params)
        response.raise_for_status()
        return response.json()


@mcp.tool()
async def get_current_weather(
    latitude: float,
    longitude: float,
    timezone_name: str = "Asia/Kolkata",
) -> str:
    """Fetch current weather conditions for a coordinate from Open-Meteo."""
    retrieved_at = datetime.now(timezone.utc).isoformat()
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,"
            "shortwave_radiation,is_day,weather_code"
        ),
        "timezone": timezone_name,
    }
    try:
        payload = await _fetch(params)
        current = payload.get("current") or {}
        if "temperature_2m" not in current:
            raise ValueError("Provider response did not include current temperature")
        wind_kmh = current.get("wind_speed_10m")
        result = {
            "status": "ok",
            "provider": PROVIDER,
            "provider_url": PROVIDER_URL,
            "retrieved_at": retrieved_at,
            "observed_at": _iso_utc(current["time"], timezone_name) if current.get("time") else None,
            "location": {
                "name": f"{latitude:.3f}, {longitude:.3f}",
                "latitude": float(payload.get("latitude", latitude)),
                "longitude": float(payload.get("longitude", longitude)),
                "elevation_m": payload.get("elevation"),
                "timezone": payload.get("timezone", timezone_name),
            },
            "temperature_c": current.get("temperature_2m"),
            "humidity_pct": current.get("relative_humidity_2m"),
            "cloud_cover_pct": current.get("cloud_cover"),
            "wind_speed_ms": round(wind_kmh / 3.6, 2) if wind_kmh is not None else None,
            "irradiance_w_m2": current.get("shortwave_radiation"),
            "is_day": bool(current.get("is_day", 0)),
            "weather_code": current.get("weather_code"),
            "units": {
                "temperature": "°C",
                "humidity": "%",
                "cloud_cover": "%",
                "wind_speed": "m/s (converted from km/h)",
                "irradiance": "W/m²",
            },
            "note": (
                "Provider-reported current conditions from Open-Meteo via MCP. "
                "Irradiance is the provider's shortwave radiation field, not an on-site sensor reading."
            ),
        }
        return json.dumps(result)
    except Exception as exc:  # surfaced to the backend as a failed weather refresh
        return json.dumps(
            {
                "status": "error",
                "provider": PROVIDER,
                "retrieved_at": retrieved_at,
                "error": f"{type(exc).__name__}: {exc}",
            }
        )


@mcp.tool()
async def get_weather_forecast(
    latitude: float,
    longitude: float,
    timezone_name: str = "Asia/Kolkata",
    hours: int = 24,
) -> str:
    """Fetch an hourly weather forecast (irradiance, cloud cover, temperature, wind)."""
    retrieved_at = datetime.now(timezone.utc).isoformat()
    hours = max(1, min(int(hours), 72))
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,cloud_cover,wind_speed_10m,shortwave_radiation",
        "forecast_days": 3,
        "timezone": timezone_name,
        "wind_speed_unit": "ms",
    }
    try:
        payload = await _fetch(params)
        hourly = payload.get("hourly") or {}
        times = hourly.get("time") or []
        if not times:
            raise ValueError("Provider response did not include hourly forecast data")

        now = datetime.now(ZoneInfo(timezone_name))
        rows: list[dict[str, Any]] = []
        for index, stamp in enumerate(times):
            local_time = datetime.fromisoformat(stamp).replace(tzinfo=ZoneInfo(timezone_name))
            if local_time < now:
                continue
            rows.append(
                {
                    "timestamp": local_time.astimezone(timezone.utc).isoformat(),
                    "temperature_c": _at(hourly.get("temperature_2m"), index),
                    "cloud_cover_pct": _at(hourly.get("cloud_cover"), index),
                    "wind_speed_ms": _at(hourly.get("wind_speed_10m"), index),
                    "irradiance_w_m2": _at(hourly.get("shortwave_radiation"), index),
                }
            )
            if len(rows) >= hours:
                break

        return json.dumps(
            {
                "status": "ok",
                "provider": PROVIDER,
                "provider_url": PROVIDER_URL,
                "retrieved_at": retrieved_at,
                "location": {
                    "name": f"{latitude:.3f}, {longitude:.3f}",
                    "latitude": float(payload.get("latitude", latitude)),
                    "longitude": float(payload.get("longitude", longitude)),
                    "timezone": payload.get("timezone", timezone_name),
                },
                "hours": rows,
                "model_note": (
                    "Hourly provider forecast (Open-Meteo). Forecast irradiance is used only for "
                    "forward-looking estimates and is labeled as predicted, never as an observation."
                ),
            }
        )
    except Exception as exc:
        return json.dumps(
            {
                "status": "error",
                "provider": PROVIDER,
                "retrieved_at": retrieved_at,
                "error": f"{type(exc).__name__}: {exc}",
            }
        )


def _at(values: list[Any] | None, index: int) -> Any:
    if not values or index >= len(values):
        return None
    return values[index]


if __name__ == "__main__":
    # stdout is the MCP transport; keep diagnostics on stderr only.
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    mcp.run(transport="stdio")
