import requests
import os
import mimetypes
from dotenv import load_dotenv

load_dotenv()

HF_API_KEY = os.getenv("HF_API_KEY")

def get_verdict(score: float) -> str:
    if score < 30:
        return "Real"
    elif score < 70:
        return "Likely AI"
    else:
        return "Definitely AI"

def analyze_image(image_path: str) -> dict:
    
    url = "https://router.huggingface.co/hf-inference/models/umm-maybe/AI-image-detector"
    
    content_type, _ = mimetypes.guess_type(image_path)
    content_type = content_type or "image/jpeg"

    with open(image_path, "rb") as image_file:
        response = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {HF_API_KEY}",
                "Content-Type": content_type
            },
            data=image_file
        )
    
    if response.status_code != 200:
        return {"score": 0.0, "verdict": "Error — could not analyze image"}
    
    data = response.json()
    
    ai_score = next(
        (item["score"] for item in data if item["label"] == "FAKE"),
        0.0
    )
    
    score = round(ai_score * 100, 1)
    verdict = get_verdict(score)
    
    return {"score": score, "verdict": verdict}