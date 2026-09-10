import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

LOCATIONS_FILE = settings.data_dir / "user_locations.json"


class LocationStore:
    """Stores the last known GPS location per Telegram chat_id.

    Used so fishermen can share their location once, then ask text
    questions without re-sharing every time.
    """

    def __init__(self):
        self._locations: dict[str, dict] = {}
        self._load()

    def _load(self):
        if LOCATIONS_FILE.exists():
            try:
                with open(LOCATIONS_FILE) as f:
                    self._locations = json.load(f)
                logger.info(f"Loaded {len(self._locations)} stored user locations")
            except Exception as e:
                logger.warning(f"Failed to load user locations: {e}")

    def _save(self):
        try:
            LOCATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(LOCATIONS_FILE, "w") as f:
                json.dump(self._locations, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save user locations: {e}")

    def store(self, chat_id: str, latitude: float, longitude: float) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        self._locations[chat_id] = {
            "latitude": latitude,
            "longitude": longitude,
            "updated_at": now,
        }
        self._save()
        return self._locations[chat_id]

    def get(self, chat_id: str) -> Optional[dict]:
        return self._locations.get(chat_id)

    def delete(self, chat_id: str) -> bool:
        if chat_id in self._locations:
            del self._locations[chat_id]
            self._save()
            return True
        return False


location_store = LocationStore()
