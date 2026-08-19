"""Simple test script to POST a sample transcript to the backend /report endpoint.

Usage (PowerShell):
  Open a PowerShell prompt in the backend folder and run:
    python -m venv .venv
    # Allow scripts for this session if needed:
    # Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    # Activate the venv (dot + space):
    # . ./.venv/Scripts/Activate.ps1
    pip install requests
    python test_report.py

Or run without a virtualenv if you already have requests installed.
The script reads API_URL from the environment (defaults to http://127.0.0.1:8000).

It prints the HTTP status code and the response body. If the response is JSON it is pretty-printed.
"""

import os
import json
import sys

try:
    import requests
except ImportError:
    print("The 'requests' package is required. Install it with: pip install requests")
    sys.exit(1)

API_URL = os.environ.get("API_URL", "http://127.0.0.1:8000")
REPORT_ENDPOINT = f"{API_URL.rstrip('/')}/report"

payload = {
    "transcript": "Hello world. This is an automated test transcript for Polyglot Transcribe.",
    "client_id": "test_script",
}

print(f"Posting to {REPORT_ENDPOINT}")
try:
    res = requests.post(REPORT_ENDPOINT, json=payload, timeout=60)
except requests.exceptions.RequestException as exc:
    print("Request failed:", exc)
    sys.exit(2)

print("Status:", res.status_code)
ct = res.headers.get("Content-Type", "")
if "application/json" in ct:
    try:
        j = res.json()
        print(json.dumps(j, indent=2, ensure_ascii=False))
    except Exception:
        print(res.text)
else:
    print(res.text)

if res.status_code != 200:
    print("\nIf this is an error from Groq, check the backend terminal for the full traceback and paste the JSON error here (do not include your API key).")
