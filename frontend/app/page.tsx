"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { LANGUAGES, LanguageCode, UsageInfo } from "@/lib/types";
import { transcribeChunk, transcribeFile, generateReport, getUsage, getConfig } from "@/lib/api";
import { MicIcon, UploadIcon, CopyIcon, ExportIcon } from "./icons";

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
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <a href="https://github.com/omarja12/polyglot-transcribe" target="_blank" rel="noopener noreferrer" title="View on GitHub">
              <img src="/logo-monogram.svg" alt="Polyglot" style={{height: 36}} />
            </a>
            <div style={{display: 'flex', flexDirection: 'column'}}>
              <div className="eyebrow">Multilingual speech-to-report</div>
              <h1 className="title" style={{margin: 0}}>Polyglot Transcribe</h1>
            </div>
          </div>

          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <a className="ghostBtn" href="https://github.com/omarja12/polyglot-transcribe" target="_blank" rel="noopener noreferrer" title="View source on GitHub">
              <span style={{display:'inline-flex', alignItems:'center', gap:8}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.19-3.37-1.19-.45-1.17-1.11-1.48-1.11-1.48-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.26-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85.004 1.71.114 2.51.336 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.66.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85 0 1.33-.01 2.41-.01 2.74 0 .26.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" fill="currentColor"/></svg> View on GitHub</span>
            </a>
          </div>
        </div>

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
            <span style={{display:'inline-flex', alignItems:'center', gap:8}}><MicIcon /> Start Live</span>
          </button>
          <button
            className="ctaBtn secondaryCta"
            onClick={() => {
              setMode("upload");
              fileInputRef.current?.click();
            }}
          >
            <span style={{display:'inline-flex', alignItems:'center', gap:8}}><UploadIcon /> Upload Audio</span>
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
        <div className="twoCol">
          <section className="panel two">
            <div className="panelHead">
              <h2 className="panelTitle">Transcript</h2>
              <div className="actionToolbar">
                <button className="iconBtn" onClick={handleCopy} title="Copy transcript"><CopyIcon />{copied ? "Copied" : "Copy"}</button>
                <button className="iconBtn" onClick={handleExport} title="Export transcript"><ExportIcon />Export .txt</button>
              </div>
            </div>
            <textarea
              className="textarea"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={12}
            />
          </section>

          <section className="panel two">
            <div className="panelHead">
              <h2 className="panelTitle">AI-generated report</h2>
              <div className="actionToolbar">
                <button className="iconBtn" onClick={() => { navigator.clipboard.writeText(report || "") }} title="Copy report"><CopyIcon />Copy</button>
                <button className="iconBtn" onClick={() => { /* placeholder for export report */ }} title="Export report"><ExportIcon />Export</button>
              </div>
            </div>

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
        </div>
      )}

      <section className="aboutPanel">
        <h3 className="aboutTitle">About & How it works</h3>
        <p className="aboutText">
          Polyglot Transcribe converts short audio snippets or uploaded recordings into clean
          meeting or consultation reports. The app transcribes audio (Whisper models) and then
          generates a structured report (summary, key points, decisions, follow-ups) using a
          configurable LLM on Groq. For portfolio demos, the report model is configurable via
          environment variables so the demo runs with your available account models.
        </p>
      </section>

      <footer className="footer">
        Built with Next.js, FastAPI, and Groq. Demo for portfolio use — adjust GROQ_REPORT_MODEL in
        the backend to select your preferred model.
      </footer>
    </main>
  );
}
