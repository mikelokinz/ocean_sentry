import os
import sys
import json
import logging
import asyncio
import subprocess
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

PYTHON_ML_EXE = r"D:\Projects\hackathons\makeathon4\ocean_sentry\ocean_sentry_ml\venv312\Scripts\python.exe"
INFERENCE_SCRIPT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "run_oil_inference.py")
)
DATA_SAR_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "sar")
)

# Active Bay of Bengal oil spill incidents
DEFAULT_ACTIVE_SPILLS: List[Dict[str, Any]] = [
    {
        "id": "spill-bob-kg-basin",
        "name": "Bay of Bengal - Krishna Godavari Offshore",
        "location_name": "KG Basin Deepwater Block (Bay of Bengal)",
        "latitude": 16.35,
        "longitude": 82.70,
        "depth": 0,
        "status": "oil_detected",
        "confidence": 0.9563,
        "area_km2": 38.4,
        "spillage_percentage": 20.51,
        "detected_spills_count": 3,
        "detected_at": "2026-09-10T17:30:00Z",
        "severity": "critical",
        "sar_image_url": "/data/sar/test_image_spill.png",
        "recommended_action": "Deploy Tier-1 Containment Booms & Alert Indian Coast Guard MRCC Chennai",
        "source_satellite": "Sentinel-1C SAR C-Band",
        "drift_vector": {"speed_knots": 1.4, "heading_deg": 65, "direction": "ENE towards central Bay of Bengal"},
        "wind_surface": {"speed_kts": 11.5, "dir_deg": 235},
        "water_temp_c": 28.8,
    },
    {
        "id": "spill-bob-odisha-shelf",
        "name": "Bay of Bengal - Paradip / Odisha Shelf",
        "location_name": "Northern Bay of Bengal Tanker Route",
        "latitude": 19.65,
        "longitude": 87.15,
        "depth": 0,
        "status": "oil_detected",
        "confidence": 0.9240,
        "area_km2": 26.2,
        "spillage_percentage": 14.80,
        "detected_spills_count": 2,
        "detected_at": "2026-09-10T18:15:00Z",
        "severity": "critical",
        "sar_image_url": "/data/sar/test_image_spill.png",
        "recommended_action": "Alert Paradip Port Marine Ops & Scramble Coast Guard Pollution Response",
        "source_satellite": "Sentinel-1A SAR C-Band",
        "drift_vector": {"speed_knots": 1.1, "heading_deg": 105, "direction": "ESE offshore drift"},
        "wind_surface": {"speed_kts": 13.0, "dir_deg": 250},
        "water_temp_c": 28.2,
    },
    {
        "id": "spill-bob-ennore-corridor",
        "name": "Bay of Bengal - Chennai Ennore Corridor",
        "location_name": "Coromandel Coastal Anchorage (Bay of Bengal)",
        "latitude": 13.35,
        "longitude": 80.55,
        "depth": 0,
        "status": "uncertain",
        "confidence": 0.7650,
        "area_km2": 10.4,
        "spillage_percentage": 5.20,
        "detected_spills_count": 1,
        "detected_at": "2026-09-10T19:05:00Z",
        "severity": "moderate",
        "sar_image_url": "/data/sar/test_image_spill.png",
        "recommended_action": "Dispatch Coast Guard Dornier Patrol Aircraft for Optical Verification",
        "source_satellite": "RADARSAT Constellation Mission (RCM)",
        "drift_vector": {"speed_knots": 1.7, "heading_deg": 30, "direction": "NNE along Coromandel current"},
        "wind_surface": {"speed_kts": 9.8, "dir_deg": 190},
        "water_temp_c": 29.3,
    },
    {
        "id": "spill-bob-central-transit",
        "name": "Central Bay of Bengal Deep Channel",
        "location_name": "International Bay of Bengal Shipping Corridor",
        "latitude": 14.80,
        "longitude": 85.90,
        "depth": 0,
        "status": "oil_detected",
        "confidence": 0.9410,
        "area_km2": 31.5,
        "spillage_percentage": 16.40,
        "detected_spills_count": 3,
        "detected_at": "2026-09-10T20:10:00Z",
        "severity": "critical",
        "sar_image_url": "/data/sar/test_image_spill.png",
        "recommended_action": "Broadcast Navigational Hazard Warning to IMO Bay of Bengal Transit",
        "source_satellite": "Sentinel-1B SAR C-Band",
        "drift_vector": {"speed_knots": 1.9, "heading_deg": 80, "direction": "E into Open Bay Basin"},
        "wind_surface": {"speed_kts": 14.2, "dir_deg": 240},
        "water_temp_c": 29.5,
    },
]

class OilSpillService:
    def __init__(self):
        self.incidents: List[Dict[str, Any]] = list(DEFAULT_ACTIVE_SPILLS)
        self.n8n_webhook_url = os.getenv("N8N_OIL_SPILL_WEBHOOK_URL", "http://localhost:5678/webhook/oil-spill-alert")

    def get_active_spills(self) -> List[Dict[str, Any]]:
        return self.incidents

    def get_spill_by_id(self, spill_id: str) -> Optional[Dict[str, Any]]:
        for incident in self.incidents:
            if incident["id"] == spill_id:
                return incident
        return None

    async def run_inference_on_file(self, file_path: str, threshold: float = 0.8) -> Dict[str, Any]:
        """
        Executes inference via the Python 3.12 ML environment with U-Net model.
        """
        if not os.path.exists(PYTHON_ML_EXE):
            logger.error(f"Python ML executable not found at {PYTHON_ML_EXE}")
            return {
                "error": f"ML environment not found at {PYTHON_ML_EXE}",
                "status": "error"
            }

        cmd = [
            PYTHON_ML_EXE,
            INFERENCE_SCRIPT,
            file_path,
            "--threshold",
            str(threshold)
        ]

        logger.info(f"Running oil spill inference: {' '.join(cmd)}")
        try:
            def _run_sub():
                return subprocess.run(cmd, capture_output=True, text=True, check=False)

            proc = await asyncio.to_thread(_run_sub)

            if proc.returncode != 0:
                err_msg = proc.stderr.strip()
                logger.error(f"Inference failed with code {proc.returncode}: {err_msg}")
                return {"error": f"Inference process error: {err_msg}", "status": "error"}

            result_str = proc.stdout.strip()
            return json.loads(result_str)
        except Exception as e:
            logger.exception("Exception running oil spill inference")
            return {"error": str(e), "status": "error"}

    async def run_preset_test(self, preset: str = "spill", threshold: float = 0.8) -> Dict[str, Any]:
        """
        Runs inference on preset test images (spill vs clean).
        """
        filename = "test_image_spill.png" if preset == "spill" else "test_image_clean.png"
        target_path = os.path.join(DATA_SAR_DIR, filename)

        if not os.path.exists(target_path):
            # Fallback to ocean_sentry_ml root
            fallback = os.path.join(r"D:\Projects\hackathons\makeathon4\ocean_sentry\ocean_sentry_ml", filename)
            if os.path.exists(fallback):
                target_path = fallback
            else:
                return {"error": f"Preset image {filename} not found", "status": "error"}

        res = await self.run_inference_on_file(target_path, threshold=threshold)
        res["preset"] = preset
        res["image_url"] = f"/data/sar/{filename}"
        return res

    async def dispatch_n8n_alert(self, spill_id: str, custom_message: Optional[str] = None) -> Dict[str, Any]:
        """
        Dispatches an automated incident payload to the running n8n instance.
        """
        incident = self.get_spill_by_id(spill_id)
        if not incident:
            return {"success": False, "message": f"Incident {spill_id} not found"}

        payload = {
            "event": "CRITICAL_OIL_SPILL_DETECTED",
            "incident_id": incident["id"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "location": {
                "name": incident["location_name"],
                "latitude": incident["latitude"],
                "longitude": incident["longitude"]
            },
            "metrics": {
                "status": incident["status"],
                "confidence": incident["confidence"],
                "area_km2": incident["area_km2"],
                "spillage_percentage": incident["spillage_percentage"],
                "severity": incident["severity"]
            },
            "recommendation": incident["recommended_action"],
            "notes": custom_message or "Automated alert generated from Ocean Sentry ML Digital Twin",
            "source": "ResNet-34 U-Net SAR Analysis (best_oil_model.pth)"
        }

        # Send to n8n if available
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(self.n8n_webhook_url, json=payload)
                n8n_status = resp.status_code
        except Exception as e:
            logger.warning(f"n8n webhook dispatch warning: {e} (Engine may be waiting for webhook trigger)")
            n8n_status = "unreachable_or_simulated"

        return {
            "success": True,
            "incident_id": spill_id,
            "dispatched_to": self.n8n_webhook_url,
            "n8n_status": n8n_status,
            "payload": payload
        }

oil_spill_service = OilSpillService()
