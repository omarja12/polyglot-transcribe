"use client";

import React from "react";

export function MicIcon({ className = "", title = "Mic" }: { className?: string; title?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>{title}</title>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 11v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 21v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function UploadIcon({ className = "", title = "Upload" }: { className?: string; title?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>{title}</title>
      <path d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 8l-5-5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 3v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function CopyIcon({ className = "", title = "Copy" }: { className?: string; title?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>{title}</title>
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export function ExportIcon({ className = "", title = "Export" }: { className?: string; title?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>{title}</title>
      <path d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 10l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 5v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function GitHubIcon({ className = "", title = "GitHub" }: { className?: string; title?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <title>{title}</title>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.6-3.37-1.19-3.37-1.19-.45-1.17-1.11-1.48-1.11-1.48-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.26-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85.004 1.71.114 2.51.336 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.66.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85 0 1.33-.01 2.41-.01 2.74 0 .26.18.58.69.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10z" fill="currentColor"/>
    </svg>
  );
}
