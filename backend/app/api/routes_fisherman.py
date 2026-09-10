from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.services.fisherman_service import fisherman_service
from app.services.location_store import location_store
from app.schemas.fisherman import (
    FishermanIntelligenceRequest,
    FishermanIntelligenceResponse,
    SeaConditionsResponse,
    CoastalAlertResponse,
)

router = APIRouter(prefix="/fisherman", tags=["fisherman"])


# --- Location Store ---

class StoreLocationRequest(BaseModel):
    chat_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=360)


@router.post("/location")
async def store_location(request: StoreLocationRequest):
    result = location_store.store(request.chat_id, request.latitude, request.longitude)
    return {"stored": True, **result}


@router.get("/location/{chat_id}")
async def get_stored_location(chat_id: str):
    loc = location_store.get(chat_id)
    if loc is None:
        raise HTTPException(status_code=404, detail="No stored location for this user")
    return loc


# --- Intelligence ---

@router.get("/intelligence", response_model=FishermanIntelligenceResponse)
async def get_fishing_intelligence(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=360),
    radius_km: float = Query(50.0, ge=1, le=500),
    date: Optional[datetime] = Query(None),
):
    return fisherman_service.get_intelligence(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        date=date,
    )


@router.post("/intelligence", response_model=FishermanIntelligenceResponse)
async def post_fishing_intelligence(request: FishermanIntelligenceRequest):
    return fisherman_service.get_intelligence(
        latitude=request.latitude,
        longitude=request.longitude,
        radius_km=request.radius_km,
        date=request.date,
    )


# --- Sea Conditions ---

@router.get("/sea-conditions", response_model=SeaConditionsResponse)
async def get_sea_conditions(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=360),
    radius_km: float = Query(50.0, ge=1, le=500),
):
    return fisherman_service.get_sea_conditions(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )


# --- Coastal Alerts ---

@router.get("/coastal-alerts", response_model=CoastalAlertResponse)
async def get_coastal_alerts(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=360),
    radius_km: float = Query(50.0, ge=1, le=500),
):
    return fisherman_service.get_coastal_alerts(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )


# --- Zone Recommendation ---

@router.get("/zone-recommendation")
async def get_zone_recommendation(
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=360),
    radius_km: float = Query(100.0, ge=1, le=500),
):
    intel = fisherman_service.get_intelligence(
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
    )
    if intel.recommended_zone is None:
        return {
            "found": False,
            "message": "No suitable fishing zone found within the search radius. "
            "This may be due to insufficient ocean data coverage in this area.",
            "latitude": latitude,
            "longitude": longitude,
            "search_radius_km": radius_km,
        }
    return {
        "found": True,
        "recommendation": intel.recommended_zone,
        "current_location_suitability": intel.suitability,
        "data_source": intel.data_source,
        "timestamp": intel.timestamp,
        "disclaimer": intel.disclaimer,
    }
