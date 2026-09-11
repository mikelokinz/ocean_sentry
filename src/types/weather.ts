export type GlobeMode = 'ocean-sentry' | 'weather-radar';

export type WeatherLayerType = 'wind' | 'current' | 'temperature' | 'precipitation' | 'clouds';

export type ValidationDirectionMode = 'live' | '0-north' | '90-east' | '180-south' | '270-west' | '45-ne' | '225-sw';

export interface WeatherVectorPoint {
  latitude: number;
  longitude: number;
  // Atmospheric Wind
  u_wind: number; // Eastward velocity component (kts)
  v_wind: number; // Northward velocity component (kts)
  wind_speed_kts: number;
  wind_direction_deg: number; // Heading towards (0=N, 90=E, 180=S, 270=W)
  // Marine Ocean Current
  u_current: number; // Eastward velocity component (kts)
  v_current: number; // Northward velocity component (kts)
  current_velocity_kts: number;
  current_direction_deg: number; // Heading towards (0=N, 90=E, 180=S, 270=W)
  is_ocean: boolean;
  // Scalar fields
  temperature_c: number;
  precipitation_mm: number;
  cloud_cover_pct: number;
  wave_height_m: number;
  pressure_hpa: number;
  source?: string;
}

// Backward compatibility alias for WindGridPoint
export type WindGridPoint = WeatherVectorPoint;

export interface WeatherCityPoint {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  temperature_c: number;
}

export interface HourlyWeatherTimestep {
  time: string; // ISO 8601 string
  label: string; // e.g. "T+0h (Now)", "T+1h", etc.
  points: WeatherVectorPoint[];
}

export interface WeatherGridResponse {
  timestamp: string;
  source: string;
  model: string;
  valid_time: string;
  metric?: string;
  bounds: {
    lat_min: number;
    lat_max: number;
    lon_min: number;
    lon_max: number;
  };
  points_count: number;
  points: WeatherVectorPoint[];
  timesteps: HourlyWeatherTimestep[];
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
  precipitation_mm?: number;
  wave_height_m: number;
  wave_direction_deg: number;
  wave_period_s: number;
  sea_state: string;
  current_velocity_kts?: number;
  current_direction_deg?: number;
  provider?: string;
}

export interface WeatherFlowControls {
  animationActive: boolean;
  particleDensity: number; // e.g. 1000 - 5000
  flowSpeed: number; // e.g. 0.5 - 3.0
  trailLength: number; // e.g. 4 - 16
  validationMode: ValidationDirectionMode;
}
