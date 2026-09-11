import * as THREE from 'three';
import type { WeatherGridData, WeatherOverlayType } from '../types/ocean';

// Colormaps calibrated to Windy.com visual standards

function getTemperatureColor(tempC: number): [number, number, number, number] {
  // Range: -40°C to +42°C
  const t = Math.max(-40, Math.min(42, tempC));
  const norm = (t + 40) / 82; // 0 to 1

  if (norm < 0.2) {
    // -40 to -24: Dark indigo to deep royal blue
    const f = norm / 0.2;
    return [
      Math.round(20 + f * 10),
      Math.round(10 + f * 30),
      Math.round(90 + f * 120),
      0.9
    ];
  } else if (norm < 0.4) {
    // -24 to -8: Royal blue to bright cyan
    const f = (norm - 0.2) / 0.2;
    return [
      Math.round(30 + f * 10),
      Math.round(40 + f * 180),
      Math.round(210 + f * 45),
      0.85
    ];
  } else if (norm < 0.55) {
    // -8 to +5: Cyan to crisp turquoise/mint
    const f = (norm - 0.4) / 0.15;
    return [
      Math.round(40 + f * 30),
      Math.round(220 + f * 25),
      Math.round(255 - f * 100),
      0.85
    ];
  } else if (norm < 0.7) {
    // +5 to +18: Mint green to bright canary yellow
    const f = (norm - 0.55) / 0.15;
    return [
      Math.round(70 + f * 180),
      Math.round(245 + f * 10),
      Math.round(155 - f * 125),
      0.85
    ];
  } else if (norm < 0.85) {
    // +18 to +30: Canary yellow to vivid orange
    const f = (norm - 0.7) / 0.15;
    return [
      Math.round(250 + f * 5),
      Math.round(255 - f * 120),
      Math.round(30 - f * 20),
      0.88
    ];
  } else {
    // +30 to +42: Vivid orange to blazing magenta/crimson
    const f = (norm - 0.85) / 0.15;
    return [
      Math.round(255 - f * 15),
      Math.round(135 - f * 100),
      Math.round(10 + f * 180),
      0.92
    ];
  }
}

function getWindSpeedColor(speedMs: number): [number, number, number, number] {
  // Range: 0 to 35 m/s
  const s = Math.max(0, Math.min(35, speedMs));
  const norm = s / 35;

  if (norm < 0.2) {
    // Calm (0-7 m/s): Dark transparent indigo to soft cyan
    const f = norm / 0.2;
    return [
      Math.round(10 + f * 20),
      Math.round(40 + f * 140),
      Math.round(120 + f * 100),
      0.4 + f * 0.3
    ];
  } else if (norm < 0.45) {
    // Moderate (7-16 m/s): Cyan to electric green
    const f = (norm - 0.2) / 0.25;
    return [
      Math.round(30 + f * 70),
      Math.round(180 + f * 60),
      Math.round(220 - f * 140),
      0.7 + f * 0.15
    ];
  } else if (norm < 0.7) {
    // Fresh/Strong (16-24 m/s): Electric green to bright yellow/amber
    const f = (norm - 0.45) / 0.25;
    return [
      Math.round(100 + f * 150),
      Math.round(240 - f * 40),
      Math.round(80 - f * 60),
      0.85
    ];
  } else {
    // Gale/Storm (24-35 m/s): Amber to intense magenta-violet
    const f = (norm - 0.7) / 0.3;
    return [
      Math.round(250 - f * 20),
      Math.round(200 - f * 160),
      Math.round(20 + f * 200),
      0.92
    ];
  }
}

function getWaveColor(waveM: number): [number, number, number, number] {
  const h = Math.max(0, Math.min(10, waveM));
  const norm = h / 10;
  if (norm < 0.3) {
    const f = norm / 0.3;
    return [Math.round(10 + f * 20), Math.round(50 + f * 120), Math.round(140 + f * 90), 0.6 + f * 0.2];
  } else if (norm < 0.6) {
    const f = (norm - 0.3) / 0.3;
    return [Math.round(30 + f * 180), Math.round(170 + f * 60), Math.round(230 - f * 160), 0.8];
  } else {
    const f = (norm - 0.6) / 0.4;
    return [Math.round(210 + f * 40), Math.round(230 - f * 180), Math.round(70 + f * 130), 0.9];
  }
}

function getPressureColor(pressHpa: number): [number, number, number, number] {
  // Low pressure (cyclone, 970) to high pressure (anticyclone, 1035)
  const p = Math.max(970, Math.min(1035, pressHpa));
  const norm = (p - 970) / 65; // 0 = low, 1 = high
  if (norm < 0.3) {
    const f = norm / 0.3;
    return [Math.round(160 - f * 100), Math.round(20 + f * 40), Math.round(180 - f * 60), 0.85]; // deep violet/red low
  } else if (norm < 0.6) {
    const f = (norm - 0.3) / 0.3;
    return [Math.round(60 - f * 40), Math.round(60 + f * 120), Math.round(120 + f * 100), 0.7]; // neutral
  } else {
    const f = (norm - 0.6) / 0.4;
    return [Math.round(20 + f * 180), Math.round(180 + f * 60), Math.round(220 + f * 35), 0.85]; // high cyan/white
  }
}

export function createWeatherHeatmapTexture(
  grid: WeatherGridData | null,
  overlayType: WeatherOverlayType = 'temperature'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  // High-def texture dimension: 512x256 equirectangular
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    const fallbackCanvas = document.createElement('canvas');
    return new THREE.CanvasTexture(fallbackCanvas);
  }

  const imgData = ctx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;

  const w = canvas.width;
  const h = canvas.height;

  // Grid dimensions
  const gw = grid?.width ?? 72;
  const gh = grid?.height ?? 37;

  for (let y = 0; y < h; y++) {
    // Latitude: y = 0 -> +90 deg, y = h - 1 -> -90 deg
    const lat = 90 - (y / (h - 1)) * 180;
    const gridY = (y / (h - 1)) * (gh - 1);
    const gy0 = Math.floor(gridY);
    const gy1 = Math.min(gh - 1, gy0 + 1);
    const ty = gridY - gy0;

    for (let x = 0; x < w; x++) {
      // Longitude: x = 0 -> -180 deg, x = w - 1 -> +180 deg
      const lon = -180 + (x / (w - 1)) * 360;
      const gridX = (x / (w - 1)) * (gw - 1);
      const gx0 = Math.floor(gridX);
      const gx1 = (gx0 + 1) % gw;
      const tx = gridX - gx0;

      let val = 0;

      if (grid) {
        let arr: number[] = grid.temp;
        if (overlayType === 'wind') arr = grid.speed;
        else if (overlayType === 'pressure') arr = grid.pressure;
        else if (overlayType === 'waves') arr = grid.speed; // wave height correlated with wind speed

        // Bilinear interpolation
        const v00 = arr[gy0 * gw + gx0] ?? 0;
        const v10 = arr[gy0 * gw + gx1] ?? 0;
        const v01 = arr[gy1 * gw + gx0] ?? 0;
        const v11 = arr[gy1 * gw + gx1] ?? 0;

        const v0 = v00 * (1 - tx) + v10 * tx;
        const v1 = v01 * (1 - tx) + v11 * tx;
        val = v0 * (1 - ty) + v1 * ty;
      } else {
        // Fallback procedural atmospheric synthesis
        const absLat = Math.abs(lat);
        if (overlayType === 'temperature') {
          val = 28 * Math.cos((lat * Math.PI) / 180) - 24 * (absLat / 90) ** 2;
        } else if (overlayType === 'wind') {
          val = 6 + 12 * Math.sin((absLat / 90) * Math.PI);
        } else if (overlayType === 'pressure') {
          val = 1013 - 6 * Math.cos((2 * lat * Math.PI) / 180);
        } else {
          val = 1.5 + 2.0 * Math.sin((absLat / 90) * Math.PI);
        }
      }

      let rgba: [number, number, number, number];
      if (overlayType === 'temperature') {
        rgba = getTemperatureColor(val);
      } else if (overlayType === 'wind') {
        rgba = getWindSpeedColor(val);
      } else if (overlayType === 'pressure') {
        rgba = getPressureColor(val);
      } else {
        // waves
        const waveH = grid ? Math.max(0.4, val * 0.18) : val;
        rgba = getWaveColor(waveH);
      }

      const pixelIdx = (y * w + x) * 4;
      data[pixelIdx] = rgba[0];
      data[pixelIdx + 1] = rgba[1];
      data[pixelIdx + 2] = rgba[2];
      data[pixelIdx + 3] = Math.round(rgba[3] * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  return texture;
}
