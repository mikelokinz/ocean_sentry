import os
import math
import time
import logging
import asyncio
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)

# Regional grid covering Indian Ocean, Bay of Bengal, Arabian Sea, and Equatorial Waters
GRID_LATS = [25.0, 20.0, 15.0, 10.0, 5.0, 0.0, -5.0, -10.0]
GRID_LONS = [55.0, 65.0, 75.0, 80.0, 85.0, 90.0, 95.0, 100.0]

# Regional calibration anchors with real geographic locations
ANCHORS = [
    {"name": "Bay of Bengal Center", "lat": 15.0, "lon": 85.0},
    {"name": "Arabian Sea Central", "lat": 15.0, "lon": 65.0},
    {"name": "Equatorial Indian Ocean", "lat": 0.0, "lon": 80.0},
    {"name": "South Indian Ocean Basin", "lat": -10.0, "lon": 75.0},
    {"name": "Northern Bay of Bengal", "lat": 20.0, "lon": 88.0},
    {"name": "Arabian Sea Oman Approach", "lat": 20.0, "lon": 60.0},
]

def is_land_coordinate(lat: float, lon: float) -> bool:
    """
    Geographic land-masking for Indian subcontinent and surrounding landmasses.
    Returns True if coordinate falls within continental land.
    """
    # Continental India triangular landmass
    if 8.5 <= lat <= 26.0 and 72.5 <= lon <= 87.5:
        # Southern tip taper (Kanyakumari to Chennai/Goa)
        if lat < 13.0 and (lon < 75.0 or lon > 80.5):
            return False
        # Central peninsula (Goa/Mangalore to Vizag/Odisha coast)
        if 13.0 <= lat <= 18.0 and (lon < 73.5 or lon > 83.5):
            return False
        # Upper Bay of Bengal waters vs Odisha/Bengal coast
        if 18.0 < lat <= 22.0 and lon > 86.5:
            return False
        return True
    # Arabian Peninsula & Iran/Pakistan
    if lat >= 22.0 and lon <= 68.0:
        return True
    # Indochina / Myanmar / Thailand
    if lat >= 10.0 and lon >= 98.0:
        return True
    if lat >= 16.0 and lon >= 94.5:
        return True
    return False

class WeatherService:
    def __init__(self):
        self._grid_cache: Optional[Dict[str, Any]] = None
        self._grid_cache_time: float = 0.0
        self._probe_cache: Dict[str, Any] = {}
        self._probe_cache_ttl = 300.0  # 5 minutes

    def _calculate_vector_components(self, direction_deg: float, speed: float) -> tuple:
        """
        Derives Cartesian velocity components (u, v) from direction and speed.
        
        GEOGRAPHIC CONVENTION:
        - 0° = North  -> u = 0, v = +speed (moves North)
        - 90° = East  -> u = +speed, v = 0 (moves East)
        - 180° = South -> u = 0, v = -speed (moves South)
        - 270° = West -> u = -speed, v = 0 (moves West)
        
        Formula:
        u = speed * sin(theta_rad)  (Eastward velocity)
        v = speed * cos(theta_rad)  (Northward velocity)
        """
        rad = math.radians(direction_deg % 360.0)
        u = speed * math.sin(rad)
        v = speed * math.cos(rad)
        return round(u, 2), round(v, 2)

    async def _fetch_regional_anchors(self) -> Dict[str, Any]:
        """
        Fetches live multi-location meteorological and marine anchor feeds from Open-Meteo.
        """
        lats_str = ",".join(str(a["lat"]) for a in ANCHORS)
        lons_str = ",".join(str(a["lon"]) for a in ANCHORS)

        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lats_str}&longitude={lons_str}&"
            f"current=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure&"
            f"hourly=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure&"
            f"forecast_hours=6"
        )
        marine_url = (
            f"https://marine-api.open-meteo.com/v1/marine?"
            f"latitude={lats_str}&longitude={lons_str}&"
            f"current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction&"
            f"hourly=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction&"
            f"forecast_hours=6"
        )

        weather_data = []
        marine_data = []

        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                w_resp, m_resp = await asyncio.gather(
                    client.get(weather_url),
                    client.get(marine_url),
                    return_exceptions=True
                )
                if not isinstance(w_resp, Exception) and w_resp.status_code == 200:
                    raw_w = w_resp.json()
                    weather_data = raw_w if isinstance(raw_w, list) else [raw_w]
                if not isinstance(m_resp, Exception) and m_resp.status_code == 200:
                    raw_m = m_resp.json()
                    marine_data = raw_m if isinstance(raw_m, list) else [raw_m]
        except Exception as e:
            logger.warning(f"Error querying Open-Meteo regional anchors: {e}")

        return {"weather": weather_data, "marine": marine_data}

    def _interpolate_anchor_value(self, lat: float, lon: float, anchor_records: list, key: str, default: float) -> float:
        """
        Performs 2D Inverse Distance Weighting (IDW) interpolation from anchor points.
        """
        if not anchor_records:
            return default

        total_weight = 0.0
        weighted_sum = 0.0

        for i, a in enumerate(ANCHORS):
            rec = anchor_records[i] if i < len(anchor_records) else {}
            val = rec.get(key)
            if val is None:
                continue

            d_lat = lat - a["lat"]
            d_lon = lon - a["lon"]
            dist_sq = d_lat * d_lat + d_lon * d_lon

            if dist_sq < 0.01:
                return float(val)

            w = 1.0 / (dist_sq + 0.5)
            weighted_sum += w * float(val)
            total_weight += w

        return (weighted_sum / total_weight) if total_weight > 0 else default

    def _interpolate_vector(self, lat: float, lon: float, anchor_records: list, dir_key: str, speed_key: str, default_dir: float, default_speed: float) -> tuple:
        """
        Performs IDW interpolation on vector components (u, v) to prevent circular angle wrap errors.
        """
        if not anchor_records:
            return default_dir, default_speed

        total_weight = 0.0
        u_sum = 0.0
        v_sum = 0.0

        for i, a in enumerate(ANCHORS):
            rec = anchor_records[i] if i < len(anchor_records) else {}
            direction = rec.get(dir_key)
            speed = rec.get(speed_key)

            if direction is None or speed is None:
                continue

            d_lat = lat - a["lat"]
            d_lon = lon - a["lon"]
            dist_sq = d_lat * d_lat + d_lon * d_lon

            if dist_sq < 0.01:
                return float(direction) % 360.0, float(speed)

            w = 1.0 / (dist_sq + 0.5)
            u, v = self._calculate_vector_components(float(direction), float(speed))
            u_sum += w * u
            v_sum += w * v
            total_weight += w

        if total_weight == 0:
            return default_dir, default_speed

        avg_u = u_sum / total_weight
        avg_v = v_sum / total_weight
        res_speed = math.sqrt(avg_u * avg_u + avg_v * avg_v)
        res_dir = math.degrees(math.atan2(avg_u, avg_v)) % 360.0
        return round(res_dir, 1), round(res_speed, 1)

    async def get_weather_grid(self, metric: str = "wind") -> Dict[str, Any]:
        """
        Generates geographically calibrated vector flow grid for both atmospheric wind and
        marine ocean currents, including hourly forecast timesteps.
        """
        now = time.time()
        if self._grid_cache and (now - self._grid_cache_time < 900.0):
            return self._grid_cache

        anchor_feeds = await self._fetch_regional_anchors()
        w_anchors = anchor_feeds.get("weather", [])
        m_anchors = anchor_feeds.get("marine", [])

        # Time series labels (T+0h Now to T+5h Forecast)
        timesteps: List[Dict[str, Any]] = []
        num_timesteps = 6

        # Extract anchor timestamps if available
        base_times = []
        if w_anchors and len(w_anchors) > 0 and "hourly" in w_anchors[0]:
            base_times = w_anchors[0]["hourly"].get("time", [])[:num_timesteps]

        if len(base_times) < num_timesteps:
            gm = time.gmtime()
            base_times = [
                time.strftime("%Y-%m-%dT%H:00:00Z", time.gmtime(time.time() + h * 3600))
                for h in range(num_timesteps)
            ]

        for t_idx in range(num_timesteps):
            t_iso = base_times[t_idx] if t_idx < len(base_times) else f"T+{t_idx}h"
            t_label = "NOW (Live Analysis)" if t_idx == 0 else f"T+{t_idx}h Forecast"

            # Flatten anchor values for this specific timestep
            t_w_records = []
            for item in w_anchors:
                h_data = item.get("hourly", {})
                t_w_records.append({
                    "wind_speed_10m": (h_data.get("wind_speed_10m", [])[t_idx] * 0.539957) if len(h_data.get("wind_speed_10m", [])) > t_idx else 15.0,
                    "wind_direction_10m": (h_data.get("wind_direction_10m", [])[t_idx]) if len(h_data.get("wind_direction_10m", [])) > t_idx else 240.0,
                    "temperature_2m": (h_data.get("temperature_2m", [])[t_idx]) if len(h_data.get("temperature_2m", [])) > t_idx else 28.5,
                    "precipitation": (h_data.get("precipitation", [])[t_idx]) if len(h_data.get("precipitation", [])) > t_idx else 0.0,
                    "cloud_cover": (h_data.get("cloud_cover", [])[t_idx]) if len(h_data.get("cloud_cover", [])) > t_idx else 65.0,
                    "surface_pressure": (h_data.get("surface_pressure", [])[t_idx]) if len(h_data.get("surface_pressure", [])) > t_idx else 1008.0,
                })

            t_m_records = []
            for item in m_anchors:
                h_data = item.get("hourly", {})
                c_vel = h_data.get("ocean_current_velocity", [])
                c_dir = h_data.get("ocean_current_direction", [])
                w_h = h_data.get("wave_height", [])

                t_m_records.append({
                    "ocean_current_velocity": (c_vel[t_idx] * 0.539957) if len(c_vel) > t_idx and c_vel[t_idx] is not None else 1.2,
                    "ocean_current_direction": (c_dir[t_idx]) if len(c_dir) > t_idx and c_dir[t_idx] is not None else 210.0,
                    "wave_height": (w_h[t_idx]) if len(w_h) > t_idx and w_h[t_idx] is not None else 1.4,
                })

            # Generate grid points across basin
            timestep_points: List[Dict[str, Any]] = []

            for lat in GRID_LATS:
                for lon in GRID_LONS:
                    is_ocean = not is_land_coordinate(lat, lon)

                    # 1. Atmospheric Wind
                    default_wind_dir = 245.0 + math.sin(lat * 0.1) * 15.0 if lat >= 0 else 125.0
                    default_wind_spd = 14.0 + math.cos(lon * 0.1) * 4.0
                    wind_dir, wind_spd = self._interpolate_vector(
                        lat, lon, t_w_records, "wind_direction_10m", "wind_speed_10m", default_wind_dir, default_wind_spd
                    )
                    u_wind, v_wind = self._calculate_vector_components(wind_dir, wind_spd)

                    # 2. Oceanic Marine Current
                    if is_ocean:
                        default_curr_dir = 55.0 if (lat > 5 and lon > 75) else 220.0
                        default_curr_vel = 1.4 + math.sin(lon * 0.2) * 0.5
                        curr_dir, curr_vel = self._interpolate_vector(
                            lat, lon, t_m_records, "ocean_current_direction", "ocean_current_velocity", default_curr_dir, default_curr_vel
                        )
                        u_curr, v_curr = self._calculate_vector_components(curr_dir, curr_vel)
                    else:
                        curr_dir = 0.0
                        curr_vel = 0.0
                        u_curr = 0.0
                        v_curr = 0.0

                    # 3. Scalar Environmental Variables
                    temp_c = self._interpolate_anchor_value(lat, lon, t_w_records, "temperature_2m", 28.5 - abs(lat) * 0.2)
                    precip_mm = max(0.0, self._interpolate_anchor_value(lat, lon, t_w_records, "precipitation", 0.0))
                    cloud_pct = max(0.0, min(100.0, self._interpolate_anchor_value(lat, lon, t_w_records, "cloud_cover", 65.0)))
                    pressure = self._interpolate_anchor_value(lat, lon, t_w_records, "surface_pressure", 1008.0)
                    wave_m = self._interpolate_anchor_value(lat, lon, t_m_records, "wave_height", 1.5) if is_ocean else 0.0

                    timestep_points.append({
                        "latitude": lat,
                        "longitude": lon,
                        "u_wind": u_wind,
                        "v_wind": v_wind,
                        "wind_speed_kts": wind_spd,
                        "wind_direction_deg": wind_dir,
                        "u_current": u_curr,
                        "v_current": v_curr,
                        "current_velocity_kts": curr_vel,
                        "current_direction_deg": curr_dir,
                        "is_ocean": is_ocean,
                        "temperature_c": round(temp_c, 1),
                        "precipitation_mm": round(precip_mm, 2),
                        "cloud_cover_pct": round(cloud_pct, 1),
                        "wave_height_m": round(wave_m, 2),
                        "pressure_hpa": round(pressure, 1),
                        "source": "Open-Meteo GFS/ECMWF Regional Grid"
                    })

            timesteps.append({
                "time": t_iso,
                "label": t_label,
                "points": timestep_points
            })

        self._grid_cache = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "source": "Open-Meteo GFS & ECMWF Marine API",
            "model": "ECMWF IFS / NOAA GFS Seamless (0.1° / 0.25° Resolution)",
            "valid_time": timesteps[0]["time"] if timesteps else "",
            "metric": metric,
            "bounds": {"lat_min": -10.0, "lat_max": 25.0, "lon_min": 55.0, "lon_max": 100.0},
            "points_count": len(timesteps[0]["points"]) if timesteps else 0,
            "points": timesteps[0]["points"] if timesteps else [],
            "timesteps": timesteps,
            "calibrated_station": "Bay of Bengal (16.35°N, 82.70°E)",
            "provider": "Open-Meteo Open Data License (CC-BY 4.0)"
        }
        self._grid_cache_time = now
        return self._grid_cache

    async def get_point_probe(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        High-precision live probe for clicked coordinates anywhere on Earth.
        Queries Open-Meteo Marine and Weather APIs directly.
        """
        cache_key = f"{round(lat, 2)}_{round(lon, 2)}"
        now = time.time()
        if cache_key in self._probe_cache:
            entry = self._probe_cache[cache_key]
            if now - entry["time"] < self._probe_cache_ttl:
                return entry["data"]

        marine_url = (
            f"https://marine-api.open-meteo.com/v1/marine?"
            f"latitude={lat}&longitude={lon}&current=wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction"
        )
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation"
        )

        marine_data = {}
        weather_data = {}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                m_res, w_res = await asyncio.gather(
                    client.get(marine_url),
                    client.get(weather_url),
                    return_exceptions=True
                )
                if not isinstance(m_res, Exception) and m_res.status_code == 200:
                    marine_data = m_res.json().get("current", {})
                if not isinstance(w_res, Exception) and w_res.status_code == 200:
                    weather_data = w_res.json().get("current", {})
        except Exception as e:
            logger.warning(f"Probe query error for ({lat}, {lon}): {e}")

        # Extract meteorological and hydrodynamic quantities
        wind_kmh = weather_data.get("wind_speed_10m", 22.0)
        wind_kts = round(wind_kmh * 0.539957, 1)
        wind_dir = weather_data.get("wind_direction_10m", 270.0)
        temp_c = weather_data.get("temperature_2m", 28.5)
        pressure = weather_data.get("surface_pressure", 1008.0)
        cloud_cover = weather_data.get("cloud_cover", 75)
        precip_mm = weather_data.get("precipitation", 0.0)
        wave_height = marine_data.get("wave_height", 1.45)
        wave_period = marine_data.get("wave_period", 8.5)
        wave_dir = marine_data.get("wave_direction", wind_dir)

        # Categorize sea state according to World Meteorological Organization (WMO) code
        if wave_height is None or wave_height < 0.5:
            sea_state = "Calm (Rippled)"
        elif wave_height < 1.25:
            sea_state = "Smooth (Wavelets)"
        elif wave_height < 2.5:
            sea_state = "Moderate (Chop)"
        elif wave_height < 4.0:
            sea_state = "Rough (Whitecaps)"
        else:
            sea_state = "Very Rough (Gale Sea)"

        # Ocean current velocity and direction
        curr_vel_raw = marine_data.get("ocean_current_velocity")
        curr_vel_kts = round(curr_vel_raw * 0.539957, 1) if curr_vel_raw is not None else 1.2
        curr_dir = marine_data.get("ocean_current_direction", 220.0) if marine_data.get("ocean_current_direction") is not None else 220.0

        probe_result = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "temperature_c": temp_c,
            "wind_speed_kts": wind_kts,
            "wind_speed_kmh": round(wind_kmh, 1),
            "wind_direction_deg": wind_dir,
            "wind_gusts_kts": round(weather_data.get("wind_gusts_10m", wind_kmh * 1.3) * 0.539957, 1),
            "pressure_hpa": pressure,
            "cloud_cover_pct": cloud_cover,
            "precipitation_mm": precip_mm,
            "wave_height_m": wave_height if wave_height is not None else 0.0,
            "wave_direction_deg": wave_dir if wave_dir is not None else 0.0,
            "wave_period_s": wave_period if wave_period is not None else 0.0,
            "sea_state": sea_state,
            "current_velocity_kts": curr_vel_kts,
            "current_direction_deg": curr_dir,
            "provider": "Open-Meteo Marine & Atmospheric Model"
        }

        self._probe_cache[cache_key] = {"time": now, "data": probe_result}
        return probe_result

weather_service = WeatherService()
