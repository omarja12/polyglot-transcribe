import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError(
        "GROQ_API_KEY environment variable is not set. "
        "Copy backend/.env.example to backend/.env and add your key."
    )

client = Groq(api_key=GROQ_API_KEY)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MAX_UPLOAD_MB = 50
DAILY_USAGE_LIMIT_SECONDS = 60 * 60  # 60 minutes of processed audio, per client

TRANSCRIBE_MODEL = "whisper-large-v3"
REPORT_MODEL = "llama-3.3-70b-versatile"

LANGUAGE_MAP = {"fr": "fr", "ar": "ar", "en": "en"}

DEFAULT_REPORT_PROMPT = (
    "You are an assistant that writes clear, structured meeting or consultation reports. "
    "Given the transcript below, produce a concise report with these sections: Summary, "
    "Key Points, Decisions, and Follow-up Actions. Stay strictly factual and do not add "
    "information that is not present in the transcript."
)

app = FastAPI(title="Polyglot Transcribe API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Naive in-memory usage tracking.
# Resets whenever the server process restarts. Good enough for a portfolio
# demo; swap for a real database or Redis if this ever needs to survive
# restarts or scale across multiple server instances.
# ---------------------------------------------------------------------------
_usage_seconds_by_client: dict[str, float] = {}


def _check_and_record_usage(client_id: str, seconds: float) -> None:
    used = _usage_seconds_by_client.get(client_id, 0.0)
    if used + seconds > DAILY_USAGE_LIMIT_SECONDS:
        raise HTTPException(status_code=429, detail="Usage limit reached for this session.")
    _usage_seconds_by_client[client_id] = used + seconds


def _transcribe_bytes(audio_bytes: bytes, filename: str, language: Optional[str]) -> str:
    kwargs = {"file": (filename, audio_bytes), "model": TRANSCRIBE_MODEL}
    if language in LANGUAGE_MAP:
        kwargs["language"] = LANGUAGE_MAP[language]
    result = client.audio.transcriptions.create(**kwargs)
    return result.text


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def health():
    return {"status": "ok", "service": "polyglot-transcribe-api"}


@app.post("/transcribe/chunk")
async def transcribe_chunk(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    client_id: str = Form("anonymous"),
):
    """Transcribes a short (~5s) audio chunk. Called repeatedly by the
    frontend's near-real-time recorder loop."""
    audio_bytes = await file.read()
    size_mb = len(audio_bytes) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(status_code=413, detail=f"Chunk exceeds {MAX_UPLOAD_MB} MB limit.")

    # Each chunk is assumed to represent ~5 seconds of audio for quota purposes.
    _check_and_record_usage(client_id, seconds=5.0)

    try:
        text = _transcribe_bytes(audio_bytes, file.filename or "chunk.webm", language)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}") from exc

    return {"text": text}


@app.post("/transcribe/file")
async def transcribe_file(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    client_id: str = Form("anonymous"),
):
    """Transcribes a full uploaded audio file in one shot."""
    audio_bytes = await file.read()
    size_mb = len(audio_bytes) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_MB} MB limit.")

    # Rough estimate for quota purposes: ~1 MB per minute of compressed speech.
    estimated_minutes = max(0.5, size_mb)
    _check_and_record_usage(client_id, seconds=estimated_minutes * 60)

    try:
        text = _transcribe_bytes(audio_bytes, file.filename or "audio.mp3", language)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Transcription failed: {exc}") from exc

    return {"text": text}


class ReportRequest(BaseModel):
    transcript: str
    prompt: Optional[str] = None
    client_id: str = "anonymous"


@app.post("/report")
async def generate_report(payload: ReportRequest):
    """Generates a structured report from a transcript using a Groq-hosted LLM.
    Uses DEFAULT_REPORT_PROMPT unless the caller supplies their own prompt."""
    if not payload.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    prompt = (
        payload.prompt.strip()
        if payload.prompt and payload.prompt.strip()
        else DEFAULT_REPORT_PROMPT
    )

    try:
        completion = client.chat.completions.create(
            model=REPORT_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": f"{prompt}\n\n---\nTRANSCRIPT:\n{payload.transcript}",
                }
            ],
        )
        text = completion.choices[0].message.content
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Report generation failed: {exc}") from exc

    return {"report": text}


@app.get("/usage/{client_id}")
def get_usage(client_id: str):
    used_seconds = _usage_seconds_by_client.get(client_id, 0.0)
    return {
        "used_minutes": round(used_seconds / 60, 2),
        "limit_minutes": DAILY_USAGE_LIMIT_SECONDS / 60,
        "remaining_minutes": round(max(0, DAILY_USAGE_LIMIT_SECONDS - used_seconds) / 60, 2),
    }
