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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    temp_path = f"temp_{uuid.uuid4().hex}_{file.filename}"

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        detection_result = analyze_image(temp_path)
        exif_result = analyze_exif(temp_path)
    finally:
        os.remove(temp_path)

    return {
        "score": detection_result["score"],
        "verdict": detection_result["verdict"],
        "exif_flags": exif_result
    }