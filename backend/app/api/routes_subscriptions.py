from fastapi import APIRouter, Query

from app.services.subscription_service import subscription_service
from app.services.fisherman_service import fisherman_service
from app.schemas.fisherman import SubscriptionRequest, SubscriptionResponse

router = APIRouter(prefix="/fisherman/subscriptions", tags=["fisherman-subscriptions"])


@router.post("", response_model=SubscriptionResponse)
async def create_subscription(request: SubscriptionRequest):
    return subscription_service.subscribe(request)


@router.delete("/{chat_id}")
async def remove_subscription(chat_id: str):
    removed = subscription_service.unsubscribe(chat_id)
    return {"removed": removed, "chat_id": chat_id}


@router.get("")
async def list_subscriptions(chat_id: str = Query(None)):
    if chat_id:
        return subscription_service.get_user_subscriptions(chat_id)
    return subscription_service.get_active_subscriptions()


@router.get("/check-alerts")
async def check_alerts_for_subscriptions():
    """Called by n8n scheduled workflow to evaluate all active subscriptions."""
    active = subscription_service.get_active_subscriptions()
    alerts_to_send = []

    for sub in active:
        sub_id = sub["subscription_id"]
        if not subscription_service.should_alert(sub_id):
            continue

        intel = fisherman_service.get_intelligence(
            latitude=sub["latitude"],
            longitude=sub["longitude"],
            radius_km=sub.get("radius_km", 50.0),
        )

        should_notify = False
        reasons = []

        if intel.anomaly_count > 3:
            should_notify = True
            reasons.append(f"{intel.anomaly_count} anomalies detected")

        if intel.sea_condition.value == "rough":
            should_notify = True
            reasons.append("Rough sea conditions")

        if intel.suitability.value == "high" and "conditions" in sub.get("alert_types", []):
            should_notify = True
            reasons.append("Favorable fishing conditions detected")

        if should_notify:
            subscription_service.mark_alerted(sub_id)
            alerts_to_send.append({
                "subscription_id": sub_id,
                "chat_id": sub["chat_id"],
                "latitude": sub["latitude"],
                "longitude": sub["longitude"],
                "reasons": reasons,
                "suitability": intel.suitability.value,
                "suitability_score": intel.suitability_score,
                "sea_condition": intel.sea_condition.value,
                "anomaly_count": intel.anomaly_count,
                "sst": intel.sst.value,
                "current_speed": intel.current_speed.value,
            })

    return {
        "checked": len(active),
        "alerts": alerts_to_send,
        "alerts_count": len(alerts_to_send),
    }
