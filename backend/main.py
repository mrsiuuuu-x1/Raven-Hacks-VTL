from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from detector import analyze_image
from exif_analyzer import analyze_exif
import shutil
import os
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/tiff"}
MAX_FILE_SIZE = 50 * 1024 * 1024

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WEBP, TIFF.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB.")

    ext = os.path.splitext(file.filename)[-1].lower() if file.filename else ".jpg"
    temp_path = f"temp_{uuid.uuid4().hex}{ext}"

    with open(temp_path, "wb") as buffer:
        buffer.write(contents)

    try:
        detection_result = analyze_image(temp_path)
        exif_result = analyze_exif(temp_path)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {
        "score": detection_result["score"],
        "verdict": detection_result["verdict"],
        "exif_flags": exif_result["flags"],
        "exif_values": exif_result["values"]
    }