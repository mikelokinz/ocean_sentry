"""
Run inference on a SAR image using the locally trained U-Net model.
Usage:
    python run_oil_inference.py <image_path> [--threshold 0.8]
Outputs JSON to stdout.
"""
import sys
import os
import json
import base64
import argparse
import numpy as np

# Ensure ocean_sentry_ml is on sys.path
ml_dir = r"D:\Projects\hackathons\makeathon4\ocean_sentry\ocean_sentry_ml"
if ml_dir not in sys.path:
    sys.path.insert(0, ml_dir)

import cv2
import torch
from src.model import get_model
from src.inference import run_inference_pipeline, predict_mask

MODEL_PATH = os.path.join(ml_dir, "best_oil_model.pth")

def main():
    parser = argparse.ArgumentParser(description="Oil spill inference runner")
    parser.add_argument("image_path", help="Path to input SAR image")
    parser.add_argument("--threshold", type=float, default=0.8, help="Segmentation probability threshold")
    args = parser.parse_args()

    if not os.path.exists(args.image_path):
        print(json.dumps({"error": f"Image file not found: {args.image_path}"}))
        sys.exit(1)

    image = cv2.imread(args.image_path)
    if image is None:
        print(json.dumps({"error": "Failed to decode image"}))
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = get_model(encoder_name="resnet34", encoder_weights=None, in_channels=3, classes=1)
    state_dict = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()

    # Run inference
    pipeline_res = run_inference_pipeline(model, image, device=device, threshold=args.threshold)
    binary_mask, conf, probs_resized = predict_mask(model, image, device=device, threshold=args.threshold)

    # Generate color overlay: dark petroleum mask with bright neon crimson/orange rim
    h, w = image.shape[:2]
    overlay = image.copy()
    if np.any(binary_mask == 1):
        # Color oil spill pixels in semi-translucent red/orange
        color_mask = np.zeros_like(image)
        color_mask[binary_mask == 1] = [40, 50, 240] # BGR orange-red
        overlay = cv2.addWeighted(image, 0.65, color_mask, 0.35, 0)
        
        # Add yellow contours around spill boundaries
        contours, _ = cv2.findContours(binary_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(overlay, contours, -1, (0, 230, 255), 2)

    # Encode overlay to PNG base64
    _, buf = cv2.imencode(".png", overlay)
    mask_base64 = "data:image/png;base64," + base64.b64encode(buf).decode("utf-8")

    # Encode raw binary mask to PNG base64
    mask_vis = (binary_mask * 255).astype(np.uint8)
    _, mask_buf = cv2.imencode(".png", mask_vis)
    raw_mask_base64 = "data:image/png;base64," + base64.b64encode(mask_buf).decode("utf-8")

    output = {
        **pipeline_res,
        "mask_overlay_base64": mask_base64,
        "raw_mask_base64": raw_mask_base64,
        "model_architecture": "ResNet-34 U-Net (smp)",
        "weights_source": "best_oil_model.pth (Local Checkpoint)",
        "device_used": str(device)
    }

    print(json.dumps(output))

if __name__ == "__main__":
    main()
