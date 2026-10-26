from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models import AppSetting
from app.schemas import EvaluationRequest, ScenarioRequest, SettingsPatch


def test_scenario_validation_rejects_out_of_range_cloud() -> None:
    assert ScenarioRequest(cloud_cover_pct=0, advance=True).cloud_cover_pct == 0
    assert ScenarioRequest(cloud_cover_pct=90).cloud_cover_pct == 90
    for value in (-1, 90.1, 200):
        with pytest.raises(ValidationError):
            ScenarioRequest(cloud_cover_pct=value)


def test_evaluation_request_bounds_ticks_and_cloud() -> None:
    assert EvaluationRequest().ticks == 24
    assert EvaluationRequest(ticks=8, cloud_cover_pct=0).ticks == 8
    assert EvaluationRequest(ticks=96, cloud_cover_pct=90).ticks == 96
    for ticks in (7, 97):
        with pytest.raises(ValidationError):
            EvaluationRequest(ticks=ticks)
    for cloud in (-1, 91):
        with pytest.raises(ValidationError):
            EvaluationRequest(cloud_cover_pct=cloud)


def test_settings_patch_price_ordering() -> None:
    with pytest.raises(ValidationError, match="Minimum price cannot exceed maximum"):
        SettingsPatch(min_price_inr_kwh=10, max_price_inr_kwh=8)
    with pytest.raises(ValidationError, match="Base price cannot be below minimum"):
        SettingsPatch(base_price_inr_kwh=2, min_price_inr_kwh=3)
    with pytest.raises(ValidationError, match="Base price cannot exceed maximum"):
        SettingsPatch(base_price_inr_kwh=13, max_price_inr_kwh=12)

    valid = SettingsPatch(
        min_price_inr_kwh=3,
        base_price_inr_kwh=6,
        max_price_inr_kwh=12,
        price_smoothing=0.95,
    )
    assert valid.base_price_inr_kwh == 6


def test_settings_patch_field_bounds() -> None:
    with pytest.raises(ValidationError):
        SettingsPatch(base_price_inr_kwh=0.4)
    with pytest.raises(ValidationError):
        SettingsPatch(tick_seconds=0)
    with pytest.raises(ValidationError):
        SettingsPatch(interval_seconds=59)
    with pytest.raises(ValidationError):
        SettingsPatch(forecast_horizon_hours=73)
    with pytest.raises(ValidationError):
        SettingsPatch(latitude=91)
    with pytest.raises(ValidationError):
        SettingsPatch(longitude=-181)
    with pytest.raises(ValidationError):
        SettingsPatch(location_name="x")


def test_api_rejects_invalid_scenario_and_evaluation_payloads(admin_client) -> None:  # type: ignore[no-untyped-def]
    scenario = admin_client.post("/api/v1/simulation/scenario/cloud", json={"cloud_cover_pct": 95, "advance": True})
    assert scenario.status_code == 422

    evaluation = admin_client.post("/api/v1/evaluation/run", json={"ticks": 7, "cloud_cover_pct": 50})
    assert evaluation.status_code == 422

    settings = admin_client.patch("/api/v1/settings", json={"base_price_inr_kwh": 0.1})
    assert settings.status_code == 422


def test_api_rejects_inconsistent_final_price_bounds(admin_client, db) -> None:  # type: ignore[no-untyped-def]
    initial = admin_client.get("/api/v1/settings")
    assert initial.status_code == 200
    assert initial.json()["settings"]["min_price_inr_kwh"] == 3.0

    # Base 2.0 is valid on its own but below the existing minimum, so the route rejects it.
    response = admin_client.patch("/api/v1/settings", json={"base_price_inr_kwh": 2.0})
    assert response.status_code == 422
    assert "minimum ≤ base ≤ maximum" in response.json()["detail"]

    config = db.get(AppSetting, 1)
    assert config is not None
    assert config.base_price_inr_kwh == 6.0


def test_api_applies_valid_settings_and_persists(admin_client, db) -> None:  # type: ignore[no-untyped-def]
    response = admin_client.patch(
        "/api/v1/settings",
        json={
            "base_price_inr_kwh": 7.5,
            "min_price_inr_kwh": 3.5,
            "max_price_inr_kwh": 15.0,
            "tick_seconds": 3.0,
            "interval_seconds": 600,
            "auto_execute_trades": False,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["settings"]["base_price_inr_kwh"] == 7.5
    assert body["settings"]["auto_execute_trades"] is False
    assert body["settings"]["interval_seconds"] == 600

    stored = db.get(AppSetting, 1)
    assert stored is not None
    assert stored.base_price_inr_kwh == 7.5
    assert stored.auto_execute_trades is False
