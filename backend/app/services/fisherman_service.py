import logging
import math
from typing import Optional
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.config import settings
from app.schemas.fisherman import (
    FishingSuitability,
    SeaCondition,
    DataAvailability,
    EnvironmentalVariable,
    FishermanIntelligenceResponse,
    FishingZoneRecommendation,
    SeaConditionsResponse,
    CoastalAlert,
    CoastalAlertResponse,
)
from app.utils.calculations import haversine_distance

logger = logging.getLogger(__name__)

# --- Environmental thresholds ---
SST_FISHING_OPTIMAL_MIN = 26.0
SST_FISHING_OPTIMAL_MAX = 30.0
CURRENT_SPEED_FAVORABLE_MAX = 0.8
CURRENT_SPEED_MODERATE_MAX = 1.5

# --- Suitability classification thresholds ---
SUITABILITY_HIGH_THRESHOLD = 0.70
SUITABILITY_MODERATE_THRESHOLD = 0.45

# --- Risk penalty weights (configurable) ---
# Anomaly risk is computed per unique spatial location, not per depth-record.
# max_severity_score: the highest ML anomaly_score among nearby anomalies
# affected_locations: number of distinct lat/lon points flagged
# has_high: whether any HIGH-severity anomaly exists

# Penalty multipliers: final_score = env_score * risk_multiplier
# These are conservative: HIGH anomalies strongly penalize; WARNINGs moderately.
RISK_MULTIPLIER_CLEAN = 1.0           # No anomalies nearby
RISK_MULTIPLIER_LOW_WARNING = 0.90    # 1 location, WARNING only, max_score < 0.65
RISK_MULTIPLIER_MODERATE_WARNING = 0.80  # WARNING anomalies, moderate severity
RISK_MULTIPLIER_HIGH_WARNING = 0.70   # Many WARNING locations or high scores
RISK_MULTIPLIER_HAS_HIGH = 0.55       # Any HIGH-severity anomaly present
RISK_MULTIPLIER_SEVERE = 0.40         # Multiple HIGH locations or extreme scores


class RiskAssessment:
    """Aggregated ML anomaly risk for a spatial area."""

    def __init__(
        self,
        affected_locations: int,
        total_records: int,
        max_severity_score: float,
        has_high: bool,
        high_location_count: int,
        warning_location_count: int,
        representative_score: float,
    ):
        self.affected_locations = affected_locations
        self.total_records = total_records
        self.max_severity_score = max_severity_score
        self.has_high = has_high
        self.high_location_count = high_location_count
        self.warning_location_count = warning_location_count
        self.representative_score = representative_score

    @property
    def risk_multiplier(self) -> float:
        if self.affected_locations == 0:
            return RISK_MULTIPLIER_CLEAN

        if self.has_high:
            if self.high_location_count >= 2 or self.max_severity_score >= 0.90:
                return RISK_MULTIPLIER_SEVERE
            return RISK_MULTIPLIER_HAS_HIGH

        if self.warning_location_count >= 3 or self.max_severity_score >= 0.70:
            return RISK_MULTIPLIER_HIGH_WARNING
        if self.warning_location_count >= 2 or self.max_severity_score >= 0.65:
            return RISK_MULTIPLIER_MODERATE_WARNING
        return RISK_MULTIPLIER_LOW_WARNING

    @property
    def risk_description(self) -> str:
        if self.affected_locations == 0:
            return "No significant ocean anomalies nearby"

        parts = []
        if self.has_high:
            parts.append(
                f"{self.high_location_count} location(s) with HIGH anomaly severity "
                f"(max score {self.max_severity_score:.2f})"
            )
        if self.warning_location_count > 0:
            parts.append(
                f"{self.warning_location_count} location(s) with WARNING anomaly activity"
            )

        desc = "; ".join(parts)
        mult = self.risk_multiplier
        if mult <= RISK_MULTIPLIER_SEVERE:
            return f"{desc} — significant risk, exercise strong caution"
        elif mult <= RISK_MULTIPLIER_HAS_HIGH:
            return f"{desc} — elevated risk, exercise caution"
        elif mult <= RISK_MULTIPLIER_MODERATE_WARNING:
            return f"{desc} — moderate anomaly activity noted"
        else:
            return f"{desc} — minor anomaly activity"


class FishermanService:
    def __init__(self):
        self._collocated: Optional[pd.DataFrame] = None
        self._anomaly_service = None
        self._data_source = "unknown"

    def initialize(self, ocean_service, anomaly_service):
        from app.services.ocean_service import OceanService
        self._collocated = ocean_service._collocated
        self._anomaly_service = anomaly_service
        self._data_source = ocean_service._model_source
        if self._collocated is not None:
            logger.info(
                f"FishermanService initialized with {len(self._collocated)} records"
            )

    # ------------------------------------------------------------------
    # Data retrieval helpers
    # ------------------------------------------------------------------

    def _get_nearby_data(
        self, latitude: float, longitude: float, radius_km: float
    ) -> pd.DataFrame:
        if self._collocated is None:
            return pd.DataFrame()

        df = self._collocated.copy()
        lat_tol = radius_km / 111.0
        lon_tol = radius_km / (111.0 * max(math.cos(math.radians(latitude)), 0.01))

        nearby = df[
            (df["latitude"].between(latitude - lat_tol, latitude + lat_tol))
            & (df["longitude"].between(longitude - lon_tol, longitude + lon_tol))
        ].copy()

        if nearby.empty:
            return nearby

        nearby["distance_km"] = nearby.apply(
            lambda row: haversine_distance(
                latitude, longitude, row["latitude"], row["longitude"]
            ),
            axis=1,
        )
        nearby = nearby[nearby["distance_km"] <= radius_km]
        return nearby.sort_values("distance_km")

    def _get_surface_data(self, nearby: pd.DataFrame) -> pd.DataFrame:
        if nearby.empty:
            return nearby
        surface = nearby[nearby["depth"] <= 15]
        if surface.empty:
            surface = nearby.nsmallest(5, "depth")
        return surface

    # ------------------------------------------------------------------
    # Environmental variable computation
    # ------------------------------------------------------------------

    def _compute_sst(self, surface: pd.DataFrame) -> EnvironmentalVariable:
        if surface.empty:
            return EnvironmentalVariable(unit="°C", availability=DataAvailability.UNAVAILABLE)

        temps = surface["observed_temperature"].dropna()
        if temps.empty:
            temps = surface["model_temperature"].dropna()
        if temps.empty:
            return EnvironmentalVariable(unit="°C", availability=DataAvailability.UNAVAILABLE)

        return EnvironmentalVariable(
            value=round(float(temps.mean()), 2),
            unit="°C",
            availability=DataAvailability.AVAILABLE,
        )

    def _compute_salinity(self, surface: pd.DataFrame) -> EnvironmentalVariable:
        if surface.empty:
            return EnvironmentalVariable(unit="PSU", availability=DataAvailability.UNAVAILABLE)

        sal = surface["observed_salinity"].dropna()
        if sal.empty:
            sal = surface["model_salinity"].dropna()
        if sal.empty:
            return EnvironmentalVariable(unit="PSU", availability=DataAvailability.UNAVAILABLE)

        return EnvironmentalVariable(
            value=round(float(sal.mean()), 2),
            unit="PSU",
            availability=DataAvailability.AVAILABLE,
        )

    def _compute_current(self, surface: pd.DataFrame) -> tuple[EnvironmentalVariable, EnvironmentalVariable]:
        if surface.empty:
            return (
                EnvironmentalVariable(unit="m/s", availability=DataAvailability.UNAVAILABLE),
                EnvironmentalVariable(unit="°", availability=DataAvailability.UNAVAILABLE),
            )

        u_vals = surface["model_current_u"].dropna()
        v_vals = surface["model_current_v"].dropna()

        if u_vals.empty or v_vals.empty:
            return (
                EnvironmentalVariable(unit="m/s", availability=DataAvailability.UNAVAILABLE),
                EnvironmentalVariable(unit="°", availability=DataAvailability.UNAVAILABLE),
            )

        u_mean = float(u_vals.mean())
        v_mean = float(v_vals.mean())
        speed = math.sqrt(u_mean**2 + v_mean**2)
        direction = (math.degrees(math.atan2(u_mean, v_mean)) + 360) % 360

        return (
            EnvironmentalVariable(
                value=round(speed, 3),
                unit="m/s",
                availability=DataAvailability.AVAILABLE,
            ),
            EnvironmentalVariable(
                value=round(direction, 1),
                unit="°",
                availability=DataAvailability.AVAILABLE,
            ),
        )

    def _compute_sea_level(self, surface: pd.DataFrame) -> EnvironmentalVariable:
        if surface.empty:
            return EnvironmentalVariable(unit="m", availability=DataAvailability.UNAVAILABLE)

        sl = surface["model_sea_level"].dropna()
        if sl.empty:
            return EnvironmentalVariable(unit="m", availability=DataAvailability.UNAVAILABLE)

        return EnvironmentalVariable(
            value=round(float(sl.mean()), 3),
            unit="m",
            availability=DataAvailability.AVAILABLE,
        )

    def _compute_sea_condition(
        self, current_speed: EnvironmentalVariable
    ) -> SeaCondition:
        if current_speed.availability != DataAvailability.AVAILABLE or current_speed.value is None:
            return SeaCondition.UNKNOWN
        if current_speed.value <= 0.5:
            return SeaCondition.CALM
        elif current_speed.value <= 1.2:
            return SeaCondition.MODERATE
        else:
            return SeaCondition.ROUGH

    # ------------------------------------------------------------------
    # Anomaly / risk assessment
    # ------------------------------------------------------------------

    def _get_risk_assessment(
        self, latitude: float, longitude: float, radius_km: float
    ) -> RiskAssessment:
        """Aggregate ML anomaly information into a meaningful risk assessment.

        Groups anomaly records by unique spatial location (lat/lon) rather than
        counting each depth-slice as an independent event. A single Argo profile
        with 20 depth records at one location represents one spatial phenomenon.
        """
        if self._anomaly_service is None or not self._anomaly_service.is_available:
            return RiskAssessment(
                affected_locations=0,
                total_records=0,
                max_severity_score=0.0,
                has_high=False,
                high_location_count=0,
                warning_location_count=0,
                representative_score=0.0,
            )

        lat_tol = radius_km / 111.0
        lon_tol = radius_km / (111.0 * max(math.cos(math.radians(latitude)), 0.01))

        result = self._anomaly_service.get_anomalies(
            lat_min=latitude - lat_tol,
            lat_max=latitude + lat_tol,
            lon_min=longitude - lon_tol,
            lon_max=longitude + lon_tol,
            limit=200,
        )

        anomalies = result.get("anomalies", [])
        if not anomalies:
            return RiskAssessment(
                affected_locations=0,
                total_records=0,
                max_severity_score=0.0,
                has_high=False,
                high_location_count=0,
                warning_location_count=0,
                representative_score=0.0,
            )

        # Group by unique location
        location_data: dict[tuple[float, float], dict] = {}
        for a in anomalies:
            key = (a["latitude"], a["longitude"])
            if key not in location_data:
                location_data[key] = {"max_score": 0.0, "has_high": False, "count": 0}
            loc = location_data[key]
            loc["max_score"] = max(loc["max_score"], a.get("anomaly_score", 0))
            loc["count"] += 1
            if a.get("status") == "high":
                loc["has_high"] = True

        affected_locations = len(location_data)
        high_location_count = sum(1 for v in location_data.values() if v["has_high"])
        warning_location_count = affected_locations - high_location_count
        max_severity_score = max(v["max_score"] for v in location_data.values())
        representative_score = sum(v["max_score"] for v in location_data.values()) / affected_locations

        return RiskAssessment(
            affected_locations=affected_locations,
            total_records=len(anomalies),
            max_severity_score=round(max_severity_score, 4),
            has_high=(high_location_count > 0),
            high_location_count=high_location_count,
            warning_location_count=warning_location_count,
            representative_score=round(representative_score, 4),
        )

    def _get_anomaly_warnings(
        self, latitude: float, longitude: float, radius_km: float
    ) -> tuple[int, list[str]]:
        """Return human-readable anomaly warnings for display."""
        if self._anomaly_service is None or not self._anomaly_service.is_available:
            return 0, []

        lat_tol = radius_km / 111.0
        lon_tol = radius_km / (111.0 * max(math.cos(math.radians(latitude)), 0.01))

        result = self._anomaly_service.get_anomalies(
            lat_min=latitude - lat_tol,
            lat_max=latitude + lat_tol,
            lon_min=longitude - lon_tol,
            lon_max=longitude + lon_tol,
            limit=20,
        )
        count = result.get("count", 0)
        warnings = []
        for a in result.get("anomalies", [])[:5]:
            status = a.get("status", "unknown")
            score = a.get("anomaly_score", 0)
            lat = a.get("latitude", 0)
            lon = a.get("longitude", 0)
            warnings.append(
                f"Ocean anomaly ({status}, score={score:.2f}) at {lat:.2f}°N, {lon:.2f}°E"
            )
        return count, warnings

    # ------------------------------------------------------------------
    # Unified suitability scoring
    # ------------------------------------------------------------------

    def _compute_environmental_score(
        self,
        sst: EnvironmentalVariable,
        current_speed: EnvironmentalVariable,
    ) -> tuple[float, list[str]]:
        """Compute raw environmental suitability score from available variables.

        Returns (score, factors) where score is in [0, 1].
        Only includes variables that are actually available.
        """
        factors = []
        scores = []

        has_any_data = (
            (sst.availability == DataAvailability.AVAILABLE)
            or (current_speed.availability == DataAvailability.AVAILABLE)
        )

        if not has_any_data:
            return 0.0, ["No ocean data available for this location within search radius"]

        if sst.availability == DataAvailability.AVAILABLE and sst.value is not None:
            if SST_FISHING_OPTIMAL_MIN <= sst.value <= SST_FISHING_OPTIMAL_MAX:
                scores.append(0.9)
                factors.append(f"SST {sst.value}°C within optimal range ({SST_FISHING_OPTIMAL_MIN}-{SST_FISHING_OPTIMAL_MAX}°C)")
            elif 24.0 <= sst.value <= 32.0:
                scores.append(0.6)
                factors.append(f"SST {sst.value}°C within acceptable range")
            else:
                scores.append(0.2)
                factors.append(f"SST {sst.value}°C outside favorable range")

        if current_speed.availability == DataAvailability.AVAILABLE and current_speed.value is not None:
            if current_speed.value <= CURRENT_SPEED_FAVORABLE_MAX:
                scores.append(0.9)
                factors.append(f"Current speed {current_speed.value} m/s — favorable for fishing")
            elif current_speed.value <= CURRENT_SPEED_MODERATE_MAX:
                scores.append(0.55)
                factors.append(f"Current speed {current_speed.value} m/s — moderate")
            else:
                scores.append(0.2)
                factors.append(f"Current speed {current_speed.value} m/s — strong currents, challenging conditions")

        if not scores:
            return 0.0, factors

        return round(sum(scores) / len(scores), 4), factors

    def _compute_suitability(
        self,
        sst: EnvironmentalVariable,
        current_speed: EnvironmentalVariable,
        risk: RiskAssessment,
    ) -> tuple[FishingSuitability, float, list[str]]:
        """Compute final suitability: environmental_score * risk_multiplier.

        This is the single unified scoring used by both /intelligence and
        /zone-recommendation to ensure consistency.
        """
        env_score, factors = self._compute_environmental_score(sst, current_speed)

        if env_score == 0.0 and not factors:
            return FishingSuitability.INSUFFICIENT_DATA, 0.0, factors

        if "No ocean data available" in (factors[0] if factors else ""):
            return (
                FishingSuitability.INSUFFICIENT_DATA,
                0.0,
                factors,
            )

        # Apply risk penalty
        multiplier = risk.risk_multiplier
        factors.append(risk.risk_description)

        final_score = round(env_score * multiplier, 3)

        if final_score >= SUITABILITY_HIGH_THRESHOLD:
            classification = FishingSuitability.HIGH
        elif final_score >= SUITABILITY_MODERATE_THRESHOLD:
            classification = FishingSuitability.MODERATE
        else:
            classification = FishingSuitability.LOW

        return classification, final_score, factors

    # ------------------------------------------------------------------
    # Zone recommendation (uses unified scoring)
    # ------------------------------------------------------------------

    def _find_recommended_zone(
        self, latitude: float, longitude: float, radius_km: float
    ) -> Optional[FishingZoneRecommendation]:
        if self._collocated is None or self._collocated.empty:
            return None

        search_radius = min(radius_km * 2, 200)
        nearby = self._get_nearby_data(latitude, longitude, search_radius)
        surface = self._get_surface_data(nearby)

        if surface.empty:
            return None

        candidates = (
            surface.groupby(["latitude", "longitude"])
            .agg(
                avg_temp=("model_temperature", "mean"),
                avg_obs_temp=("observed_temperature", "mean"),
                avg_current_u=("model_current_u", "mean"),
                avg_current_v=("model_current_v", "mean"),
                distance=("distance_km", "first"),
            )
            .reset_index()
        )

        if candidates.empty:
            return None

        candidates["current_speed"] = np.sqrt(
            candidates["avg_current_u"] ** 2 + candidates["avg_current_v"] ** 2
        )

        # Use observed temp if available, fall back to model
        candidates["sst"] = candidates["avg_obs_temp"].fillna(candidates["avg_temp"])

        # Score each candidate using the same unified logic
        scored_candidates = []
        for _, row in candidates.iterrows():
            c_lat = float(row["latitude"])
            c_lon = float(row["longitude"])
            c_sst_val = float(row["sst"]) if pd.notna(row["sst"]) else None
            c_current_val = float(row["current_speed"])
            c_distance = float(row["distance"])

            sst_var = EnvironmentalVariable(
                value=round(c_sst_val, 2) if c_sst_val is not None else None,
                unit="°C",
                availability=DataAvailability.AVAILABLE if c_sst_val is not None else DataAvailability.UNAVAILABLE,
            )
            current_var = EnvironmentalVariable(
                value=round(c_current_val, 3),
                unit="m/s",
                availability=DataAvailability.AVAILABLE,
            )

            # Get risk at candidate location (smaller radius for point assessment)
            risk = self._get_risk_assessment(c_lat, c_lon, radius_km=30.0)

            classification, final_score, factors = self._compute_suitability(
                sst_var, current_var, risk
            )

            # Small proximity bonus (max 5% of score) — closer is slightly preferred
            proximity_bonus = max(0, 1 - c_distance / search_radius) * 0.05
            adjusted_score = min(1.0, final_score + proximity_bonus)

            scored_candidates.append({
                "latitude": c_lat,
                "longitude": c_lon,
                "distance": c_distance,
                "sst": c_sst_val,
                "current_speed": c_current_val,
                "final_score": round(adjusted_score, 3),
                "classification": classification,
                "factors": factors,
                "risk": risk,
            })

        if not scored_candidates:
            return None

        # Sort by final score descending
        scored_candidates.sort(key=lambda c: c["final_score"], reverse=True)
        best = scored_candidates[0]

        if best["final_score"] < SUITABILITY_MODERATE_THRESHOLD:
            return None

        # Build explanation
        reasons = []
        if best["sst"] is not None:
            if SST_FISHING_OPTIMAL_MIN <= best["sst"] <= SST_FISHING_OPTIMAL_MAX:
                reasons.append(f"optimal SST ({best['sst']:.1f}°C)")
            else:
                reasons.append(f"SST {best['sst']:.1f}°C")
        if best["current_speed"] <= CURRENT_SPEED_FAVORABLE_MAX:
            reasons.append(f"calm currents ({best['current_speed']:.2f} m/s)")
        elif best["current_speed"] <= CURRENT_SPEED_MODERATE_MAX:
            reasons.append(f"moderate currents ({best['current_speed']:.2f} m/s)")

        risk = best["risk"]
        if risk.affected_locations == 0:
            reasons.append("no anomalies detected")
        elif risk.has_high:
            reasons.append(f"caution: {risk.high_location_count} HIGH anomaly location(s) nearby")
        elif risk.warning_location_count > 0:
            reasons.append(f"{risk.warning_location_count} WARNING anomaly location(s) noted")

        return FishingZoneRecommendation(
            latitude=round(best["latitude"], 4),
            longitude=round(best["longitude"], 4),
            distance_km=round(best["distance"], 1),
            suitability=best["classification"],
            suitability_score=best["final_score"],
            reason=", ".join(reasons) if reasons else "Best available conditions in search area",
        )

    # ------------------------------------------------------------------
    # Public API methods
    # ------------------------------------------------------------------

    def get_intelligence(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 50.0,
        date: Optional[datetime] = None,
    ) -> FishermanIntelligenceResponse:
        now = datetime.now(timezone.utc)
        nearby = self._get_nearby_data(latitude, longitude, radius_km)
        surface = self._get_surface_data(nearby)

        data_freshness = None
        if not surface.empty and "timestamp" in surface.columns:
            latest = pd.to_datetime(surface["timestamp"]).max()
            data_freshness = round((now - latest.tz_localize(timezone.utc)).total_seconds() / 3600, 1)

        sst = self._compute_sst(surface)
        salinity = self._compute_salinity(surface)
        current_speed, current_direction = self._compute_current(surface)
        sea_level = self._compute_sea_level(surface)

        chlorophyll = EnvironmentalVariable(
            unit="mg/m³",
            availability=DataAvailability.UNAVAILABLE,
            description="Chlorophyll-a not yet integrated. Future: Sentinel-3/MODIS satellite data.",
        )
        wave_height = EnvironmentalVariable(
            unit="m",
            availability=DataAvailability.UNAVAILABLE,
            description="Wave height not available in current dataset. Future: wave model integration.",
        )

        risk = self._get_risk_assessment(latitude, longitude, radius_km)
        anomaly_count, anomaly_warnings = self._get_anomaly_warnings(
            latitude, longitude, radius_km
        )

        suitability, score, factors = self._compute_suitability(
            sst, current_speed, risk
        )
        sea_condition = self._compute_sea_condition(current_speed)
        recommended = self._find_recommended_zone(latitude, longitude, radius_km)

        source = (
            "Copernicus Marine + Argo"
            if "copernicus" in self._data_source.lower()
            else "Prototype Ocean Model + Argo"
        )

        return FishermanIntelligenceResponse(
            latitude=latitude,
            longitude=longitude,
            timestamp=now,
            data_freshness_hours=data_freshness,
            suitability=suitability,
            suitability_score=score,
            suitability_factors=factors,
            sst=sst,
            salinity=salinity,
            current_speed=current_speed,
            current_direction=current_direction,
            sea_level=sea_level,
            chlorophyll=chlorophyll,
            wave_height=wave_height,
            sea_condition=sea_condition,
            anomaly_count=anomaly_count,
            anomaly_warnings=anomaly_warnings,
            recommended_zone=recommended,
            coastal_alerts=[],
            data_source=source,
        )

    def get_sea_conditions(
        self, latitude: float, longitude: float, radius_km: float = 50.0
    ) -> SeaConditionsResponse:
        now = datetime.now(timezone.utc)
        nearby = self._get_nearby_data(latitude, longitude, radius_km)
        surface = self._get_surface_data(nearby)

        data_freshness = None
        if not surface.empty and "timestamp" in surface.columns:
            latest = pd.to_datetime(surface["timestamp"]).max()
            data_freshness = round((now - latest.tz_localize(timezone.utc)).total_seconds() / 3600, 1)

        sst = self._compute_sst(surface)
        salinity = self._compute_salinity(surface)
        current_speed, current_direction = self._compute_current(surface)
        sea_level = self._compute_sea_level(surface)
        wave_height = EnvironmentalVariable(
            unit="m",
            availability=DataAvailability.UNAVAILABLE,
            description="Wave height not available in current dataset.",
        )

        anomaly_count, warnings = self._get_anomaly_warnings(latitude, longitude, radius_km)
        sea_condition = self._compute_sea_condition(current_speed)

        source = (
            "Copernicus Marine + Argo"
            if "copernicus" in self._data_source.lower()
            else "Prototype Ocean Model + Argo"
        )

        return SeaConditionsResponse(
            latitude=latitude,
            longitude=longitude,
            timestamp=now,
            data_freshness_hours=data_freshness,
            sst=sst,
            salinity=salinity,
            current_speed=current_speed,
            current_direction=current_direction,
            sea_level=sea_level,
            wave_height=wave_height,
            overall_condition=sea_condition,
            anomaly_count=anomaly_count,
            warnings=warnings,
            data_source=source,
        )

    def get_coastal_alerts(
        self, latitude: float, longitude: float, radius_km: float = 50.0
    ) -> CoastalAlertResponse:
        now = datetime.now(timezone.utc)
        anomaly_count, anomaly_warnings = self._get_anomaly_warnings(
            latitude, longitude, radius_km
        )

        alerts: list[CoastalAlert] = []

        if anomaly_count > 3:
            alerts.append(
                CoastalAlert(
                    alert_type="ocean_anomaly",
                    severity="warning",
                    message=f"{anomaly_count} ocean anomaly records detected within {radius_km} km. Environmental conditions may be unusual.",
                    source="Ocean Sentry ML Analysis",
                    verified=False,
                )
            )

        message = (
            "No verified coastal alert source is currently connected for this region. "
            "Ocean Sentry analytical warnings (based on ML anomaly detection) are shown if applicable. "
            "Future integration: INCOIS/IMD coastal warnings."
        )
        if alerts:
            message = f"{len(alerts)} analytical warning(s) detected. " + message

        return CoastalAlertResponse(
            latitude=latitude,
            longitude=longitude,
            timestamp=now,
            alerts=alerts,
            message=message,
            data_source="Ocean Sentry ML Analysis (not an official alert source)",
        )


fisherman_service = FishermanService()
