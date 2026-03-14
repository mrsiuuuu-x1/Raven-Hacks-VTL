import requests
import os
from dotenv import load_dotenv

load_dotenv()

HIVE_API_KEY = os.getenv("HIVE_API_KEY")

def get_verdict(score: float) -> str:
    if score < 30:
        return "Real"
    elif score < 70:
        return "Likely AI"
    else:
        return "Definitely AI"
    
def analyze_image(image_path: str) -> dict:
    url = "https://api.thehive.ai/api/v2/task/sync"
    headers = {
        "Authorization": f"Token {HIVE_API_KEY}"
    }

    with open(image_path, "rb") as image_file:
        files = {"image": image_file}
        response = requests.post(url, headers=headers)
    
    if response.status_code != 200:
        return {"score": 0.0, "verdict": "Error - could not analyze image"}
    
    data = response.json()

    classes = data["status"][0]["response"]["ouptut"][0]["classes"]
    ai_score = next(
        (c["score"] for c in classes if c["class"] == "ai_generated"),
        0.0
    )

    score = round(ai_score * 100, 1)
    verdict = get_verdict(score)
    return {"score": score, "verdict":verdict}