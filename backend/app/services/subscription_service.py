import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
import uuid

from app.config import settings
from app.schemas.fisherman import SubscriptionRequest, SubscriptionResponse

logger = logging.getLogger(__name__)

SUBSCRIPTIONS_FILE = settings.data_dir / "subscriptions.json"
ALERT_COOLDOWN_HOURS = 6


class SubscriptionService:
    def __init__(self):
        self._subscriptions: list[dict] = []
        self._last_alerts: dict[str, datetime] = {}
        self._load()

    def _load(self):
        if SUBSCRIPTIONS_FILE.exists():
            try:
                with open(SUBSCRIPTIONS_FILE) as f:
                    self._subscriptions = json.load(f)
                logger.info(f"Loaded {len(self._subscriptions)} subscriptions")
            except Exception as e:
                logger.warning(f"Failed to load subscriptions: {e}")

    def _save(self):
        try:
            SUBSCRIPTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(SUBSCRIPTIONS_FILE, "w") as f:
                json.dump(self._subscriptions, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save subscriptions: {e}")

    def subscribe(self, request: SubscriptionRequest) -> SubscriptionResponse:
        sub_id = str(uuid.uuid4())[:8]
        now = datetime.now(timezone.utc)

        sub = {
            "subscription_id": sub_id,
            "chat_id": request.chat_id,
            "latitude": request.latitude,
            "longitude": request.longitude,
            "radius_km": request.radius_km,
            "alert_types": request.alert_types,
            "active": True,
            "created_at": now.isoformat(),
        }
        self._subscriptions.append(sub)
        self._save()

        return SubscriptionResponse(
            subscription_id=sub_id,
            chat_id=request.chat_id,
            latitude=request.latitude,
            longitude=request.longitude,
            radius_km=request.radius_km,
            alert_types=request.alert_types,
            active=True,
            created_at=now,
        )

    def unsubscribe(self, chat_id: str) -> bool:
        found = False
        for sub in self._subscriptions:
            if sub["chat_id"] == chat_id:
                sub["active"] = False
                found = True
        if found:
            self._save()
        return found

    def get_active_subscriptions(self) -> list[dict]:
        return [s for s in self._subscriptions if s.get("active", False)]

    def get_user_subscriptions(self, chat_id: str) -> list[dict]:
        return [s for s in self._subscriptions if s["chat_id"] == chat_id and s.get("active", False)]

    def should_alert(self, subscription_id: str) -> bool:
        last = self._last_alerts.get(subscription_id)
        if last is None:
            return True
        elapsed = (datetime.now(timezone.utc) - last).total_seconds() / 3600
        return elapsed >= ALERT_COOLDOWN_HOURS

    def mark_alerted(self, subscription_id: str):
        self._last_alerts[subscription_id] = datetime.now(timezone.utc)


subscription_service = SubscriptionService()
