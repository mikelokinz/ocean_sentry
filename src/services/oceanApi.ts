import type { Station, AnomalyStatus, OilSpillRecord } from '../types/ocean';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const STREAM_URL = import.meta.env.VITE_ARGO_STREAM_URL;
const STREAM_KEY = import.meta.env.VITE_ARGO_API_KEY;

interface ApiStation {
  id: string;
  name: string;
  type: string;
  region: string;
  latitude: number;
  longitude: number;
  depth: number;
  isOnline: boolean;
  lastSyncMinutes: number;
  temperature: number;
  salinity: number;
  waveHeight: number;
  currentSpeed: number;
  seaLevel: number;
  modelTemperature: number;
  modelSalinity: number;
  modelWaveHeight: number;
  modelCurrentSpeed: number;
  modelSeaLevel: number;
  status: string;
  dataSource: string;
  anomalyScore?: number;
  anomalyCount?: number;
}

interface ComparisonRecord {
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: string;
  parameter: string;
  model_value: number | null;
  observed_value: number | null;
  difference: number | null;
  percentage_difference: number | null;
}

interface HealthResponse {
  status: string;
  service: string;
}

export function mapStatus(status: string): AnomalyStatus {
  if (status === 'critical' || status === 'high') return 'critical';
  if (status === 'warning') return 'warning';
  return 'normal';
}

function mapStationType(type: string): Station['type'] {
  if (type === 'argo') return 'argo';
  if (type === 'satellite') return 'satellite';
  if (type === 'coastal') return 'coastal';
  return 'buoy';
}

function apiStationToStation(s: ApiStation): Station {
  return {
    id: s.id,
    name: s.name,
    type: mapStationType(s.type),
    region: s.region,
    latitude: s.latitude,
    longitude: s.longitude,
    depth: s.depth,
    isOnline: s.isOnline,
    lastSyncMinutes: s.lastSyncMinutes,
    temperature: s.temperature,
    salinity: s.salinity,
    waveHeight: s.waveHeight,
    currentSpeed: s.currentSpeed,
    seaLevel: s.seaLevel,
    modelTemperature: s.modelTemperature,
    modelSalinity: s.modelSalinity,
    modelWaveHeight: s.modelWaveHeight,
    modelCurrentSpeed: s.modelCurrentSpeed,
    modelSeaLevel: s.modelSeaLevel,
    status: mapStatus(s.status),
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!resp.ok) {
    throw new Error(`API ${resp.status}: ${resp.statusText}`);
  }
  return resp.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  return fetchJson('/api/health');
}

export async function fetchStations(): Promise<Station[]> {
  const raw = await fetchJson<ApiStation[]>('/api/stations/frontend');
  return raw.map(apiStationToStation);
}

export async function fetchComparisons(
  parameter: string = 'temperature',
  limit: number = 100,
): Promise<ComparisonRecord[]> {
  return fetchJson(`/api/ocean/comparison?parameter=${parameter}&limit=${limit}`);
}

export interface AnomalyRecord {
  station_id: string;
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: string;
  parameter: string;
  observed_value: number | null;
  model_value: number | null;
  difference: number | null;
  anomaly_score: number;
  status: string;
  confidence: number;
}

export interface AnomalyResponse {
  count: number;
  anomalies: AnomalyRecord[];
  data_source: string;
}

export interface AnomalySummary {
  available: boolean;
  total_records?: number;
  total_anomalies?: number;
  high_count?: number;
  warning_count?: number;
  normal_count?: number;
  score_min?: number;
  score_max?: number;
  score_mean?: number;
  data_source?: string;
}

export async function fetchAnomalies(limit: number = 100, opts?: {
  depthMin?: number;
  depthMax?: number;
  status?: string;
}): Promise<AnomalyResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.depthMin != null) params.set('depth_min', String(opts.depthMin));
  if (opts?.depthMax != null) params.set('depth_max', String(opts.depthMax));
  if (opts?.status) params.set('status', opts.status);
  return fetchJson(`/api/ocean/anomalies?${params}`);
}

export interface ObservationRecord {
  timestamp: string;
  latitude: number;
  longitude: number;
  depth: number;
  observed_temperature: number | null;
  observed_salinity: number | null;
  model_temperature: number | null;
  model_salinity: number | null;
  model_current_u: number | null;
  model_current_v: number | null;
  temperature_difference: number | null;
  salinity_difference: number | null;
  abs_temperature_difference: number | null;
  abs_salinity_difference: number | null;
  spatial_distance_km: number | null;
}

export async function fetchObservationsAtDepth(depth: number, limit: number = 200): Promise<ObservationRecord[]> {
  return fetchJson(`/api/ocean/observations?depth=${depth}&limit=${limit}`);
}

export interface TimeseriesPoint {
  timestamp: string;
  depth: number;
  observed: number | null;
  model: number | null;
}

export async function fetchTimeseries(lat: number, lon: number, parameter: string = 'temperature'): Promise<TimeseriesPoint[]> {
  return fetchJson(`/api/ocean/timeseries?latitude=${lat}&longitude=${lon}&parameter=${parameter}`);
}

export async function fetchAnomalySummary(): Promise<AnomalySummary> {
  return fetchJson('/api/ocean/anomalies/summary');
}

export interface DeviceInfo {
  cuda_available: boolean;
  device: string;
  device_name: string;
  gpu_name?: string;
  total_memory_mb?: number;
  allocated_memory_mb?: number;
  active_model_type?: string;
  model_loaded?: boolean;
}

export async function fetchDeviceInfo(): Promise<DeviceInfo> {
  return fetchJson('/api/ml/device');
}

export async function checkApiAvailable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 3000);
    await fetch(`${API_BASE}/api/health`, { signal: ctrl.signal });
    clearTimeout(id);
    return true;
  } catch {
    return false;
  }
}

export interface LiveArgoData {
  tick: number;
  profile_id: string;
  region: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  station_payload: {
    temperature: number;
    salinity: number;
    waveHeight: number;
    currentSpeed: number;
    anomalyStatus: string;
  };
}

export async function fetchLiveArgoStream(): Promise<LiveArgoData | null> {
  const targetUrl = STREAM_URL || `${API_BASE}/api/v1/argo/live`;
  try {
    const resp = await fetch(targetUrl, {
      headers: {
        'X-API-KEY': STREAM_KEY || 'samudra_live_key_2026_xYz',
        'Content-Type': 'application/json'
      }
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export interface DataIngestionReport {
  source: string;
  records_received: number;
  records_valid: number;
  records_removed: number;
  records_missing: number;
  variables_found: string[];
  time_range?: [string, string] | null;
  lat_range?: [number, number] | null;
  lon_range?: [number, number] | null;
  depth_range?: [number, number] | null;
  detected_delimiter?: string | null;
  column_mapping: Record<string, string>;
  rejected_rows: Array<{ line: number; raw: string; reason: string }>;
  warnings: string[];
  station_ids: string[];
}

export interface AsciiPreviewResponse {
  success: boolean;
  report: DataIngestionReport;
  preview_records: Array<Record<string, any>>;
  detected_delimiter: string;
  column_mapping: Record<string, string>;
  header_metadata: Record<string, string>;
}

export interface AsciiIngestResponse {
  success: boolean;
  message: string;
  report: DataIngestionReport;
  created_stations: string[];
}

export async function previewAsciiData(
  textContent: string,
  options?: { sourceName?: string; stationId?: string; delimiter?: string }
): Promise<AsciiPreviewResponse> {
  return fetchJson('/api/ocean/ingest/ascii/preview', {
    method: 'POST',
    body: JSON.stringify({
      text_content: textContent,
      source_name: options?.sourceName || 'ascii_preview',
      station_id_override: options?.stationId || undefined,
      delimiter_override: options?.delimiter || undefined,
    }),
  });
}

export async function ingestAsciiData(
  textContent: string,
  options?: { sourceName?: string; stationId?: string; delimiter?: string }
): Promise<AsciiIngestResponse> {
  return fetchJson('/api/ocean/ingest/ascii', {
    method: 'POST',
    body: JSON.stringify({
      text_content: textContent,
      source_name: options?.sourceName || 'ascii_upload',
      station_id_override: options?.stationId || undefined,
      delimiter_override: options?.delimiter || undefined,
    }),
  });
}

export async function fetchIngestFormats(): Promise<any> {
  return fetchJson('/api/ocean/ingest/formats');
}

export interface DataStatus {
  status: 'latest_available' | 'stale' | 'unavailable';
  copernicus_latest_timestamp: string | null;
  argo_latest_timestamp: string | null;
  last_refresh_timestamp: string | null;
  data_window: { start: string; end: string } | null;
  total_records: number;
  anomaly_count: number;
  using_last_known_good: boolean;
  data_source: string;
}

export async function fetchDataStatus(): Promise<DataStatus> {
  return fetchJson('/api/ocean/data-status');
}

export interface LocalOceanState {
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: string | null;
  temperature: number | null;
  salinity: number | null;
  current_u: number | null;
  current_v: number | null;
  current_speed: number | null;
  current_direction_deg: number | null;
  model_temperature: number | null;
  model_salinity: number | null;
  anomaly_score: number | null;
  anomaly_status: string | null;
  model_observation_difference: number | null;
  wave_height: null;
  data_source: string;
}

export async function fetchLocalOceanState(lat: number, lon: number, depth: number = 0): Promise<LocalOceanState | null> {
  try {
    const obs = await fetchJson<ObservationRecord[]>(
      `/api/ocean/observations?lat_min=${lat - 0.5}&lat_max=${lat + 0.5}&lon_min=${lon - 0.5}&lon_max=${lon + 0.5}&depth=${depth}&limit=1`
    );
    if (!obs || obs.length === 0) return null;
    const r = obs[0];
    const u = r.model_current_u ?? 0;
    const v = r.model_current_v ?? 0;
    const speed = Math.sqrt(u * u + v * v);
    const dirRad = Math.atan2(v, u);
    const dirDeg = ((dirRad * 180 / Math.PI) + 360) % 360;
    return {
      latitude: r.latitude,
      longitude: r.longitude,
      depth: r.depth,
      timestamp: r.timestamp,
      temperature: r.observed_temperature,
      salinity: r.observed_salinity,
      current_u: r.model_current_u,
      current_v: r.model_current_v,
      current_speed: speed,
      current_direction_deg: dirDeg,
      model_temperature: r.model_temperature,
      model_salinity: r.model_salinity,
      anomaly_score: r.abs_temperature_difference != null
        ? Math.min(1, Math.abs(r.abs_temperature_difference) / 5)
        : null,
      anomaly_status: r.abs_temperature_difference != null
        ? (Math.abs(r.abs_temperature_difference) >= 2.5 ? 'high' : Math.abs(r.abs_temperature_difference) >= 1.5 ? 'warning' : 'normal')
        : null,
      model_observation_difference: r.temperature_difference,
      wave_height: null,
      data_source: 'Copernicus Marine + Argo',
    };
  } catch {
    return null;
  }
}

export async function fetchOilSpills(): Promise<OilSpillRecord[]> {
  try {
    const res = await fetchJson<{ count: number; incidents: OilSpillRecord[] }>('/api/ml/oil-spills');
    return res.incidents || [];
  } catch (err) {
    console.error('Error fetching oil spills:', err);
    return [];
  }
}

export async function fetchOilSpillDetail(spillId: string): Promise<OilSpillRecord | null> {
  try {
    return await fetchJson<OilSpillRecord>(`/api/ml/oil-spills/${spillId}`);
  } catch (err) {
    console.error(`Error fetching oil spill detail for ${spillId}:`, err);
    return null;
  }
}

export async function runPresetOilSpillDetection(preset: 'spill' | 'clean', threshold: number = 0.8): Promise<any> {
  return await fetchJson(`/api/ml/oil-spills/run-preset/${preset}?threshold=${threshold}`);
}

export async function detectOilSpillUpload(file: File, threshold: number = 0.8): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('threshold', threshold.toString());

  const response = await fetch(`${API_BASE}/api/ml/oil-spills/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Inference request failed with status ${response.status}`);
  }
  return await response.json();
}

export async function triggerOilSpillAlert(spillId: string, message?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/ml/oil-spills/alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spill_id: spillId, message }),
  });
  if (!response.ok) {
    throw new Error(`Alert dispatch failed with status ${response.status}`);
  }
  return await response.json();
}

export type { ApiStation, ComparisonRecord, HealthResponse };


