"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [tab, setTab] = useState<"join" | "create">("join");

  // Join form state
  const [joinCode, setJoinCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Create form state
  const [hostPin, setHostPin] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    if (!joinCode.trim() || !nickname.trim()) {
      setJoinError("Room code and nickname are required.");
      return;
    }
    setJoinLoading(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: joinCode.trim().toUpperCase(),
          nickname: nickname.trim(),
        }),
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
    if (!hostPin.trim()) {
      setCreateError("PIN is required.");
      return;
    }
    if (hostPin.trim().length < 4) {
      setCreateError("PIN must be at least 4 characters.");
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostPin: hostPin.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error ?? "Failed to create room.");
        return;
      }
      sessionStorage.setItem("hostPin", hostPin.trim());
      router.push(`/host/${data.code}`);
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 min-h-screen">
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
          Party Game
        </h1>
        <p className="mt-2 text-gray-400 text-sm">
          Quiplash-style · Made for Nadav&apos;s birthday 🎂
        </p>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex rounded-xl overflow-hidden border border-white/10 mb-6">
          <button
            onClick={() => setTab("join")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "join"
                ? "bg-purple-600 text-white"
                : "bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            Join a Room
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
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
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Room Code
              </label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABCDE"
                maxLength={6}
                autoCapitalize="characters"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center text-2xl font-bold tracking-widest placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Your Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Moshe"
                maxLength={20}
                className="auto-dir w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xl placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
              />
            </div>
            {joinError && (
              <p className="text-red-400 text-sm text-center">{joinError}</p>
            )}
            <button
              type="submit"
              disabled={joinLoading}
              className="mt-2 w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joinLoading ? "Joining…" : "Join Game"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Host PIN
              </label>
              <input
                type="text"
                value={hostPin}
                onChange={(e) => setHostPin(e.target.value)}
                placeholder="Choose a PIN"
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xl placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
              />
              <p className="mt-1 text-xs text-gray-500">
                You&apos;ll need this PIN to access the host screen.
              </p>
            </div>
            {createError && (
              <p className="text-red-400 text-sm text-center">{createError}</p>
            )}
            <button
              type="submit"
              disabled={createLoading}
              className="mt-2 w-full py-4 rounded-xl bg-pink-600 hover:bg-pink-500 active:scale-95 text-white text-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createLoading ? "Creating…" : "Create Room"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
