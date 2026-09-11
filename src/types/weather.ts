export type GlobeMode = 'ocean-sentry' | 'weather-radar';

export type WeatherMetric = 'wind' | 'temperature' | 'waves' | 'pressure';

export interface WindGridPoint {
  latitude: number;
  longitude: number;
  u_wind: number;
  v_wind: number;
  wind_speed_kts: number;
  wind_direction_deg: number;
  temperature_c: number;
  wave_height_m: number;
  pressure_hpa: number;
  source?: string;
}

export interface WeatherCityPoint {
  name: string;
  latitude: number;
  longitude: number;
  temperature_c: number;
  country: string;
}

export interface WeatherGridResponse {
  timestamp: string;
  metric: string;
  bounds: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
  points_count: number;
  points: WindGridPoint[];
  cities?: WeatherCityPoint[];
  calibrated_station?: string;
  provider?: string;
}

export interface WeatherProbeData {
  latitude: number;
  longitude: number;
  timestamp: string;
  temperature_c: number;
  wind_speed_kts: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  wind_gusts_kts: number;
  pressure_hpa: number;
  cloud_cover_pct: number;
  wave_height_m: number;
  wave_direction_deg: number;
  wave_period_s: number;
  sea_state: string;
  current_velocity_kts?: number;
  current_direction_deg?: number;
  provider?: string;
}
