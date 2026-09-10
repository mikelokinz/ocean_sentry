import os
import shutil
import base64
import tempfile
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException, Request
from pydantic import BaseModel

from app.services.oil_spill_service import oil_spill_service

router = APIRouter(tags=["oil-spill-ml"])

class AlertRequest(BaseModel):
    spill_id: str
    message: Optional[str] = None

class DetectRequest(BaseModel):
    preset: Optional[str] = "spill"
    threshold: Optional[float] = 0.8
    image_base64: Optional[str] = None

@router.get("/ml/oil-spills")
async def get_oil_spills():
    """
    Returns active oil spill incidents detected across maritime surveillance zones.
    """
    return {
        "count": len(oil_spill_service.get_active_spills()),
        "incidents": oil_spill_service.get_active_spills()
    }

@router.get("/ml/oil-spills/{spill_id}")
async def get_oil_spill_detail(spill_id: str):
    """
    Returns detailed telemetry, drift vectors, and satellite source for a specific spill.
    """
    spill = oil_spill_service.get_spill_by_id(spill_id)
    if not spill:
        raise HTTPException(status_code=404, detail=f"Spill incident '{spill_id}' not found.")
    return spill

@router.get("/ml/oil-spills/run-preset/{preset}")
async def run_preset_spill_get(preset: str, threshold: float = 0.8):
    """
    Quick GET endpoint to trigger inference on preset benchmark images ('spill' or 'clean').
    """
    if preset not in ["spill", "clean"]:
        raise HTTPException(status_code=400, detail="Preset must be 'spill' or 'clean'.")
    result = await oil_spill_service.run_preset_test(preset=preset, threshold=threshold)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/ml/oil-spills/detect-json")
async def detect_oil_spill_json(req: DetectRequest):
    """
    Inference endpoint taking JSON: preset or image_base64.
    """
    if req.image_base64:
        temp_dir = tempfile.mkdtemp()
        temp_path = os.path.join(temp_dir, "uploaded_image.png")
        try:
            raw_b64 = req.image_base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            img_bytes = base64.b64decode(raw_b64)
            with open(temp_path, "wb") as f:
                f.write(img_bytes)

            result = await oil_spill_service.run_inference_on_file(temp_path, threshold=req.threshold or 0.8)
            if "error" in result:
                raise HTTPException(status_code=500, detail=result["error"])
            return result
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir, ignore_errors=True)

    preset = req.preset if req.preset in ["spill", "clean"] else "spill"
    result = await oil_spill_service.run_preset_test(preset=preset, threshold=req.threshold or 0.8)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/ml/oil-spills/upload")
async def detect_oil_spill_upload(
    file: UploadFile = File(...),
    threshold: float = Form(0.8)
):
    """
    Multipart file upload inference endpoint.
    """
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, file.filename or "upload.png")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = await oil_spill_service.run_inference_on_file(temp_path, threshold=threshold)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

@router.post("/ml/oil-spills/alert")
async def trigger_oil_spill_alert(req: AlertRequest):
    """
    Dispatches an automated incident notification to the active n8n automation engine.
    """
    return await oil_spill_service.dispatch_n8n_alert(spill_id=req.spill_id, custom_message=req.message)
