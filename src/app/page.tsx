"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"join" | "create">("join");

  // Join form — pre-fill code from ?code= query param if present
  const [joinCode, setJoinCode] = useState(() => searchParams.get("code")?.toUpperCase() ?? "");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Create form
  const [hostPin, setHostPin] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    const nick = nickname.trim();
    if (!code || !nick) {
      setJoinError("Room code and nickname are required.");
      return;
    }
    setJoinLoading(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, nickname: nick }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join room.");
        return;
      }
      sessionStorage.setItem("playerId", data.playerId);
      sessionStorage.setItem("playerNickname", data.nickname);
      router.push(`/play/${data.code}`);
    } catch {
      setJoinError("Network error. Please try again.");
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    const pin = hostPin.trim();
    if (!pin) { setCreateError("PIN is required."); return; }
    if (pin.length < 4) { setCreateError("PIN must be at least 4 characters."); return; }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostPin: pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create room.");
        return;
      }
      sessionStorage.setItem("hostPin", pin);
      router.push(`/host/${data.code}`);
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 min-h-screen">
      {/* Title */}
      <div className="mb-8 text-center select-none">
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
          Party Game
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          Quiplash-style · Made for Nadav&apos;s birthday 🎂
        </p>
      </div>

      <div className="w-full max-w-sm">
        {/* Tab switcher */}
        <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              tab === "join"
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            Join a Room
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              tab === "create"
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            Create Room (Host)
          </button>
        </div>

        {tab === "join" ? (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCDE"
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                className="w-full px-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white text-center text-3xl font-black tracking-widest placeholder-gray-700 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Your Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Moshe"
                maxLength={20}
                autoCorrect="off"
                className="auto-dir w-full px-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white text-xl placeholder-gray-700 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            {joinError && (
              <p className="text-red-400 text-sm text-center" role="alert">{joinError}</p>
            )}
            <button
              type="submit"
              disabled={joinLoading}
              className="mt-1 w-full py-5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xl font-black transition-all disabled:opacity-50"
            >
              {joinLoading ? "Joining…" : "Join Game"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Host PIN
              </label>
              <input
                type="text"
                value={hostPin}
                onChange={(e) => setHostPin(e.target.value)}
                placeholder="Choose a PIN (≥4 chars)"
                maxLength={20}
                autoCorrect="off"
                className="w-full px-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white text-xl placeholder-gray-700 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
              />
              <p className="mt-1 text-xs text-gray-600">
                You&apos;ll need this PIN to control the game from the host screen.
              </p>
            </div>
            {createError && (
              <p className="text-red-400 text-sm text-center" role="alert">{createError}</p>
            )}
            <button
              type="submit"
              disabled={createLoading}
              className="mt-1 w-full py-5 rounded-xl bg-pink-600 hover:bg-pink-500 active:scale-95 text-white text-xl font-black transition-all disabled:opacity-50"
            >
              {createLoading ? "Creating…" : "Create Room"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>}>
      <HomePageContent />
    </Suspense>
  );
}
