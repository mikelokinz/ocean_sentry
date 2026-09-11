import type {
  Station, StationComparison, OceanParameter, AnomalyStatus, ParameterConfig, TimePoint,
} from '../types/ocean';

// ── Parameter configuration ───────────────────────────────────────────────────
export const PARAMETER_CONFIG: Record<OceanParameter, ParameterConfig> = {
  temperature: {
    key: 'temperature',
    label: 'Sea Surface Temperature',
    shortLabel: 'SST',
    unit: '°C',
    min: 4,
    max: 32,
    colors: ['#1d4ed8', '#22c55e', '#ef4444'],
  },
  salinity: {
    key: 'salinity',
    label: 'Salinity',
    shortLabel: 'SAL',
    unit: 'PSU',
    min: 30,
    max: 37,
    colors: ['#0891b2', '#6366f1', '#7c3aed'],
  },
  waveHeight: {
    key: 'waveHeight',
    label: 'Wave Height',
    shortLabel: 'WAVE',
    unit: 'm',
    min: 0,
    max: 6,
    colors: ['#0ea5e9', '#f59e0b', '#ef4444'],
  },
  currentSpeed: {
    key: 'currentSpeed',
    label: 'Current Speed',
    shortLabel: 'CURR',
    unit: 'm/s',
    min: 0,
    max: 2,
    colors: ['#06b6d4', '#3b82f6', '#8b5cf6'],
  },
  seaLevel: {
    key: 'seaLevel',
    label: 'Sea Surface Height',
    shortLabel: 'SSH',
    unit: 'm',
    min: -0.5,
    max: 0.5,
    colors: ['#1d4ed8', '#10b981', '#f97316'],
  },
  ph: {
    key: 'ph',
    label: 'Ocean Water pH (Acidity)',
    shortLabel: 'pH',
    unit: 'pH',
    min: 7.4,
    max: 8.4,
    colors: ['#ef4444', '#f59e0b', '#22c55e'],
  },
  chlorophyll: {
    key: 'chlorophyll',
    label: 'Chlorophyll-a',
    shortLabel: 'CHL',
    unit: 'mg/m³',
    min: 0,
    max: 5,
    colors: ['#3b82f6', '#10b981', '#047857'],
  },
};

export const DEPTH_LABELS: Record<number, string> = {
  0: 'Surface',
  10: '10 m',
  50: '50 m',
  100: '100 m',
  500: '500 m',
  1000: '1000 m',
};

export const TIME_POINTS: TimePoint[] = [
  { label: '24H AGO', offsetHours: -24 },
  { label: '12H AGO', offsetHours: -12 },
  { label: '6H AGO', offsetHours: -6 },
  { label: 'NOW', offsetHours: 0 },
  { label: 'FORECAST (COMING SOON)', offsetHours: 6, disabled: true },
];

// ── Math helpers ──────────────────────────────────────────────────────────────
export function pctDiff(obs: number, model: number): number {
  if (model === 0) return 0;
  return ((obs - model) / model) * 100;
}

export function deriveStatus(pct: number): AnomalyStatus {
  const abs = Math.abs(pct);
  if (abs > 40) return 'critical';
  if (abs > 18) return 'warning';
  return 'normal';
}

export function deriveConfidence(pct: number): number {
  return Math.round(Math.max(60, Math.min(97, 95 - Math.abs(pct) * 0.18)));
}

export function getComparisons(station: Station): StationComparison[] {
  const build = (
    parameter: OceanParameter,
    obs: number,
    model: number,
  ): StationComparison => {
    const cfg = PARAMETER_CONFIG[parameter];
    const diff = obs - model;
    const pct = pctDiff(obs, model);
    return {
      parameter,
      label: cfg.label,
      unit: cfg.unit,
      modelValue: model,
      observedValue: obs,
      difference: parseFloat(diff.toFixed(3)),
      percentageDifference: parseFloat(pct.toFixed(1)),
      confidence: deriveConfidence(pct),
      status: deriveStatus(pct),
    };
  };

  return [
    build('temperature', station.temperature, station.modelTemperature),
    build('salinity', station.salinity, station.modelSalinity),
    build('waveHeight', station.waveHeight, station.modelWaveHeight),
    build('currentSpeed', station.currentSpeed, station.modelCurrentSpeed),
    build('seaLevel', station.seaLevel, station.modelSeaLevel),
    build('ph', station.ph ?? 8.14, station.modelPh ?? 8.16),
    build('chlorophyll', station.chlorophyll ?? 0.1, station.modelChlorophyll ?? 0.1),
  ];
}

// ── Coordinate conversion ─────────────────────────────────────────────────────
export function latLonToXYZ(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

export function xyzToLatLon(x: number, y: number, z: number): [number, number] {
  const radius = Math.sqrt(x * x + y * y + z * z);
  if (radius === 0) return [0, 0];
  const phi = Math.acos(clamp(y / radius, -1, 1));
  const lat = 90 - phi * (180 / Math.PI);
  const theta = Math.atan2(z, -x);
  let lon = theta * (180 / Math.PI) - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return [parseFloat(lat.toFixed(3)), parseFloat(lon.toFixed(3))];
}

// ── Color helpers ─────────────────────────────────────────────────────────────
export function statusColor(s: AnomalyStatus, alpha = 1): string {
  const rgb = s === 'critical' ? '239,68,68' : s === 'warning' ? '245,158,11' : '34,211,238';
  return `rgba(${rgb},${alpha})`;
}

export function diffToColor(pct: number): string {
  const abs = Math.abs(pct);
  if (abs < 10) return '#22d3ee';   // cyan - near model
  if (abs < 25) return '#f59e0b';   // amber - moderate
  return '#ef4444';                  // red - high
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function formatLastUpdate(min: number): string {
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
