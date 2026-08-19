import os
from typing import Optional
import re
import subprocess
import tempfile
import shutil
from pathlib import Path
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# Models can be overridden via environment variables. Default REPORT_MODEL is set to
# an available Groq-hosted model observed on the account (qwen/qwen3.6-27b) so the
# app works even if access to specific models isn't enabled for the API key.
TRANSCRIBE_MODEL = os.getenv("GROQ_TRANSCRIBE_MODEL", "whisper-large-v3")
REPORT_MODEL = os.getenv("GROQ_REPORT_MODEL", "qwen/qwen3.6-27b")
FALLBACK_REPORT_MODEL = os.getenv("GROQ_FALLBACK_REPORT_MODEL", "groq/compound")

LANGUAGE_MAP = {"fr": "fr", "ar": "ar", "en": "en"}

DEFAULT_REPORT_PROMPT = (
    "You are an assistant that writes clear, structured meeting or consultation reports. "
    "Given the transcript below, produce a concise report with these sections: Summary, "
    "Key Points, Decisions, and Follow-up Actions. Stay strictly factual and do not add "
    "information that is not present in the transcript. "
    "Do not include internal deliberation, chain-of-thought, or markers like <think>...</think>; "
    "output only the final, user-facing report in plain text."
)

app = FastAPI(title="Polyglot Transcribe API")


def _sanitize_report_text(text: str) -> str:
    """Remove internal reasoning markers and common chain-of-thought preambles from model output.
    Keeps the user-facing report content while stripping <think>...</think> blocks and phrases like
    "Here's a thinking process". Also collapses multiple blank lines.
    """
    if not text:
        return text

    # Remove <think>...</think> blocks
    text = re.sub(r"(?is)<think>.*?</think>", "", text)

    # Remove common 'thinking process' preamble blocks up to the first blank line
    text = re.sub(r"(?is)here(?:'|’)s a thinking process:.*?(?:\n\s*\n|$)", "", text)
    text = re.sub(r"(?is)here(?:'|’)s an? analysis:.*?(?:\n\s*\n|$)", "", text)

    # Remove lines that look like internal deliberation headings
    text = re.sub(r"(?im)^\s*\*\*?think\*\*?\s*$", "", text)

    # Remove any remaining angle-bracket markers like <think> or </think>
    text = text.replace("<think>", "").replace("</think>", "")

    # Collapse multiple blank lines into two
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Trim
    return text.strip()

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


def _preprocess_audio_bytes(audio_bytes: bytes, filename: str) -> bytes:
    """Run ffmpeg preprocessing on uploaded audio bytes and return processed bytes.
    If ffmpeg is unavailable or processing fails, returns the original bytes.
    """
    try:
        with tempfile.TemporaryDirectory() as td:
            src_path = Path(td) / (Path(filename).stem + Path(filename).suffix)
            out_path = Path(td) / (Path(filename).stem + "_prepped.wav")
            # Write source bytes
            with open(src_path, "wb") as f:
                f.write(audio_bytes)

            # Build ffmpeg command: resample to 16k mono, basic denoise, loudness normalize
            cmd = [
                "ffmpeg",
                "-y",
                "-i",
                str(src_path),
                "-af",
                "highpass=f=100, lowpass=f=8000, afftdn=nf=-25, loudnorm",
                "-ac",
                "1",
                "-ar",
                "16000",
                str(out_path),
            ]

            logger.info("Running ffmpeg preprocessing: %s", " ".join(cmd))
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode != 0:
                logger.warning("ffmpeg preprocessing failed: %s", res.stderr)
                return audio_bytes

            with open(out_path, "rb") as f:
                processed = f.read()
            logger.info("Preprocessing complete, produced %d bytes", len(processed))
            return processed
    except FileNotFoundError:
        logger.warning("ffmpeg not found; skipping preprocessing")
        return audio_bytes
    except Exception as exc:  # noqa: BLE001
        logger.exception("Error during audio preprocessing: %s", exc)
        return audio_bytes


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def health():
    return {"status": "ok", "service": "polyglot-transcribe-api"}


@app.get("/models")
def list_models():
    """Returns a list of Groq models accessible to the configured API key.
    Call this endpoint locally after setting GROQ_API_KEY in backend/.env to see
    which models your account can use (helps diagnose model access).
    """
    try:
        res = client.models.list()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Could not list models: {exc}") from exc

    # Normalize different possible response shapes into a simple list of model ids/names.
    model_list = []
    try:
        data = getattr(res, "data", res)
        if isinstance(data, list):
            for m in data:
                if isinstance(m, dict):
                    model_list.append(m.get("id") or m.get("name") or str(m))
                else:
                    # fallback to string representation
                    model_list.append(getattr(m, "id", str(m)))
        else:
            model_list.append(str(data))
    except Exception:
        model_list = [str(res)]

    return {"models": model_list}


@app.get("/config")
def get_config():
    """Returns the backend's configured model names so the frontend can display them.
    This is safe to expose (no API keys) and helps the UI show which report/transcribe
    models are currently in use.
    """
    return {
        "report_model": REPORT_MODEL,
        "fallback_report_model": FALLBACK_REPORT_MODEL,
        "transcribe_model": TRANSCRIBE_MODEL,
    }


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

    # Attempt server-side preprocessing to improve accuracy on noisy uploads
    processed_bytes = _preprocess_audio_bytes(audio_bytes, file.filename or "audio.mp3")

    try:
        text = _transcribe_bytes(processed_bytes, file.filename or "audio.mp3", language)
    except Exception as exc:  # noqa: BLE001
        # If transcription of preprocessed audio fails, fall back to original audio
        logger.warning("Transcription failed on preprocessed audio, retrying original: %s", exc)
        try:
            text = _transcribe_bytes(audio_bytes, file.filename or "audio.mp3", language)
        except Exception as exc2:
            raise HTTPException(status_code=502, detail=f"Transcription failed: {exc2}") from exc2

    return {"text": text}


class ReportRequest(BaseModel):
    transcript: str
    prompt: Optional[str] = None
    client_id: str = "anonymous"


@app.get("/report")
def report_info():
    """Helper GET endpoint that explains how to call /report (POST-only).
    Visiting /report in a browser will return this message with a curl example.
    """
    example = (
        "curl -s -X POST http://127.0.0.1:8000/report -H 'Content-Type: application/json' "
        "-d '{\"transcript\":\"Hello world. Short test.\",\"client_id\":\"test\"}'"
    )
    return {
        "detail": "This endpoint accepts POST requests. Use the example curl command to generate a report.",
        "example_curl": example,
    }


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
        # Provide clearer diagnostics for common model-access issues and optionally
        # attempt a configured fallback model so the app can continue to run.
        msg = str(exc).lower()
        access_indicators = ("401", "403", "access denied", "not authorized", "permission", "forbidden")
        if any(ind in msg for ind in access_indicators):
            detail = (
                f"Model access denied for '{REPORT_MODEL}'. Your GROQ_API_KEY may not be authorized to use this model. "
                "Check the Groq dashboard to enable model access or set GROQ_REPORT_MODEL to a model your account can use."
            )
            if FALLBACK_REPORT_MODEL:
                try:
                    completion = client.chat.completions.create(
                        model=FALLBACK_REPORT_MODEL,
                        messages=[
                            {
                                "role": "user",
                                "content": f"{prompt}\n\n---\nTRANSCRIPT:\n{payload.transcript}",
                            }
                        ],
                    )
                    text = completion.choices[0].message.content
                except Exception as exc2:  # noqa: BLE001
                    raise HTTPException(status_code=502, detail=f"{detail} Also fallback failed: {exc2}") from exc2
            else:
                raise HTTPException(status_code=403, detail=detail) from exc
        if "404" in msg or "model not found" in msg:
            raise HTTPException(status_code=404, detail=f"Model '{REPORT_MODEL}' not available to this account: {exc}") from exc
        raise HTTPException(status_code=502, detail=f"Report generation failed: {exc}") from exc

    # Sanitize the model output to remove any internal reasoning markers before returning to the frontend
    text = _sanitize_report_text(text)
    return {"report": text}


@app.get("/usage/{client_id}")
def get_usage(client_id: str):
    used_seconds = _usage_seconds_by_client.get(client_id, 0.0)
    return {
        "used_minutes": round(used_seconds / 60, 2),
        "limit_minutes": DAILY_USAGE_LIMIT_SECONDS / 60,
        "remaining_minutes": round(max(0, DAILY_USAGE_LIMIT_SECONDS - used_seconds) / 60, 2),
    }
