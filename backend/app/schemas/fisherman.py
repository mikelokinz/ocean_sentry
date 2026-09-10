from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class FishingSuitability(str, Enum):
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"
    INSUFFICIENT_DATA = "insufficient_data"


class SeaCondition(str, Enum):
    CALM = "calm"
    MODERATE = "moderate"
    ROUGH = "rough"
    UNKNOWN = "unknown"


class DataAvailability(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    STALE = "stale"


class EnvironmentalVariable(BaseModel):
    value: Optional[float] = None
    unit: str
    availability: DataAvailability = DataAvailability.UNAVAILABLE
    description: Optional[str] = None


class FishermanIntelligenceRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=360)
    radius_km: float = Field(default=50.0, ge=1, le=500)
    date: Optional[datetime] = None
    region: Optional[str] = None


class FishingZoneRecommendation(BaseModel):
    latitude: float
    longitude: float
    distance_km: float
    suitability: FishingSuitability
    suitability_score: float = Field(ge=0, le=1)
    reason: str


class CoastalAlert(BaseModel):
    alert_type: str
    severity: str
    message: str
    source: str
    verified: bool = False


class FishermanIntelligenceResponse(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    data_freshness_hours: Optional[float] = None

    suitability: FishingSuitability
    suitability_score: float = Field(ge=0, le=1)
    suitability_factors: list[str] = []

    sst: EnvironmentalVariable
    salinity: EnvironmentalVariable
    current_speed: EnvironmentalVariable
    current_direction: EnvironmentalVariable
    sea_level: EnvironmentalVariable
    chlorophyll: EnvironmentalVariable
    wave_height: EnvironmentalVariable

    sea_condition: SeaCondition
    anomaly_count: int = 0
    anomaly_warnings: list[str] = []

    recommended_zone: Optional[FishingZoneRecommendation] = None
    coastal_alerts: list[CoastalAlert] = []

    data_source: str
    disclaimer: str = (
        "This is an environmental suitability assessment based on ocean model data, "
        "not a guaranteed fish location prediction. Always follow local maritime "
        "safety guidelines and official advisories."
    )


class SeaConditionsResponse(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    data_freshness_hours: Optional[float] = None

    sst: EnvironmentalVariable
    salinity: EnvironmentalVariable
    current_speed: EnvironmentalVariable
    current_direction: EnvironmentalVariable
    sea_level: EnvironmentalVariable
    wave_height: EnvironmentalVariable

    overall_condition: SeaCondition
    anomaly_count: int = 0
    warnings: list[str] = []

    data_source: str


class CoastalAlertResponse(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime
    alerts: list[CoastalAlert] = []
    message: str
    data_source: str


class SubscriptionRequest(BaseModel):
    chat_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=360)
    radius_km: float = Field(default=50.0, ge=1, le=500)
    alert_types: list[str] = Field(default_factory=lambda: ["anomaly", "conditions"])


class SubscriptionResponse(BaseModel):
    subscription_id: str
    chat_id: str
    latitude: float
    longitude: float
    radius_km: float
    alert_types: list[str]
    active: bool = True
    created_at: datetime
