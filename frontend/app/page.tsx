"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { LANGUAGES, LanguageCode, UsageInfo } from "@/lib/types";
import { transcribeChunk, transcribeFile, generateReport, getUsage, getConfig } from "@/lib/api";

const CHUNK_MS = 5000;
const MAX_UPLOAD_MB = 50;
const DEFAULT_PROMPT =
  "You are an assistant that writes clear, structured meeting or consultation reports. " +
  "Given the transcript below, produce a concise report with these sections: Summary, " +
  "Key Points, Decisions, and Follow-up Actions. Stay strictly factual and do not add " +
  "information that is not present in the transcript.";

function getClientId(): string {
  if (typeof window === "undefined") return "server";
  const key = "polyglot_client_id";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(key, id);
  }
  return id;
}

export default function Home() {
  const [language, setLanguage] = useState<LanguageCode>("fr");
  const [mode, setMode] = useState<"live" | "upload">("upload");
  const [isListening, setIsListening] = useState(false);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [isTranscribingFile, setIsTranscribingFile] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; sizeMB: number } | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [report, setReport] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [copied, setCopied] = useState(false);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [reportModel, setReportModel] = useState<string | null>(null);
  const [transcribeModel, setTranscribeModel] = useState<string | null>(null);

  const clientIdRef = useRef<string>("");
  if (!clientIdRef.current && typeof window !== "undefined") {
    clientIdRef.current = getClientId();
  }

  const streamRef = useRef<MediaStream | null>(null);
  const listeningRef = useRef(false);
  const languageRef = useRef(language);
  languageRef.current = language;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshUsage = useCallback(async () => {
    try {
      const u = await getUsage(clientIdRef.current);
      setUsage(u);
    } catch {
      // non-fatal: usage display is best-effort
    }
  }, []);

  // Fetch backend config (models) so the UI shows the actual models in use.
  const loadConfig = useCallback(async () => {
    try {
      const cfg = await getConfig();
      if (cfg.report_model) setReportModel(cfg.report_model);
      if (cfg.transcribe_model) setTranscribeModel(cfg.transcribe_model);
    } catch {
      // ignore config errors
    }
  }, []);

  // Load config once on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const recordLoop = useCallback(() => {
    if (!listeningRef.current || !streamRef.current) return;

    const recorder = new MediaRecorder(streamRef.current);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      try {
        const text = await transcribeChunk(blob, languageRef.current, clientIdRef.current);
        if (text && text.trim()) {
          setTranscript((prev) => (prev ? `${prev} ${text.trim()}` : text.trim()));
        }
        refreshUsage();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chunk transcription failed.");
        listeningRef.current = false;
        setIsListening(false);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
      if (listeningRef.current) recordLoop();
    };

    recorder.start();
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, CHUNK_MS);
  }, [refreshUsage]);

  const startListening = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      listeningRef.current = true;
      setIsListening(true);
      recordLoop();
    } catch {
      setError("Microphone access was denied or unavailable.");
    }
  }, [recordLoop]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    setIsListening(false);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setReport("");
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_UPLOAD_MB) {
      setError(`File is too large (${sizeMB.toFixed(1)} MB). Maximum allowed is ${MAX_UPLOAD_MB} MB.`);
      setFileInfo(null);
      return;
    }
    setFileInfo({ name: file.name, sizeMB });
  }

  async function handleTranscribeFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setIsTranscribingFile(true);
    setError("");
    try {
      const text = await transcribeFile(file, language, clientIdRef.current);
      setTranscript(text);
      refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "File transcription failed.");
    } finally {
      setIsTranscribingFile(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy automatically. Please select and copy the text manually.");
    }
  }

  function handleExport() {
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${language}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleGenerateReport() {
    if (!transcript.trim()) return;
    setIsGeneratingReport(true);
    setError("");
    try {
      const text = await generateReport(transcript, prompt, clientIdRef.current);
      setReport(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed.");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <div className="eyebrow">Multilingual speech-to-report</div>
        <h1 className="title">Polyglot Transcribe</h1>
        <p className="subtitle">
          Near real-time transcription and AI-generated reports in French, Arabic, and
          English — powered by {transcribeModel || "Whisper large-v3"} and {reportModel || "the configured report model"} on Groq.
        </p>
        <div className="heroButtons">
          <button
            className="ctaBtn"
            onClick={() => {
              setMode("live");
              startListening();
            }}
          >
            Start Live
          </button>
          <button
            className="ctaBtn secondaryCta"
            onClick={() => {
              setMode("upload");
              fileInputRef.current?.click();
            }}
          >
            Upload Audio
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="controlsRow">
          <label className="fieldLabel" htmlFor="lang">
            Language
          </label>
          <select
            id="lang"
            className="select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>

          {usage && (
            <span className="usagePill">
              {usage.remaining_minutes.toFixed(1)} / {usage.limit_minutes} min left
            </span>
          )}
        </div>

        <div className="tabs">
          <button
            className={`tab ${mode === "live" ? "tabActive" : ""}`}
            onClick={() => setMode("live")}
          >
            Live (near real-time)
          </button>
          <button
            className={`tab ${mode === "upload" ? "tabActive" : ""}`}
            onClick={() => setMode("upload")}
          >
            Upload audio
          </button>
        </div>

        {mode === "live" ? (
          <div className="liveBlock">
            <button
              className={`primaryBtn ${isListening ? "recording" : ""}`}
              onClick={isListening ? stopListening : startListening}
            >
              {isListening ? "Stop listening" : "Start listening"}
            </button>
            {isListening && (
              <div className="waveform" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="bar" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            )}
            <p className="hint">
              Audio is captured in ~5 second chunks and transcribed as you speak.
            </p>
          </div>
        ) : (
          <div className="uploadBlock">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              className="fileInput"
              id="fileInput"
            />
            <label htmlFor="fileInput" className="uploadBtn">
              Choose an audio file
            </label>
            <p className="hint">Max file size: {MAX_UPLOAD_MB} MB.</p>
            {fileInfo && (
              <div className="fileRow">
                <span>{fileInfo.name}</span>
                <span className="fileMeta">{fileInfo.sizeMB.toFixed(1)} MB</span>
              </div>
            )}
            <button
              className="primaryBtn"
              disabled={!fileInfo || isTranscribingFile}
              onClick={handleTranscribeFile}
            >
              {isTranscribingFile ? "Transcribing…" : "Transcribe file"}
            </button>
          </div>
        )}

        {error && <div className="errorRow">{error}</div>}
      </section>

      {transcript && (
        <section className="panel">
          <div className="panelHead">
            <h2 className="panelTitle">Transcript</h2>
            <div className="actionRow">
              <button className="ghostBtn" onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button className="ghostBtn" onClick={handleExport}>
                Export .txt
              </button>
            </div>
          </div>
          <textarea
            className="textarea"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={8}
          />
        </section>
      )}

      {transcript && (
        <section className="panel">
          <h2 className="panelTitle">AI-generated report</h2>
          <label className="smallLabel">Prompt</label>
          <textarea
            className="promptArea"
            value={prompt}
            rows={3}
            onChange={(e) => setPrompt(e.target.value)}
          />
          {prompt !== DEFAULT_PROMPT && (
            <button className="linkBtn" onClick={() => setPrompt(DEFAULT_PROMPT)}>
              Reset to default prompt
            </button>
          )}
          <button
            className="primaryBtn"
            style={{ marginTop: 12 }}
            disabled={isGeneratingReport}
            onClick={handleGenerateReport}
          >
            {isGeneratingReport ? "Generating…" : "Generate report"}
          </button>
          {report && <div className="reportBox">{report}</div>}
        </section>
      )}

      <footer className="footer">
        Built with Next.js, FastAPI, and Groq (Whisper large-v3 + configured report model).
      </footer>
    </main>
  );
}
