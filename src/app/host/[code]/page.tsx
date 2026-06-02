"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
import type { Room, Player } from "@/lib/types";

// ─── Tiny shared UI pieces ────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-xl animate-pulse">Loading…</div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="bg-red-900/40 border border-red-700 rounded-2xl p-8 text-center max-w-sm">
        <p className="text-red-300 text-lg">{message}</p>
      </div>
    </div>
  );
}

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({
  storedPin,
  onVerify,
}: {
  storedPin: string;
  onVerify: (pin: string) => void;
}) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() === storedPin) {
      onVerify(input.trim());
    } else {
      setErr("Wrong PIN. Try again.");
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-4">
        <h1 className="text-3xl font-black text-center text-purple-300">Host Access</h1>
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setErr(""); }}
          placeholder="Enter host PIN"
          autoFocus
          className="px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-xl text-center placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
        />
        {err && <p className="text-red-400 text-sm text-center">{err}</p>}
        <button
          type="submit"
          className="py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-lg font-bold transition-colors"
        >
          Enter
        </button>
      </form>
    </div>
  );
}

// ─── Host Lobby ───────────────────────────────────────────────────────────────

function HostLobby({
  room,
  players,
  pin,
}: {
  room: Room;
  players: Player[];
  pin: string;
}) {
  const [promptsText, setPromptsText] = useState("");
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  async function savePrompts(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const lines = promptsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) { setSaveError("Enter at least one prompt."); return; }
    setSavingPrompts(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, prompts: lines }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Failed to save prompts."); return; }
      setSavedCount(data.count);
    } catch {
      setSaveError("Network error.");
    } finally {
      setSavingPrompts(false);
    }
  }

  async function startGame() {
    setStartError("");
    setStarting(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action: "start_round" }),
      });
      const data = await res.json();
      if (!res.ok) { setStartError(data.error ?? "Failed to start game."); }
    } catch {
      setStartError("Network error.");
    } finally {
      setStarting(false);
    }
  }

  const canStart = savedCount !== null && savedCount > 0 && players.length >= 2;

  return (
    <div className="min-h-screen flex flex-col p-8 max-w-4xl mx-auto w-full">
      {/* Room code header */}
      <div className="text-center mb-8">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Room Code</p>
        <p className="text-8xl font-black text-purple-300 tracking-widest">{room.code}</p>
        <p className="text-gray-500 text-sm mt-2">Players join at the game URL</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        {/* Player list */}
        <div className="bg-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
            <span className="text-2xl">👥</span>
            Players
            <span className="ml-auto bg-purple-700 text-white text-sm font-bold px-2 py-0.5 rounded-full">
              {players.length}
            </span>
          </h2>
          {players.length === 0 ? (
            <p className="text-gray-600 text-sm">Waiting for players to join…</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2"
                >
                  <span className="text-purple-400 font-bold">{p.nickname}</span>
                </li>
              ))}
            </ul>
          )}
          {players.length < 2 && (
            <p className="mt-4 text-yellow-500 text-xs">Need at least 2 players to start.</p>
          )}
        </div>

        {/* Prompt import */}
        <div className="bg-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">
            <span className="text-2xl">📝</span>
            Prompts
          </h2>
          <form onSubmit={savePrompts} className="flex flex-col gap-3">
            <textarea
              value={promptsText}
              onChange={(e) => { setPromptsText(e.target.value); setSavedCount(null); }}
              placeholder={"One prompt per line:\n\nWhat is the most Nadav thing Nadav could do?\nComplete this sentence: Nadav walks into a bar…"}
              rows={8}
              className="auto-dir w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
            />
            {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
            {savedCount !== null && (
              <p className="text-green-400 text-sm">✓ {savedCount} prompts saved.</p>
            )}
            <button
              type="submit"
              disabled={savingPrompts || !promptsText.trim()}
              className="py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50"
            >
              {savingPrompts ? "Saving…" : "Save Prompts"}
            </button>
          </form>
        </div>
      </div>

      {/* Start button */}
      <div className="mt-8 text-center">
        {startError && <p className="text-red-400 text-sm mb-3">{startError}</p>}
        <button
          onClick={startGame}
          disabled={!canStart || starting}
          className="px-16 py-5 rounded-2xl bg-green-600 hover:bg-green-500 text-white text-2xl font-black transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {starting ? "Starting…" : "🚀 Start Game"}
        </button>
        {!canStart && (
          <p className="text-gray-500 text-sm mt-2">
            {savedCount === null || savedCount === 0
              ? "Save prompts first."
              : "Need at least 2 players."}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Answer Submission Phase (host view) ──────────────────────────────────────

function HostAnswerPhase({
  room,
  players,
  currentRound,
  answers,
  pin,
}: {
  room: Room;
  players: Player[];
  currentRound: NonNullable<ReturnType<typeof useGameRoom>["currentRound"]>;
  answers: ReturnType<typeof useGameRoom>["answers"];
  pin: string;
}) {
  const [ending, setEnding] = useState(false);
  const [err, setErr] = useState("");
  const activePlayers = players.filter((p) => p.is_active);
  const answeredIds = new Set(answers.map((a) => a.player_id));
  const pending = activePlayers.filter((p) => !answeredIds.has(p.id));

  async function endSubmission() {
    setEnding(true); setErr("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action: "end_submission" }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Failed.");
    } catch { setErr("Network error."); }
    finally { setEnding(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full">
      <div className="w-full mb-6">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-2 text-center">
          Round {currentRound.round_number}
        </p>
        <div className="bg-white/5 rounded-2xl p-8 text-center">
          <p className="text-4xl font-black text-white leading-tight">
            {currentRound.prompt_text}
          </p>
        </div>
      </div>

      <div className="w-full bg-white/5 rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-300">Answers received</h2>
          <span className="text-3xl font-black text-green-400">
            {answers.length} / {activePlayers.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: activePlayers.length ? `${(answers.length / activePlayers.length) * 100}%` : "0%" }}
          />
        </div>
        {pending.length > 0 && (
          <div className="mt-4">
            <p className="text-gray-500 text-xs mb-2">Still waiting on:</p>
            <div className="flex flex-wrap gap-2">
              {pending.map((p) => (
                <span key={p.id} className="text-xs bg-white/10 rounded-full px-3 py-1 text-gray-400">
                  {p.nickname}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
      <button
        onClick={endSubmission}
        disabled={ending || answers.length === 0}
        className="px-12 py-4 rounded-2xl bg-yellow-600 hover:bg-yellow-500 text-white text-xl font-black transition-all active:scale-95 disabled:opacity-40"
      >
        {ending ? "Ending…" : "⏭ End Submission & Start Voting"}
      </button>
    </div>
  );
}

// ─── Voting Phase (host view) ─────────────────────────────────────────────────

function HostVotingPhase({
  room,
  players,
  currentRound,
  answers,
  votes,
  pin,
}: {
  room: Room;
  players: Player[];
  currentRound: NonNullable<ReturnType<typeof useGameRoom>["currentRound"]>;
  answers: ReturnType<typeof useGameRoom>["answers"];
  votes: ReturnType<typeof useGameRoom>["votes"];
  pin: string;
}) {
  const [ending, setEnding] = useState(false);
  const [err, setErr] = useState("");
  const eligibleVoters = players.filter((p) => {
    // A player is eligible to vote if they submitted an answer
    return answers.some((a) => a.player_id === p.id);
  });

  async function endVoting() {
    setEnding(true); setErr("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action: "end_voting" }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Failed.");
    } catch { setErr("Network error."); }
    finally { setEnding(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full">
      <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Voting</p>
      <div className="bg-white/5 rounded-2xl p-6 w-full mb-6 text-center">
        <p className="text-2xl font-bold text-white">{currentRound.prompt_text}</p>
      </div>
      <div className="w-full bg-white/5 rounded-2xl p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-300">Votes received</h2>
          <span className="text-3xl font-black text-pink-400">
            {votes.length} / {eligibleVoters.length}
          </span>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-pink-500 transition-all duration-500"
            style={{ width: eligibleVoters.length ? `${(votes.length / eligibleVoters.length) * 100}%` : "0%" }}
          />
        </div>
      </div>
      {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
      <button
        onClick={endVoting}
        disabled={ending || votes.length === 0}
        className="px-12 py-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white text-xl font-black transition-all active:scale-95 disabled:opacity-40"
      >
        {ending ? "Ending…" : "🏁 Reveal Results"}
      </button>
    </div>
  );
}

// ─── Results Phase (host view) ────────────────────────────────────────────────

function HostResultsPhase({
  room,
  players,
  currentRound,
  answers,
  votes,
  pin,
}: {
  room: Room;
  players: Player[];
  currentRound: NonNullable<ReturnType<typeof useGameRoom>["currentRound"]>;
  answers: ReturnType<typeof useGameRoom>["answers"];
  votes: ReturnType<typeof useGameRoom>["votes"];
  pin: string;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [err, setErr] = useState("");

  // Sort answers by vote count descending
  const sorted = [...answers]
    .map((a) => ({
      ...a,
      voteCount: votes.filter((v) => v.answer_id === a.id).length,
      authorNickname: players.find((p) => p.id === a.player_id)?.nickname ?? "?",
    }))
    .sort((a, b) => b.voteCount - a.voteCount);

  async function showLeaderboard() {
    setAdvancing(true); setErr("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action: "show_leaderboard" }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Failed.");
    } catch { setErr("Network error."); }
    finally { setAdvancing(false); }
  }

  return (
    <div className="min-h-screen flex flex-col p-8 max-w-3xl mx-auto w-full">
      <p className="text-gray-400 text-sm uppercase tracking-widest mb-2 text-center">Results</p>
      <div className="bg-white/5 rounded-2xl p-6 mb-6 text-center">
        <p className="text-2xl font-bold text-white">{currentRound.prompt_text}</p>
      </div>
      <div className="flex flex-col gap-4 mb-8">
        {sorted.map((a, i) => (
          <div
            key={a.id}
            className={`rounded-2xl p-5 ${i === 0 && a.voteCount > 0 ? "bg-yellow-900/40 border border-yellow-600" : "bg-white/5"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-xl font-bold text-white flex-1">{a.text}</p>
              <span className={`text-2xl font-black ${a.voteCount > 0 ? "text-yellow-400" : "text-gray-600"}`}>
                {a.voteCount} {a.voteCount === 1 ? "vote" : "votes"}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">— {a.authorNickname}</p>
            {a.voteCount > 0 && (
              <p className="text-xs text-green-400 mt-1">+{a.voteCount * 100} points</p>
            )}
          </div>
        ))}
      </div>
      {err && <p className="text-red-400 text-sm mb-3 text-center">{err}</p>}
      <button
        onClick={showLeaderboard}
        disabled={advancing}
        className="mx-auto px-12 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xl font-black transition-all active:scale-95 disabled:opacity-40"
      >
        {advancing ? "Loading…" : "📊 Show Leaderboard"}
      </button>
    </div>
  );
}

// ─── Leaderboard Phase (host view) ────────────────────────────────────────────

function HostLeaderboard({
  room,
  players,
  pin,
}: {
  room: Room;
  players: Player[];
  pin: string;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [ending, setEnding] = useState(false);
  const [err, setErr] = useState("");

  async function nextRound() {
    setAdvancing(true); setErr("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action: "start_round" }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Failed.");
    } catch { setErr("Network error."); }
    finally { setAdvancing(false); }
  }

  async function endGame() {
    setEnding(true); setErr("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action: "end_game" }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error ?? "Failed.");
    } catch { setErr("Network error."); }
    finally { setEnding(false); }
  }

  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen flex flex-col items-center p-8 max-w-3xl mx-auto w-full">
      <h2 className="text-4xl font-black text-center mb-8 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
        Leaderboard
      </h2>
      <div className="w-full flex flex-col gap-3 mb-10">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-4 rounded-2xl px-6 py-4 ${i === 0 ? "bg-yellow-900/40 border border-yellow-600" : "bg-white/5"}`}
          >
            <span className="text-2xl font-black text-gray-400 w-8">{i + 1}</span>
            <span className="text-xl font-bold text-white flex-1">{p.nickname}</span>
            <span className="text-2xl font-black text-yellow-400">{p.score}</span>
          </div>
        ))}
      </div>
      {err && <p className="text-red-400 text-sm mb-4">{err}</p>}
      <div className="flex gap-4">
        <button
          onClick={nextRound}
          disabled={advancing || ending}
          className="px-10 py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white text-lg font-black transition-all active:scale-95 disabled:opacity-40"
        >
          {advancing ? "Loading…" : "▶ Next Round"}
        </button>
        <button
          onClick={endGame}
          disabled={ending || advancing}
          className="px-10 py-4 rounded-2xl bg-red-700 hover:bg-red-600 text-white text-lg font-black transition-all active:scale-95 disabled:opacity-40"
        >
          {ending ? "Ending…" : "🏆 End Game"}
        </button>
      </div>
    </div>
  );
}

// ─── Game Over (host view) ─────────────────────────────────────────────────────

function HostGameOver({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <p className="text-8xl mb-4">🏆</p>
      <h1 className="text-5xl font-black text-yellow-400 mb-2">
        {winner?.nickname ?? "Nobody"}
      </h1>
      <p className="text-gray-400 text-xl mb-8">wins with {winner?.score ?? 0} points!</p>
      <div className="w-full max-w-sm flex flex-col gap-3">
        {sorted.map((p, i) => (
          <div key={p.id} className="flex items-center gap-4 bg-white/5 rounded-xl px-5 py-3">
            <span className="text-gray-500 font-bold w-6">{i + 1}</span>
            <span className="text-white font-bold flex-1">{p.nickname}</span>
            <span className="text-yellow-400 font-black">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Controls Overlay ───────────────────────────────────────────────────

function AdminControls({
  room,
  players,
  pin,
  onDone,
}: {
  room: Room;
  players: Player[];
  pin: string;
  onDone: () => void;
}) {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function action(act: string, extra?: Record<string, unknown>) {
    setLoading(true); setMsg("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/host/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, action: act, ...extra }),
      });
      const data = await res.json();
      setMsg(res.ok ? (data.message ?? "Done.") : (data.error ?? "Failed."));
    } catch { setMsg("Network error."); }
    finally { setLoading(false); }
  }

  const activePlayers = players.filter((p) => p.is_active);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a2e] border border-white/20 rounded-2xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white">Admin Controls</h2>
          <button onClick={onDone} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => action("skip_round")}
            disabled={loading}
            className="py-3 rounded-xl bg-yellow-700 hover:bg-yellow-600 text-white font-bold transition-colors disabled:opacity-50"
          >
            ⏭ Skip Current Round
          </button>
          <button
            onClick={() => action("restart_round")}
            disabled={loading}
            className="py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-50"
          >
            🔄 Restart Round
          </button>
          <button
            onClick={() => action("reset_scores")}
            disabled={loading}
            className="py-3 rounded-xl bg-orange-700 hover:bg-orange-600 text-white font-bold transition-colors disabled:opacity-50"
          >
            🗑 Reset All Scores
          </button>
          <div className="border-t border-white/10 pt-3">
            <p className="text-xs text-gray-500 mb-2">Remove player:</p>
            <div className="flex flex-col gap-2">
              {activePlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => action("remove_player", { playerId: p.id })}
                  disabled={loading}
                  className="flex justify-between items-center py-2 px-4 rounded-xl bg-red-900/40 hover:bg-red-800/60 text-white text-sm transition-colors disabled:opacity-50"
                >
                  <span>{p.nickname}</span>
                  <span className="text-red-400">Remove</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        {msg && (
          <p className="mt-4 text-center text-sm text-gray-300">{msg}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Host Page ───────────────────────────────────────────────────────────

export default function HostPage() {
  const params = useParams();
  const code = (params.code as string).toUpperCase();
  const { room, players, currentRound, answers, votes, loading, error } = useGameRoom(code);

  const [pinVerified, setPinVerified] = useState(false);
  const [pin, setPin] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  // Auto-verify if PIN was saved in this session
  useEffect(() => {
    if (!room) return;
    const stored = sessionStorage.getItem("hostPin");
    if (stored && stored === room.host_pin) {
      setPin(stored);
      setPinVerified(true);
    }
  }, [room]);

  function handleVerify(p: string) {
    setPin(p);
    setPinVerified(true);
    sessionStorage.setItem("hostPin", p);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorCard message={error} />;
  if (!room) return null;

  if (!pinVerified) {
    return <PinGate storedPin={room.host_pin} onVerify={handleVerify} />;
  }

  function renderState() {
    if (!room) return null;
    switch (room.state) {
      case "lobby":
        return <HostLobby room={room} players={players} pin={pin} />;
      case "answer_submission":
        if (!currentRound) return <Spinner />;
        return (
          <HostAnswerPhase
            room={room}
            players={players}
            currentRound={currentRound}
            answers={answers}
            pin={pin}
          />
        );
      case "voting":
        if (!currentRound) return <Spinner />;
        return (
          <HostVotingPhase
            room={room}
            players={players}
            currentRound={currentRound}
            answers={answers}
            votes={votes}
            pin={pin}
          />
        );
      case "results":
        if (!currentRound) return <Spinner />;
        return (
          <HostResultsPhase
            room={room}
            players={players}
            currentRound={currentRound}
            answers={answers}
            votes={votes}
            pin={pin}
          />
        );
      case "leaderboard":
        return <HostLeaderboard room={room} players={players} pin={pin} />;
      case "game_over":
        return <HostGameOver players={players} />;
      default:
        return <div className="text-center p-8 text-gray-400">Unknown state: {room.state}</div>;
    }
  }

  return (
    <>
      {/* Admin button — always visible when host is verified */}
      <button
        onClick={() => setShowAdmin(true)}
        className="fixed top-4 right-4 z-40 bg-white/10 hover:bg-white/20 text-gray-300 text-sm font-bold px-3 py-2 rounded-lg transition-colors"
      >
        ⚙ Admin
      </button>

      {showAdmin && (
        <AdminControls
          room={room}
          players={players}
          pin={pin}
          onDone={() => setShowAdmin(false)}
        />
      )}

      {renderState()}
    </>
  );
}
