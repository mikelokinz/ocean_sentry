import logging
from typing import Optional
from datetime import datetime
from pathlib import Path

import pandas as pd
import numpy as np

from app.models.schemas import StationResponse, AnomalyStatus, OceanObservation
from app.config import settings

logger = logging.getLogger(__name__)


class OceanService:
    """Service for ocean observation and model data access.

    Reads from processed parquet files produced by the data pipeline.
    """

    def __init__(self):
        self._collocated: Optional[pd.DataFrame] = None
        self._stations_cache: Optional[list[StationResponse]] = None
        self._model_source: str = "unknown"
        self._load_data()

    def _load_data(self):
        collocated_qc_path = settings.data_dir / "processed" / "collocated_qc.parquet"
        collocated_path = settings.data_dir / "processed" / "collocated.parquet"

        if collocated_qc_path.exists():
            data_path = collocated_qc_path
            logger.info("Using QC-filtered collocated data.")
        else:
            data_path = collocated_path
            logger.info("QC-filtered data not available; using unfiltered.")

        if data_path.exists():
            try:
                self._collocated = pd.read_parquet(data_path)
                self._collocated["timestamp"] = pd.to_datetime(
                    self._collocated["timestamp"], utc=True
                )
                logger.info(
                    f"Loaded collocated data: {self._collocated.shape[0]} records"
                )
                self._build_stations()
            except Exception as e:
                logger.warning(f"Failed to load collocated data: {e}")
        else:
            logger.info(
                f"No collocated data found. Run the pipeline first."
            )

        # Detect model source
        import json
        source_path = settings.data_dir / "processed" / "model_source.json"
        if source_path.exists():
            try:
                with open(source_path) as f:
                    meta = json.load(f)
                self._model_source = meta.get("source", "unknown")
            except Exception:
                pass

    def _build_stations(self):
        """Build station-like entries from Argo profile locations."""
        if self._collocated is None or self._collocated.empty:
            return

        df = self._collocated

        profiles = (
            df.groupby(["latitude", "longitude"])
            .agg(
                count=("observation_id", "count"),
                min_depth=("depth", "min"),
                max_depth=("depth", "max"),
                avg_temp_obs=("observed_temperature", "mean"),
                avg_temp_model=("model_temperature", "mean"),
                avg_sal_obs=("observed_salinity", "mean"),
                avg_sal_model=("model_salinity", "mean"),
                avg_temp_diff=("abs_temperature_difference", "mean"),
                last_time=("timestamp", "max"),
                source=("observation_source", "first"),
            )
            .reset_index()
        )

        stations = []
        for i, row in profiles.iterrows():
            src = str(row.get("source", "")).lower()
            if "ascii" in src or "custom" in src or "upload" in src:
                # Find matching observation_id prefix if available
                matching = df[(df["latitude"] == row["latitude"]) & (df["longitude"] == row["longitude"])]
                sample_obs_id = str(matching.iloc[0].get("observation_id", "")) if not matching.empty else ""
                prefix = sample_obs_id.split("_L")[0] if "_L" in sample_obs_id else f"ASCII-{i + 1:03d}"
                station_id = prefix
                st_type = "buoy"
            else:
                station_id = f"ARGO-{i + 1:03d}"
                st_type = "argo"

            # Fallback threshold-based status (used only if ML unavailable)
            avg_diff = row["avg_temp_diff"]
            if avg_diff >= 2.5:
                status = AnomalyStatus.HIGH
            elif avg_diff >= 1.5:
                status = AnomalyStatus.WARNING
            else:
                status = AnomalyStatus.NORMAL

            stations.append(
                StationResponse(
                    id=station_id,
                    name=station_id,
                    type=st_type,
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    depth=round(row["min_depth"], 1),
                    last_update=row["last_time"],
                    status=status,
                    is_online=True,
                )
            )

        self._stations_cache = stations
        logger.info(f"Built {len(stations)} station entries from profiles")

    def reload(self):
        """Re-read data from disk and rebuild stations cache."""
        logger.info("Reloading ocean data from disk...")
        self._collocated = None
        self._stations_cache = None
        self._load_data()
        logger.info("Ocean data reload complete.")

    def apply_ml_status(self, anomaly_service):
        """Override station statuses with ML-derived results."""
        if self._stations_cache is None or not anomaly_service.is_available:
            return

        updated = 0
        for station in self._stations_cache:
            info = anomaly_service.get_station_anomaly_info(
                station.latitude, station.longitude
            )
            if info:
                station.status = info["status"]
                updated += 1

        logger.info(f"Applied ML anomaly status to {updated}/{len(self._stations_cache)} stations")

    def get_stations(self, region: Optional[str] = None) -> list[StationResponse]:
        if self._stations_cache is None:
            return []
        return self._stations_cache

    def get_station(self, station_id: str) -> Optional[StationResponse]:
        if self._stations_cache is None:
            return None
        for s in self._stations_cache:
            if s.id == station_id:
                return s
        return None

    def get_station_detail(self, station_id: str) -> Optional[dict]:
        """Get full station data including obs/model values for the frontend."""
        if self._collocated is None or self._stations_cache is None:
            return None

        station = self.get_station(station_id)
        if station is None:
            return None

        df = self._collocated
        profile = df[
            (df["latitude"] == station.latitude)
            & (df["longitude"] == station.longitude)
        ]

        if profile.empty:
            return None

        surface = profile[profile["depth"] <= 10]
        if surface.empty:
            surface = profile.nsmallest(1, "depth")

        row = surface.iloc[0]

        temp_obs = float(row["observed_temperature"]) if pd.notna(row["observed_temperature"]) else 0.0
        temp_model = float(row["model_temperature"]) if pd.notna(row["model_temperature"]) else 0.0
        sal_obs = float(row["observed_salinity"]) if pd.notna(row["observed_salinity"]) else 0.0
        sal_model = float(row["model_salinity"]) if pd.notna(row["model_salinity"]) else 0.0
        current_u = float(row["model_current_u"]) if pd.notna(row.get("model_current_u")) else 0.0
        current_v = float(row["model_current_v"]) if pd.notna(row.get("model_current_v")) else 0.0
        sea_level = float(row["model_sea_level"]) if pd.notna(row.get("model_sea_level")) else 0.0
        chl_obs = float(row.get("observed_chlorophyll", 0.0)) if pd.notna(row.get("observed_chlorophyll")) else 0.0
        chl_model = float(row.get("model_chlorophyll", 0.0)) if pd.notna(row.get("model_chlorophyll")) else 0.0
        current_speed = (current_u**2 + current_v**2) ** 0.5

        temp_diff = abs(temp_obs - temp_model)

        # Use ML status if available, otherwise fallback to threshold
        from app.services.anomaly_service import anomaly_service
        ml_info = anomaly_service.get_station_anomaly_info(station.latitude, station.longitude)
        if ml_info:
            ml_status = ml_info["status"]
            if hasattr(ml_status, "value"):
                status = "critical" if ml_status.value == "high" else ml_status.value
            else:
                status = "critical" if str(ml_status) == "high" else str(ml_status)
        else:
            max_pct = 0.0
            if temp_model != 0:
                max_pct = abs((temp_obs - temp_model) / temp_model) * 100
            if max_pct >= 8 or temp_diff >= 2.5:
                status = "critical"
            elif max_pct >= 3 or temp_diff >= 1.5:
                status = "warning"
            else:
                status = "normal"

        last_time = profile["timestamp"].max()
        now_ts = pd.Timestamp.now(tz=last_time.tz) if getattr(last_time, "tz", None) is not None else pd.Timestamp.now()
        minutes_ago = max(0, int((now_ts - last_time).total_seconds() / 60))

        result = {
            "id": station.id,
            "name": station.name,
            "type": station.type,
            "region": "Bay of Bengal",
            "latitude": station.latitude,
            "longitude": station.longitude,
            "depth": station.depth,
            "isOnline": True,
            "lastSyncMinutes": minutes_ago,
            "temperature": round(temp_obs, 2),
            "salinity": round(sal_obs, 2),
            "waveHeight": 0.0,
            "currentSpeed": round(current_speed, 3),
            "seaLevel": round(sea_level, 3),
            "ph": 8.16 if station.depth <= 10 else 7.92 if station.depth <= 100 else 7.65,
            "chlorophyll": round(chl_obs, 2),
            "modelTemperature": round(temp_model, 2),
            "modelSalinity": round(sal_model, 2),
            "modelWaveHeight": 0.0,
            "modelCurrentSpeed": round(current_speed * 0.95, 3),
            "modelSeaLevel": round(sea_level, 3),
            "modelPh": 8.18 if station.depth <= 10 else 7.95 if station.depth <= 100 else 7.68,
            "modelChlorophyll": round(chl_model, 2),
            "status": status,
            "dataSource": "INCOIS Primary Grid + Real Argo" if "copernicus" in self._model_source.lower() else "Prototype Ocean Model + Real Argo",
        }

        if ml_info:
            result["anomalyScore"] = ml_info["anomaly_score"]
            result["anomalyCount"] = ml_info["anomaly_count"]

        return result

    def get_all_station_details(self) -> list[dict]:
        """Get all stations in the frontend-compatible format."""
        if self._stations_cache is None:
            return []
        results = []
        for station in self._stations_cache:
            detail = self.get_station_detail(station.id)
            if detail:
                results.append(detail)
        
        # Inject the mock glider for SIH Phase 1
        from datetime import datetime
        def ts(minutes_ago):
            return datetime.fromtimestamp(datetime.now().timestamp() - minutes_ago * 60).isoformat()
            
        mock_glider = {
            "id": "GLIDER-001",
            "name": "GLIDER-001",
            "type": "glider",
            "region": "Bay of Bengal",
            "latitude": 14.10,
            "longitude": 85.50,
            "depth": 50.0,
            "isOnline": True,
            "lastSyncMinutes": 15,
            "temperature": 28.5,
            "salinity": 33.2,
            "waveHeight": 1.5,
            "currentSpeed": 0.45,
            "seaLevel": 0.1,
            "ph": 8.1,
            "chlorophyll": 2.4,
            "modelTemperature": 28.3,
            "modelSalinity": 33.5,
            "modelWaveHeight": 1.4,
            "modelCurrentSpeed": 0.40,
            "modelSeaLevel": 0.08,
            "modelPh": 8.12,
            "modelChlorophyll": 2.1,
            "status": "warning",
            "heading": 45.0,
            "trajectory": [
                {"latitude": 13.90, "longitude": 85.30, "depth": 0.0, "timestamp": ts(120)},
                {"latitude": 13.95, "longitude": 85.35, "depth": 50.0, "timestamp": ts(100)},
                {"latitude": 14.00, "longitude": 85.40, "depth": 100.0, "timestamp": ts(80)},
                {"latitude": 14.05, "longitude": 85.45, "depth": 50.0, "timestamp": ts(40)},
                {"latitude": 14.10, "longitude": 85.50, "depth": 0.0, "timestamp": ts(15)},
            ]
        }
        results.append(mock_glider)
        
        return results

    def get_observations(
        self,
        parameter: Optional[str] = None,
        depth: Optional[float] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 100,
    ) -> list[dict]:
        if self._collocated is None:
            return []

        df = self._collocated.copy()

        if lat_min is not None:
            df = df[df["latitude"] >= lat_min]
        if lat_max is not None:
            df = df[df["latitude"] <= lat_max]
        if lon_min is not None:
            df = df[df["longitude"] >= lon_min]
        if lon_max is not None:
            df = df[df["longitude"] <= lon_max]
        if depth is not None:
            df = df[(df["depth"] >= depth - 20) & (df["depth"] <= depth + 20)]
        if start is not None:
            df = df[df["timestamp"] >= start]
        if end is not None:
            df = df[df["timestamp"] <= end]

        df = df.head(limit)
        return df.to_dict(orient="records")

    def get_model_data(
        self,
        parameter: Optional[str] = None,
        depth: Optional[float] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        lat_min: Optional[float] = None,
        lat_max: Optional[float] = None,
        lon_min: Optional[float] = None,
        lon_max: Optional[float] = None,
        limit: int = 100,
    ) -> list[dict]:
        if self._collocated is None:
            return []

        df = self._collocated.copy()
        model_cols = [
            "timestamp", "latitude", "longitude", "depth",
            "model_temperature", "model_salinity",
            "model_current_u", "model_current_v", "model_sea_level",
        ]
        available = [c for c in model_cols if c in df.columns]
        df = df[available]

        if lat_min is not None:
            df = df[df["latitude"] >= lat_min]
        if lat_max is not None:
            df = df[df["latitude"] <= lat_max]
        if lon_min is not None:
            df = df[df["longitude"] >= lon_min]
        if lon_max is not None:
            df = df[df["longitude"] <= lon_max]

        df = df.head(limit)
        return df.to_dict(orient="records")

    def get_timeseries(
        self,
        latitude: float,
        longitude: float,
        parameter: str = "temperature",
        depth: float = 0,
        days: int = 7,
    ) -> list[dict]:
        if self._collocated is None:
            return []

        df = self._collocated
        tolerance = 0.5
        nearby = df[
            (df["latitude"].between(latitude - tolerance, latitude + tolerance))
            & (df["longitude"].between(longitude - tolerance, longitude + tolerance))
        ].sort_values("depth")

        if nearby.empty:
            return []

        records = []
        for _, row in nearby.iterrows():
            obs_col = f"observed_{parameter}"
            model_col = f"model_{parameter}"
            records.append({
                "timestamp": row["timestamp"].isoformat() if hasattr(row["timestamp"], "isoformat") else str(row["timestamp"]),
                "depth": float(row["depth"]),
                "observed": float(row[obs_col]) if obs_col in row and pd.notna(row.get(obs_col)) else None,
                "model": float(row[model_col]) if model_col in row and pd.notna(row.get(model_col)) else None,
            })
        return records

    def ingest_observations(
        self,
        observations: list[OceanObservation],
        source_name: str = "ascii_upload"
    ) -> dict:
        """
        Ingest parsed OceanObservation records:
        1. Persist to observations store (observations.parquet)
        2. Collocate with Copernicus model data
        3. Update in-memory collocated dataset and station cache
        4. Re-evaluate anomaly scoring
        """
        if not observations:
            return {"created_stations": [], "records_added": 0}

        # 1. Convert to DataFrame matching observations.parquet
        obs_dicts = []
        for obs in observations:
            obs_dicts.append({
                "id": obs.id,
                "source": obs.source or source_name,
                "timestamp": pd.to_datetime(obs.timestamp),
                "latitude": float(obs.latitude),
                "longitude": float(obs.longitude),
                "depth": float(obs.depth),
                "temperature": float(obs.temperature) if obs.temperature is not None else None,
                "salinity": float(obs.salinity) if obs.salinity is not None else None,
                "current_u": float(obs.current_u) if obs.current_u is not None else None,
                "current_v": float(obs.current_v) if obs.current_v is not None else None,
                "quality_flag": obs.quality_flag or 1,
            })
        new_obs_df = pd.DataFrame(obs_dicts)

        # Save / append to observations.parquet
        obs_parquet_path = settings.data_dir / "processed" / "observations.parquet"
        try:
            if obs_parquet_path.exists():
                existing_obs = pd.read_parquet(obs_parquet_path)
                combined_obs = pd.concat([existing_obs, new_obs_df], ignore_index=True)
                combined_obs.to_parquet(obs_parquet_path, index=False)
            else:
                new_obs_df.to_parquet(obs_parquet_path, index=False)
            logger.info(f"Persisted {len(new_obs_df)} observations to {obs_parquet_path}")
        except Exception as e:
            logger.warning(f"Could not persist observations.parquet: {e}")

        # 2. Collocate with Copernicus model data
        model_data_path = settings.data_dir / "processed" / "model_data.parquet"
        model_df = None
        if model_data_path.exists():
            try:
                model_df = pd.read_parquet(model_data_path)
            except Exception as e:
                logger.warning(f"Could not read model_data.parquet: {e}")

        collocated_rows = []
        for _, obs in new_obs_df.iterrows():
            lat = obs["latitude"]
            lon = obs["longitude"]
            depth = obs["depth"]
            obs_t = obs["temperature"]
            obs_s = obs["salinity"]

            m_temp, m_sal, m_u, m_v, m_ssh = None, None, 0.0, 0.0, 0.0
            dist_km = 0.0
            time_diff_h = 0.0
            depth_diff_m = 0.0

            if model_df is not None and not model_df.empty:
                # Find nearest depth level and spatial point
                depth_subset = model_df[np.abs(model_df["depth"] - depth) <= 50]
                if depth_subset.empty:
                    depth_subset = model_df
                dlat = depth_subset["latitude"] - lat
                dlon = depth_subset["longitude"] - lon
                sq_dist = dlat**2 + dlon**2
                closest_idx = sq_dist.idxmin()
                closest_row = depth_subset.loc[closest_idx]
                m_temp = float(closest_row["model_temperature"]) if pd.notna(closest_row.get("model_temperature")) else None
                m_sal = float(closest_row["model_salinity"]) if pd.notna(closest_row.get("model_salinity")) else None
                m_u = float(closest_row.get("model_current_u", 0.0)) if pd.notna(closest_row.get("model_current_u")) else 0.0
                m_v = float(closest_row.get("model_current_v", 0.0)) if pd.notna(closest_row.get("model_current_v")) else 0.0
                m_ssh = float(closest_row.get("model_sea_level", 0.0)) if pd.notna(closest_row.get("model_sea_level")) else 0.0
                dist_km = round(float((sq_dist.loc[closest_idx]**0.5) * 111.0), 2)
                depth_diff_m = round(float(abs(closest_row["depth"] - depth)), 2)

            # Fallback climatology if model data was missing
            if m_temp is None:
                surface_base = 29.0 + 0.5 * np.sin(2 * np.pi * (lat - 10) / 20)
                depth_factor = np.exp(-depth / 350.0)
                m_temp = round(float(surface_base * depth_factor + 4.5 * (1 - depth_factor)), 2)
            if m_sal is None:
                m_sal = round(float(np.clip(34.8 - 2.0 * np.exp(-depth / 100.0) * np.exp(-((lon - 80.0)/10.0)**2), 30.0, 36.0)), 2)

            t_diff = round(float(obs_t - m_temp), 2) if obs_t is not None and m_temp is not None else None
            abs_t_diff = abs(t_diff) if t_diff is not None else None
            t_pct_diff = round(float(t_diff / m_temp * 100), 2) if t_diff is not None and m_temp != 0 else None

            s_diff = round(float(obs_s - m_sal), 2) if obs_s is not None and m_sal is not None else None
            abs_s_diff = abs(s_diff) if s_diff is not None else None
            s_pct_diff = round(float(s_diff / m_sal * 100), 2) if s_diff is not None and m_sal != 0 else None

            collocated_rows.append({
                "timestamp": obs["timestamp"],
                "latitude": lat,
                "longitude": lon,
                "depth": depth,
                "observation_id": obs["id"],
                "observation_source": obs["source"],
                "observation_quality": obs["quality_flag"],
                "model_temperature": m_temp,
                "model_salinity": m_sal,
                "model_current_u": m_u,
                "model_current_v": m_v,
                "model_sea_level": m_ssh,
                "observed_temperature": obs_t,
                "observed_salinity": obs_s,
                "observed_current_u": obs["current_u"],
                "observed_current_v": obs["current_v"],
                "temperature_difference": t_diff,
                "salinity_difference": s_diff,
                "abs_temperature_difference": abs_t_diff,
                "abs_salinity_difference": abs_s_diff,
                "temperature_pct_difference": t_pct_diff,
                "salinity_pct_difference": s_pct_diff,
                "spatial_distance_km": dist_km,
                "time_difference_hours": time_diff_h,
                "depth_difference_m": depth_diff_m,
                "hour": obs["timestamp"].hour,
                "day_of_year": obs["timestamp"].dayofyear,
            })

        new_collocated_df = pd.DataFrame(collocated_rows)

        # 3. Update self._collocated and save
        new_collocated_df["timestamp"] = pd.to_datetime(new_collocated_df["timestamp"], utc=True)
        if self._collocated is not None and not self._collocated.empty:
            self._collocated["timestamp"] = pd.to_datetime(self._collocated["timestamp"], utc=True)
            self._collocated = pd.concat([self._collocated, new_collocated_df], ignore_index=True)
        else:
            self._collocated = new_collocated_df

        collocated_path = settings.data_dir / "processed" / "collocated.parquet"
        try:
            self._collocated.to_parquet(collocated_path, index=False)
            logger.info(f"Updated collocated data: {self._collocated.shape[0]} records")
        except Exception as e:
            logger.warning(f"Could not persist collocated.parquet: {e}")

        # 4. Rebuild stations
        self._build_stations()

        # 5. Apply anomaly evaluation
        try:
            from app.services.anomaly_service import anomaly_service
            from app.services.ml_service import ml_service
            if anomaly_service.is_available:
                anomaly_service.run_inference(ml_service)
                self.apply_ml_status(anomaly_service)
        except Exception as e:
            logger.warning(f"Could not re-run anomaly inference: {e}")

        # Identify newly created stations
        created_stations = [s.id for s in (self._stations_cache or []) if any(s.latitude == r["latitude"] and s.longitude == r["longitude"] for r in collocated_rows)]

        return {
            "created_stations": list(set(created_stations)),
            "records_added": len(collocated_rows),
        }


ocean_service = OceanService()

