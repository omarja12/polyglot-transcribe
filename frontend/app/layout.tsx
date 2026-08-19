import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polyglot Transcribe",
  description:
    "Near real-time transcription and AI-generated reports in French, Arabic, and English.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/logo-monogram.svg" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#0EA5A4" />
      </head>
      <body>{children}</body>
    </html>
  );
}
