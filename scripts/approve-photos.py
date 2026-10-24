#!/usr/bin/env python3
"""Approve *background-preserving* photos for Auto Quiz.

Conservative screening: publish a scene photograph only if an offline COCO
vehicle detector sees exactly one car and no other visible vehicle.
Failure or ambiguity means KEEP THE EXISTING TRANSPARENT PNG, not use the
unreviewed scene. This is an automated screen, not a human visual approval.
"""
import hashlib
import io
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote

import numpy as np
import onnxruntime as ort
import requests
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "public/data/cars.json"
MANIFEST = ROOT / "data/commons-batch-01.json"
REPORT = ROOT / "docs/PHOTO-FRAME-AUDIT.json"
MODEL = ROOT / ".photo-checker.onnx"
MODEL_URL = "https://huggingface.co/unileon-robotics/YOLO8-ONNX/resolve/main/yolov8n.onnx"
MODEL_SHA256 = "fa2c856b0effedce4f49fffd121f438247a64c8f633bf0e6d5e5960e869ccc5a"
COCO_VEHICLES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
UA = "AutoQuizAssetQuality/1.0 (https://github.com/Mooouse/Auto-Quiz)"
API = "https://commons.wikimedia.org/w/api.php"


def download(http, url, max_bytes=24_000_000):
    if not url.startswith("https://"):
        raise ValueError("HTTPS required")
    for attempt in range(4):
        try:
            with http.get(url, stream=True, timeout=(15, 90)) as response:
                response.raise_for_status()
                chunks, size = [], 0
                for part in response.iter_content(131072):
                    size += len(part)
                    if size > max_bytes:
                        raise ValueError("Download size limit exceeded")
                    chunks.append(part)
                return b"".join(chunks)
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def model_session(http):
    if not MODEL.exists() or hashlib.sha256(MODEL.read_bytes()).hexdigest() != MODEL_SHA256:
        data = download(http, MODEL_URL, 20_000_000)
        if hashlib.sha256(data).hexdigest() != MODEL_SHA256:
            raise ValueError("Vehicle detector SHA256 mismatch")
        MODEL.write_bytes(data)
    return ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])


def get_commons_url(http, item):
    title = "File:" + item["commonsFile"]
    resp = http.get(API, params={
        "action": "query", "format": "json", "formatversion": 2,
        "prop": "imageinfo", "iiprop": "url|extmetadata",
        "iiurlwidth": 1440, "titles": title
    }, timeout=(15, 60))
    resp.raise_for_status()
    pages = resp.json().get("query", {}).get("pages", [])
    if len(pages) != 1 or "imageinfo" not in pages[0]:
        raise ValueError("Commons file unavailable")
    info = pages[0]["imageinfo"][0]
    meta = info.get("extmetadata", {})
    license_name = re.sub(r"\s+", " ", meta.get("LicenseShortName", {}).get("value", "")).strip().lower()
    if license_name != item["license"].lower():
        raise ValueError("Commons license mismatch")
    return info.get("thumburl") or info.get("url")


def overlap(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    union = max(1, (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection)
    return intersection / union


def detect_vehicles(model, photo):
    # This pinned ONNX export uses [1,3,480,640]. Respect the model input
    # shape instead of assuming a square 640x640 tensor.
    input_shape = model.get_inputs()[0].shape
    height, width = input_shape[2:4]
    if not isinstance(height, int) or not isinstance(width, int):
        raise ValueError(f"Unsupported dynamic detector size: {input_shape}")
    # Resize the *whole* scene to retain small background vehicles.
    rgb = photo.convert("RGB").resize((width, height), Image.Resampling.BILINEAR)
    arr = np.asarray(rgb, dtype=np.float32) / 255.0
    tensor = np.transpose(arr, (2, 0, 1))[None, ...]
    output = model.run(None, {model.get_inputs()[0].name: tensor})[0]
    if output.ndim != 3 or output.shape[0] != 1:
        raise ValueError("Unexpected detector output")
    detections = output[0]
    if detections.shape[0] != 84 and detections.shape[1] == 84:
        detections = detections.T
    if detections.shape[0] != 84:
        raise ValueError(f"Unsupported detector tensor {detections.shape}")
    indices = list(COCO_VEHICLES.keys())
    scores = detections[indices, :]
    strongest_class = np.argmax(scores, axis=0)
    strongest_score = np.max(scores, axis=0)
    hits = np.where(strongest_score >= 0.21)[0]
    candidates = []
    for i in hits:
        cx, cy, w, h = map(float, detections[:4, i])
        if w * h < width * height * 0.0025:
            continue
        box = [max(0, cx - w / 2), max(0, cy - h / 2),
               min(width, cx + w / 2), min(height, cy + h / 2)]
        if box[2] <= box[0] or box[3] <= box[1]:
            continue
        candidates.append({
            "class": COCO_VEHICLES[indices[int(strongest_class[i])]],
            "confidence": round(float(strongest_score[i]), 3),
            "bbox": [round(v, 1) for v in box]
        })
    # Dedupe overlapping model predictions while retaining truly separate cars.
    candidates.sort(key=lambda hit: hit["confidence"], reverse=True)
    distinct = []
    for hit in candidates:
        if all(overlap(hit["bbox"], existing["bbox"]) < 0.55 for existing in distinct):
            distinct.append(hit)
    return distinct[:15]


def review(detections):
    cars = [d for d in detections if d["class"] == "car"]
    if len(detections) > 1:
        return False, "Another vehicle detected in the scene"
    if len(cars) != 1:
        return False, "Unable to verify exactly one car"
    main = cars[0]
    x1, y1, x2, y2 = main["bbox"]
    if main["confidence"] < 0.36 or (x2 - x1) < 225 or (y2 - y1) < 95:
        return False, "Car too small or detection uncertain"
    return True, "Exactly one car detected; no other vehicles found automatically"


def build_photo(photo):
    # Keep the authentic background and composition; resize only, never crop.
    scene = ImageOps.exif_transpose(photo).convert("RGB")
    if min(scene.size) < 260:
        raise ValueError("Source too small for photo-mode display")
    scene.thumbnail((1400, 1000), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    scene.save(buf, "JPEG", optimize=True, quality=86, progressive=True)
    if buf.tell() > 3_000_000:
        raise ValueError("JPEG exceeds 3 MB")
    return buf.getvalue(), scene.size


def main():
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    manifest = {e["id"]: e for e in json.loads(MANIFEST.read_text(encoding="utf-8"))["cars"]}
    previous = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    previous_rejects = {e["id"]: e for e in previous.get("rejected", [])}
    approved = []
    rejected = []
    http = requests.Session()
    http.headers.update({"User-Agent": UA})
    checker = None
    for car in data:
        item = manifest.get(car["id"])
        if item is None or car.get("origin") != "photograph":
            continue
        photo_path = ROOT / "public/cars" / (car["id"] + "-photo.jpg")
        if car.get("photo") and photo_path.is_file():
            approved.append({"id": car["id"], "reason": "Photo already accepted in prior run"})
            continue
        if (car["id"] in previous_rejects
                and not previous_rejects[car["id"]]["reason"].startswith("Verification unavailable")
                and os.environ.get("RECHECK_PHOTOS") != "1"):
            rejected.append(previous_rejects[car["id"]])
            continue
        try:
            image_url = get_commons_url(http, item)
            if not image_url:
                raise ValueError("Commons returned no image URL")
            raw = download(http, image_url)
            with Image.open(io.BytesIO(raw)) as original:
                photo = ImageOps.exif_transpose(original).convert("RGB")
            if checker is None:
                checker = model_session(http)
            detections = detect_vehicles(checker, photo)
            ok, reason = review(detections)
            if not ok:
                rejected.append({"id": car["id"], "reason": reason, "detected": detections})
                print(f"NO PHOTO {car['id']}: {reason}; preserving current cutout", flush=True)
                continue
            jpeg, dims = build_photo(photo)
            photo_path.write_bytes(jpeg)
            car["photo"] = "cars/" + photo_path.name
            changes = car["credits"]["changes"]
            addition = " Original scene also resized and exported as JPEG for framed photo modes."
            if addition not in changes:
                car["credits"]["changes"] = changes + addition
            approved.append({"id": car["id"], "reason": reason, "detected": detections,
                             "dimensions": list(dims), "bytes": len(jpeg)})
            print(f"PHOTO OK {car['id']}: {dims[0]}x{dims[1]}", flush=True)
        except Exception as exc:
            rejected.append({"id": car["id"], "reason": "Verification unavailable: " + str(exc)[:230]})
            print(f"NO PHOTO {car['id']}: {exc}; existing cutout preserved", file=sys.stderr, flush=True)
    REPORT.write_text(json.dumps({
        "rule": "Only one detectable car and no other detectable vehicle in the source photo.",
        "detector": "YOLOv8n COCO ONNX SHA256 pinned; conservative automated screening only",
        "manuallyReviewed": False,
        "warning": "Small, obscured or distant background cars may go undetected. Human visual review remains necessary.",
        "approved": approved, "rejected": rejected,
        "totalOriginalPhotos": len([c for c in data if c.get("photo")]),
        "totalCars": len(data)
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    CATALOG.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"PHOTO FRAME AUDIT: {len(approved)} ready, {len(rejected)} not approved; original cutouts retained.", flush=True)


if __name__ == "__main__":
    main()
