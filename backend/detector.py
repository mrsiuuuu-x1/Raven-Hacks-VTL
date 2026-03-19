import requests
import os
import mimetypes
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

HF_API_KEY = os.getenv("HF_API_KEY")
if not HF_API_KEY:
    raise RuntimeError("HF_API_KEY is not set — check your .env or Space secrets")

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
        try:
            response = requests.post(
                url,
                headers={
                    "Authorization": f"Bearer {HF_API_KEY}",
                    "Content-Type": content_type
                },
                data=image_file,
                timeout=30
            )
        except requests.Timeout:
            raise RuntimeError("HuggingFace inference timed out after 30 seconds")
        except requests.RequestException as e:
            raise RuntimeError(f"HuggingFace request failed: {e}")

    if response.status_code != 200:
        raise RuntimeError(
            f"HuggingFace inference failed: {response.status_code} {response.text}"
        )

    data = response.json()

    ai_entry = next((item for item in data if item["label"] == "artificial"), None)
    if ai_entry is None:
        logger.warning("HuggingFace response did not contain 'artificial' label. Response: %s", data)
        raise RuntimeError("Unexpected response from AI detector — 'artificial' label not found")

    score = round(ai_entry["score"] * 100, 1)
    verdict = get_verdict(score)

    return {"score": score, "verdict": verdict}