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
      <body>{children}</body>
    </html>
  );
}
