import requests
import os

RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")

def fetch_status(endpoint_id: str, run_id: str):
    url = f"https://api.runpod.ai/v2/{endpoint_id}/status/{run_id}"
    headers = { "Authorization": f"Bearer {RUNPOD_API_KEY}" }
    r = requests.get(url, headers=headers, timeout=10)
    r.raise_for_status()
    return r.json()
