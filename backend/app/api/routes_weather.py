from typing import Optional
from fastapi import APIRouter, Query
from app.services.weather_service import weather_service

router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/grid")
async def get_weather_grid(metric: Optional[str] = Query("wind", description="Metric: wind, temperature, waves, pressure")):
    """
    Returns spatial vector grid data for Three.js GPU particles and temperature heatmap.
    """
    return await weather_service.get_weather_grid(metric=metric or "wind")

@router.get("/probe")
async def get_weather_probe(
    lat: float = Query(16.35, ge=-90.0, le=90.0, description="Latitude"),
    lon: float = Query(82.70, ge=-180.0, le=180.0, description="Longitude")
):
    """
    High-precision live marine & atmospheric point query for any clicked location on the globe.
    """
    return await weather_service.get_point_probe(lat=lat, lon=lon)
