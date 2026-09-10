import json
import logging
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter

from app.config import settings
from app.services.ocean_service import ocean_service
from app.services.anomaly_service import anomaly_service
from app.services.ml_service import ml_service

logger = logging.getLogger(__name__)

router = APIRouter()

BACKEND_DIR = Path(__file__).parent.parent.parent
REFRESH_SCRIPT = BACKEND_DIR / "scripts" / "refresh.py"


@router.post("/ocean/refresh")
async def trigger_refresh():
    """Trigger the incremental data refresh pipeline.

    Returns structured JSON with one of three statuses:
      - "updated" — new data was fetched, processed, and dataset replaced
      - "no_new_data" — upstream checked, dataset already current
      - "error" — something failed
    """
    checked_at = datetime.now(timezone.utc).isoformat()
    t_start = time.time()

    if not REFRESH_SCRIPT.exists():
        return {
            "status": "error",
            "message": f"Refresh script not found at {REFRESH_SCRIPT}",
            "checked_at": checked_at,
        }

    # Read previous timestamp before refresh
    previous_timestamp = None
    refresh_meta_path = settings.data_dir / "processed" / "refresh_metadata.json"
    if refresh_meta_path.exists():
        try:
            with open(refresh_meta_path) as f:
                meta = json.load(f)
            previous_timestamp = meta.get("copernicus_latest_timestamp")
        except Exception:
            pass

    try:
        result = subprocess.run(
            [sys.executable, str(REFRESH_SCRIPT)],
            capture_output=True,
            text=True,
            timeout=300,
            cwd=str(BACKEND_DIR),
        )
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "message": "Refresh script timed out after 300 seconds",
            "checked_at": checked_at,
            "duration_seconds": round(time.time() - t_start, 1),
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to run refresh script: {str(e)}",
            "checked_at": checked_at,
            "duration_seconds": round(time.time() - t_start, 1),
        }

    duration = round(time.time() - t_start, 1)

    if result.returncode != 0:
        return {
            "status": "error",
            "message": f"Refresh script failed (exit code {result.returncode})",
            "checked_at": checked_at,
            "duration_seconds": duration,
        }

    # Parse the last line of stdout as JSON result from refresh.py
    script_result = None
    stdout_lines = result.stdout.strip().splitlines()
    if stdout_lines:
        last_line = stdout_lines[-1].strip()
        try:
            script_result = json.loads(last_line)
        except json.JSONDecodeError:
            script_result = None

    if not script_result:
        return {
            "status": "error",
            "message": "Refresh script produced no parseable output",
            "checked_at": checked_at,
            "duration_seconds": duration,
        }

    # Map script statuses to our API contract
    script_status = script_result.get("status", "")

    if script_status == "no_new_data":
        return {
            "status": "no_new_data",
            "checked_at": checked_at,
            "dataset_timestamp": script_result.get("current_latest"),
            "upstream_latest": script_result.get("upstream_latest"),
            "duration_seconds": duration,
            "message": script_result.get("message", "Dataset is already up-to-date"),
        }

    if script_status == "success":
        # Reload in-memory data
        try:
            ocean_service.reload()
            anomaly_service.run_inference(ml_service)
            ocean_service.apply_ml_status(anomaly_service)
            logger.info("In-memory data reloaded after refresh.")
        except Exception as e:
            logger.error(f"Data reload after refresh failed: {e}")
            return {
                "status": "error",
                "message": f"Refresh succeeded but in-memory reload failed: {e}",
                "checked_at": checked_at,
                "duration_seconds": duration,
            }

        return {
            "status": "updated",
            "checked_at": checked_at,
            "previous_timestamp": previous_timestamp,
            "new_timestamp": script_result.get("copernicus_latest_timestamp"),
            "duration_seconds": duration,
            "records": {
                "model": script_result.get("model_records", 0),
                "argo": script_result.get("argo_records", 0),
                "argo_qc_passed": script_result.get("argo_qc_passed", 0),
                "collocated": script_result.get("collocated_records", 0),
                "anomalies": script_result.get("anomaly_count", 0),
            },
            "time_window": script_result.get("time_window"),
            "message": script_result.get("message", "Dataset updated successfully"),
        }

    # Any other status from the script (error, partial, etc.)
    return {
        "status": "error",
        "message": script_result.get("error") or script_result.get("message", "Refresh failed"),
        "checked_at": checked_at,
        "duration_seconds": duration,
    }


@router.get("/ocean/data-status")
async def get_data_status():
    """Return current data freshness information."""
    copernicus_latest = None
    argo_latest = None
    data_window = None
    total_records = 0
    anomaly_count = 0
    using_last_known_good = False
    data_source = "unavailable"

    # Read from ocean_service collocated data
    if ocean_service._collocated is not None and not ocean_service._collocated.empty:
        df = ocean_service._collocated
        total_records = len(df)
        latest_ts = df["timestamp"].max()
        earliest_ts = df["timestamp"].min()

        copernicus_latest = latest_ts.isoformat() if hasattr(latest_ts, "isoformat") else str(latest_ts)
        argo_latest = copernicus_latest  # Same dataset contains both
        data_window = {
            "start": earliest_ts.isoformat() if hasattr(earliest_ts, "isoformat") else str(earliest_ts),
            "end": latest_ts.isoformat() if hasattr(latest_ts, "isoformat") else str(latest_ts),
        }

        # Determine data source
        source = ocean_service._model_source
        if "copernicus" in source.lower():
            data_source = "Copernicus Marine + Argo"
        else:
            data_source = "Prototype Ocean Model + Argo"

    # Anomaly count
    if anomaly_service.is_available:
        anomaly_count = anomaly_service.total_anomaly_count

    # Read refresh metadata file if it exists
    last_refresh_timestamp = None
    refresh_meta_path = settings.data_dir / "processed" / "refresh_metadata.json"
    if refresh_meta_path.exists():
        try:
            with open(refresh_meta_path) as f:
                refresh_meta = json.load(f)
            last_refresh_timestamp = refresh_meta.get("last_refresh_timestamp")
            using_last_known_good = refresh_meta.get("using_last_known_good", False)
        except Exception:
            pass

    # Determine status
    if total_records == 0:
        status = "unavailable"
    elif last_refresh_timestamp:
        try:
            last_refresh_dt = datetime.fromisoformat(last_refresh_timestamp)
            now = datetime.now(timezone.utc)
            if last_refresh_dt.tzinfo is None:
                last_refresh_dt = last_refresh_dt.replace(tzinfo=timezone.utc)
            hours_since = (now - last_refresh_dt).total_seconds() / 3600
            status = "latest_available" if hours_since <= 12 else "stale"
        except (ValueError, TypeError):
            status = "stale"
    else:
        status = "stale"

    return {
        "status": status,
        "copernicus_latest_timestamp": copernicus_latest,
        "argo_latest_timestamp": argo_latest,
        "last_refresh_timestamp": last_refresh_timestamp,
        "data_window": data_window,
        "total_records": total_records,
        "anomaly_count": anomaly_count,
        "using_last_known_good": using_last_known_good,
        "data_source": data_source,
    }
