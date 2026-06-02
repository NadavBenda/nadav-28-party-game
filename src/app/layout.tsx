import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Party Game 🎂",
  description: "A Quiplash-style party game for Nadav's birthday",
  // Prevent search engines from indexing a private party app
  robots: "noindex",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,   // prevents iOS double-tap zoom on buttons
  userScalable: false,
  themeColor: "#0f0f1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#0f0f1a] text-[#f0f0ff] overscroll-none">
        {children}
      </body>
    </html>
  );
}
