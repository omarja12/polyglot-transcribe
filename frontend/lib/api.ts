import { UsageInfo } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.detail || fallback;
  } catch {
    return fallback;
  }
}

export async function transcribeChunk(
  blob: Blob,
  language: string,
  clientId: string
): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "chunk.webm");
  form.append("language", language);
  form.append("client_id", clientId);

  const res = await fetch(`${API_URL}/transcribe/chunk`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res, "Transcription failed."));
  const data = await res.json();
  return data.text as string;
}

export async function transcribeFile(
  file: File,
  language: string,
  clientId: string,
  preprocess: boolean = true
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("language", language);
  form.append("client_id", clientId);
  form.append("preprocess", String(preprocess));

  const res = await fetch(`${API_URL}/transcribe/file`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res, "Transcription failed."));
  const data = await res.json();
  return data.text as string;
}

export async function generateReport(
  transcript: string,
  prompt: string | null,
  clientId: string
): Promise<string> {
  const res = await fetch(`${API_URL}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, prompt, client_id: clientId }),
  });
  if (!res.ok) throw new Error(await readError(res, "Report generation failed."));
  const data = await res.json();
  return data.report as string;
}

export async function getUsage(clientId: string): Promise<UsageInfo> {
  const res = await fetch(`${API_URL}/usage/${clientId}`);
  if (!res.ok) throw new Error("Failed to fetch usage.");
  return res.json();
}

export async function getConfig(): Promise<{ report_model?: string; fallback_report_model?: string; transcribe_model?: string }>{
  try {
    const res = await fetch(`${API_URL}/config`);
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function preprocessSave(file: File, filename?: string): Promise<{ saved: string; public_path: string }>{
  const form = new FormData();
  form.append('file', file);
  if (filename) form.append('filename', filename);
  const res = await fetch(`${API_URL}/preprocess/save`, { method: 'POST', body: form });
  if (!res.ok) throw new Error((await res.json()).detail || 'Failed to save preprocessed example.');
  return res.json();
}

export async function listExamples(): Promise<{ name: string; public_path: string; size_bytes: number }[]> {
  try {
    const res = await fetch(`${API_URL}/examples/list`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.examples || [];
  } catch {
    return [];
  }
}
