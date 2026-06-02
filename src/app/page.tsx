"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"join" | "create">("join");

  const [joinCode, setJoinCode] = useState(() => searchParams.get("code")?.toUpperCase() ?? "");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

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
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-screen">

      {/* Hero */}
      <div className="mb-10 text-center select-none animate-slide-up">
        <div className="text-6xl mb-3">🎂</div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-gradient-party mb-2">
          Party Game
        </h1>
        <p className="text-indigo-300/70 text-base font-medium">
          Nadav&apos;s 28th Birthday&nbsp;·&nbsp;Quiplash-style
        </p>
      </div>

      <div className="w-full max-w-sm animate-slide-up-1">

        {/* Tab switcher */}
        <div className="flex rounded-2xl overflow-hidden glass mb-6 p-1 gap-1">
          {(["join", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                tab === t
                  ? "bg-purple-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {t === "join" ? "Join a Room" : "Create Room"}
            </button>
          ))}
        </div>

        {tab === "join" ? (
          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div className="animate-slide-up-1">
              <label className="block text-xs font-bold text-indigo-300/70 uppercase tracking-widest mb-2">
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
                className="w-full px-4 py-4 rounded-2xl glass text-white text-center text-4xl font-black tracking-widest placeholder-white/20 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/30 transition-all"
              />
            </div>
            <div className="animate-slide-up-2">
              <label className="block text-xs font-bold text-indigo-300/70 uppercase tracking-widest mb-2">
                Your Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                autoCorrect="off"
                className="auto-dir w-full px-4 py-4 rounded-2xl glass text-white text-xl placeholder-white/20 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/30 transition-all"
              />
            </div>
            {joinError && (
              <p className="text-rose-400 text-sm text-center font-medium animate-slide-up" role="alert">
                {joinError}
              </p>
            )}
            <button
              type="submit"
              disabled={joinLoading}
              className="btn btn-purple w-full py-5 text-xl rounded-2xl animate-slide-up-3"
            >
              {joinLoading ? "Joining…" : "Join Game 🎉"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="animate-slide-up-1">
              <label className="block text-xs font-bold text-indigo-300/70 uppercase tracking-widest mb-2">
                Host PIN
              </label>
              <input
                type="text"
                value={hostPin}
                onChange={(e) => setHostPin(e.target.value)}
                placeholder="Choose a PIN (≥ 4 chars)"
                maxLength={20}
                autoCorrect="off"
                className="w-full px-4 py-4 rounded-2xl glass text-white text-xl placeholder-white/20 focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/30 transition-all"
              />
              <p className="mt-2 text-xs text-white/30 text-center">
                You&apos;ll need this PIN to control the game from the host screen.
              </p>
            </div>
            {createError && (
              <p className="text-rose-400 text-sm text-center font-medium animate-slide-up" role="alert">
                {createError}
              </p>
            )}
            <button
              type="submit"
              disabled={createLoading}
              className="btn btn-purple w-full py-5 text-xl rounded-2xl animate-slide-up-2"
            >
              {createLoading ? "Creating…" : "Create Room 🎮"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin-game" />
      </div>
    }>
      <HomePageContent />
    </Suspense>
  );
}
