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
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png" />
          <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png" />
          <link rel="apple-touch-icon" href="/logo-monogram.svg" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="theme-color" content="#0EA5A4" />

          {/* Open Graph / Social */}
          <meta property="og:title" content="Polyglot Transcribe" />
          <meta property="og:description" content="Near real-time transcription and AI-generated reports in French, Arabic, and English." />
          <meta property="og:image" content="/share-preview.png" />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Polyglot Transcribe" />
          <meta name="twitter:description" content="Near real-time transcription and AI-generated reports in French, Arabic, and English." />
          <meta name="twitter:image" content="/share-preview.png" />
        </head>
        <body>{children}</body>
      </html>
  );
}
