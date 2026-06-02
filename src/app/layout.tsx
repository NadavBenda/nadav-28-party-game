import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Party Game 🎂",
  description: "A Quiplash-style party game for Nadav's birthday",
  robots: "noindex",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0a1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-[#0a0a1a] text-[#f0f0ff] overscroll-none relative">
        {/* Ambient background orbs — purely decorative */}
        <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-purple-700/20 blur-3xl animate-float" />
          <div className="absolute -bottom-48 -right-32 w-[500px] h-[500px] rounded-full bg-indigo-700/18 blur-3xl animate-float-b" />
          <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full bg-violet-600/10 blur-2xl animate-float" />
        </div>
        <div className="relative z-0 flex flex-col min-h-full">
          {children}
        </div>
      </body>
    </html>
  );
}
