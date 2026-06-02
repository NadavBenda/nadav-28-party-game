"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
import { createClient } from "@/lib/supabase/client";
import type { Room, Player } from "@/lib/types";

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin-game" />
        <p className="text-white/30 text-sm tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="glass rounded-3xl p-8 text-center max-w-sm">
        <div className="text-4xl mb-4">😕</div>
        <p className="text-rose-300 text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function Confetti() {
  const colors = ['#a78bfa','#fbbf24','#22d3ee','#34d399','#fb923c','#f472b6','#818cf8','#fde68a'];
  const lefts  = [3,8,13,18,23,28,33,38,43,48,52,57,62,67,72,77,82,87,92,97,5,15,25,35,45,55,65,75,85,95];
  const delays = [0,0.2,0.5,0.8,1.1,1.4,0.3,0.7,1.0,1.3,0.1,0.4,0.9,1.2,1.5,0.6,0.15,0.45,0.75,1.05,0.35,0.65,0.95,1.25,0.25,0.55,0.85,1.15,0.05,0.7];
  const durs   = [3,3.5,4,3.2,3.8,4.5,3.1,3.7,4.2,3.3,3.9,4.1,3.6,4.3,3.4,4.4,3.15,3.75,4.15,3.45,3.85,4.35,3.25,3.65,4.25,3.55,3.95,4.05,3.05,4.45];
  const sizes  = ['10px','7px','5px','8px','6px','9px','5px','7px','10px','6px','8px','5px','9px','7px','6px','10px','8px','5px','7px','9px','6px','10px','5px','8px','7px','9px','6px','10px','8px','5px'];
  const radii  = ['50%','2px','0%','50%','20%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%'];

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {lefts.map((left, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${left}%`,
            top: '-16px',
            width:  sizes[i],
            height: sizes[i],
            backgroundColor: colors[i % colors.length],
            borderRadius:    radii[i],
            animationDelay:    `${delays[i]}s`,
            animationDuration: `${durs[i]}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({
  correctPin,
  onVerify,
}: {
  correctPin: string;
  onVerify: (pin: string) => void;
}) {
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim() === correctPin) {
      sessionStorage.setItem("hostPin", input.trim());
      onVerify(input.trim());
    } else {
      setErr("Wrong PIN. Try again.");
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm flex flex-col gap-5 animate-pop">
        <div className="text-center">
          <div className="text-5xl mb-3">🔐</div>
          <h1 className="text-3xl font-black text-gradient-purple">Host Access</h1>
          <p className="text-white/40 text-sm mt-1">Enter your PIN to continue</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setErr(""); }}
            placeholder="Enter host PIN"
            autoFocus
            className="px-4 py-4 rounded-2xl glass text-white text-xl text-center placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
          />
          {err && <p className="text-rose-400 text-sm text-center font-medium">{err}</p>}
          <button type="submit" className="btn btn-purple py-4 text-lg rounded-2xl">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Host Lobby ───────────────────────────────────────────────────────────────

function HostLobby({ room, players, pin }: { room: Room; players: Player[]; pin: string }) {
  const [promptsText, setPromptsText] = useState("");
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [loadingPromptCount, setLoadingPromptCount] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("prompts")
      .select("id", { count: "exact", head: true })
      .eq("room_id", room.id)
      .eq("used", false)
      .then(({ count }) => {
        setSavedCount(count ?? 0);
        setLoadingPromptCount(false);
      });
  }, [room.id]);

  async function savePrompts(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const lines = promptsText.split("\n").map((l) => l.trim()).filter(Boolean);
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
      if (!res.ok) setStartError(data.error ?? "Failed to start game.");
    } catch {
      setStartError("Network error.");
    } finally {
      setStarting(false);
    }
  }

  const promptsReady = (savedCount ?? 0) > 0;
  const canStart = promptsReady && players.length >= 2;

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-10 max-w-5xl mx-auto w-full gap-8">

      {/* Room code hero */}
      <div className="text-center animate-slide-up pt-4">
        <p className="text-white/30 text-xs font-bold uppercase tracking-[0.3em] mb-3">
          Room Code — share this with players
        </p>
        <div className="inline-block">
          <p className="text-shimmer text-8xl md:text-9xl font-black tracking-[0.2em] leading-none select-all">
            {room.code}
          </p>
        </div>
        <p className="text-white/25 text-sm mt-3">
          Players join at the game URL and enter this code
        </p>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">

        {/* Player list */}
        <div className="glass rounded-3xl p-6 animate-slide-up-1">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl">👥</span>
            <h2 className="text-lg font-black text-white flex-1">Players</h2>
            <span className="bg-purple-600/60 text-purple-100 text-sm font-black px-3 py-1 rounded-full">
              {players.length}
            </span>
          </div>
          {players.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-white/25 text-sm">Waiting for players to join…</p>
              <div className="flex gap-2 justify-center mt-4">
                <div className="w-2 h-2 bg-purple-500 rounded-full dot-1" />
                <div className="w-2 h-2 bg-purple-500 rounded-full dot-2" />
                <div className="w-2 h-2 bg-purple-500 rounded-full dot-3" />
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 stagger">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-2.5"
                >
                  <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0 animate-pulse-slow" />
                  <span className="text-white font-semibold text-sm">{p.nickname}</span>
                </li>
              ))}
            </ul>
          )}
          {players.length > 0 && players.length < 2 && (
            <p className="mt-4 text-amber-400/80 text-xs font-medium text-center">
              Need at least 2 players to start
            </p>
          )}
        </div>

        {/* Prompt import */}
        <div className="glass rounded-3xl p-6 animate-slide-up-2">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl">📝</span>
            <h2 className="text-lg font-black text-white flex-1">Prompts</h2>
            {!loadingPromptCount && (savedCount ?? 0) > 0 && (
              <span className="text-emerald-400 text-sm font-black">
                ✓ {savedCount} ready
              </span>
            )}
          </div>
          <form onSubmit={savePrompts} className="flex flex-col gap-3">
            <textarea
              value={promptsText}
              onChange={(e) => { setPromptsText(e.target.value); }}
              placeholder={"One prompt per line:\n\nWhat is the most Nadav thing Nadav could do?\nComplete this sentence: Nadav walks into a bar…"}
              rows={8}
              className="auto-dir w-full px-4 py-3 rounded-2xl bg-white/6 border border-white/8 text-white text-sm placeholder-white/20 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            {saveError && <p className="text-rose-400 text-sm font-medium">{saveError}</p>}
            {(savedCount ?? 0) > 0 && promptsText.trim() === "" && (
              <p className="text-emerald-400/80 text-xs">
                ✓ {savedCount} prompts saved. Paste new ones above to replace them.
              </p>
            )}
            <button
              type="submit"
              disabled={savingPrompts || !promptsText.trim()}
              className="btn btn-purple py-3 text-sm rounded-xl"
            >
              {savingPrompts ? "Saving…" : "Save Prompts"}
            </button>
          </form>
        </div>
      </div>

      {/* Start button */}
      <div className="text-center pb-4 animate-slide-up-3">
        {startError && <p className="text-rose-400 text-sm font-medium mb-4">{startError}</p>}
        <button
          onClick={startGame}
          disabled={!canStart || starting || loadingPromptCount}
          className={`btn btn-green px-20 py-6 text-2xl rounded-3xl ${canStart && !starting ? "animate-glow" : ""}`}
        >
          {starting ? "Starting…" : "🚀 Start Game!"}
        </button>
        {!canStart && !loadingPromptCount && (
          <p className="text-white/25 text-sm mt-3">
            {!promptsReady ? "Save prompts first." : "Need at least 2 players."}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Answer Phase (host view) ─────────────────────────────────────────────────

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
  const answeredIds = new Set(answers.map((a) => a.player_id));
  const pending = players.filter((p) => !answeredIds.has(p.id));
  const pct = players.length > 0 ? (answers.length / players.length) * 100 : 0;

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 md:p-10 max-w-3xl mx-auto w-full gap-6">

      <div className="text-center animate-slide-up">
        <span className="glass px-4 py-1.5 rounded-full text-xs font-bold text-purple-300 uppercase tracking-widest">
          Round {currentRound.round_number} · Answering
        </span>
      </div>

      {/* Prompt */}
      <div className="glass rounded-3xl p-8 text-center w-full animate-slide-up-1" style={{ borderColor: 'rgba(139,92,246,0.2)' }}>
        <p className="text-4xl font-black text-white leading-tight auto-dir">
          {currentRound.prompt_text}
        </p>
      </div>

      {/* Progress */}
      <div className="glass rounded-3xl p-6 w-full animate-slide-up-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white/60">Answers received</h2>
          <span className="text-3xl font-black text-gradient-purple">
            {answers.length}&thinsp;/&thinsp;{players.length}
          </span>
        </div>
        <div className="w-full h-3 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #7c3aed, #4f46e5)',
            }}
          />
        </div>
        {pending.length > 0 && (
          <div className="mt-4">
            <p className="text-white/25 text-xs mb-2 uppercase tracking-widest">Still waiting:</p>
            <div className="flex flex-wrap gap-2">
              {pending.map((p) => (
                <span key={p.id} className="text-xs glass rounded-full px-3 py-1 text-white/50">
                  {p.nickname}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {err && <p className="text-rose-400 text-sm font-medium">{err}</p>}
      <button
        onClick={endSubmission}
        disabled={ending || answers.length === 0}
        className="btn btn-amber px-12 py-5 text-xl rounded-2xl animate-slide-up-3"
      >
        {ending ? "Ending…" : "⏭ Close Answers & Vote"}
      </button>
      {answers.length === 0 && (
        <p className="text-white/20 text-sm">Waiting for at least one answer</p>
      )}
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

  const answererIds = new Set(answers.map((a) => a.player_id));
  const eligibleVoterCount = players.filter((p) => answererIds.has(p.id)).length;
  const pct = eligibleVoterCount > 0 ? (votes.length / eligibleVoterCount) * 100 : 0;

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 md:p-10 max-w-3xl mx-auto w-full gap-6">

      <div className="text-center animate-slide-up">
        <span className="glass px-4 py-1.5 rounded-full text-xs font-bold text-pink-300 uppercase tracking-widest">
          Round {currentRound.round_number} · Voting
        </span>
      </div>

      <div className="glass rounded-3xl p-6 w-full text-center animate-slide-up-1">
        <p className="text-2xl font-bold text-white auto-dir">{currentRound.prompt_text}</p>
      </div>

      <div className="glass rounded-3xl p-6 w-full animate-slide-up-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white/60">Votes received</h2>
          <span className="text-3xl font-black text-gradient-party">
            {votes.length}&thinsp;/&thinsp;{eligibleVoterCount}
          </span>
        </div>
        <div className="w-full h-3 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #be185d, #db2777)',
            }}
          />
        </div>
      </div>

      {err && <p className="text-rose-400 text-sm font-medium">{err}</p>}
      <button
        onClick={endVoting}
        disabled={ending}
        className="btn btn-pink px-12 py-5 text-xl rounded-2xl animate-slide-up-3"
      >
        {ending ? "Ending…" : "🏁 Reveal Results"}
      </button>
      {votes.length === 0 && (
        <p className="text-white/25 text-sm">No votes yet — you can still advance</p>
      )}
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
    <div className="min-h-screen flex flex-col p-6 md:p-10 max-w-3xl mx-auto w-full gap-6">

      <div className="text-center animate-slide-up">
        <span className="glass px-4 py-1.5 rounded-full text-xs font-bold text-amber-300 uppercase tracking-widest">
          Round {currentRound.round_number} · Results
        </span>
      </div>

      <div className="glass rounded-3xl p-6 text-center animate-slide-up-1">
        <p className="text-2xl font-bold text-white auto-dir">{currentRound.prompt_text}</p>
      </div>

      <div className="flex flex-col gap-4 flex-1 stagger">
        {sorted.length === 0 ? (
          <p className="text-white/30 text-center py-10">No answers this round.</p>
        ) : (
          sorted.map((a, i) => (
            <div
              key={a.id}
              className={`rounded-3xl p-5 transition-all ${
                i === 0 && a.voteCount > 0
                  ? "winner-card animate-gold-glow"
                  : "glass"
              }`}
            >
              {i === 0 && a.voteCount > 0 && (
                <p className="text-amber-400 text-xs font-black uppercase tracking-widest mb-2">
                  🏆 Winner
                </p>
              )}
              <div className="flex items-start justify-between gap-4">
                <p className="text-2xl font-black text-white flex-1 leading-snug auto-dir">{a.text}</p>
                <div className="text-right flex-shrink-0">
                  <p className={`text-2xl font-black ${a.voteCount > 0 ? "text-gradient-gold" : "text-white/20"}`}>
                    {a.voteCount}
                  </p>
                  <p className="text-xs text-white/30 font-medium">
                    {a.voteCount === 1 ? "vote" : "votes"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-sm text-white/40">— {a.authorNickname}</span>
                {a.voteCount > 0 && (
                  <span className="text-sm text-emerald-400 font-bold">+{a.voteCount * 100} pts</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {err && <p className="text-rose-400 text-sm font-medium text-center">{err}</p>}
      <div className="text-center pb-4">
        <button
          onClick={showLeaderboard}
          disabled={advancing}
          className="btn btn-purple px-12 py-5 text-xl rounded-2xl"
        >
          {advancing ? "Loading…" : "📊 Show Leaderboard"}
        </button>
      </div>
    </div>
  );
}

// ─── Leaderboard Phase (host view) ────────────────────────────────────────────

const RANK_MEDAL = ["🥇", "🥈", "🥉"];
const RANK_CLASS = ["rank-gold", "rank-silver", "rank-bronze"];

function HostLeaderboard({ room, players, pin }: { room: Room; players: Player[]; pin: string }) {
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
    <div className="min-h-screen flex flex-col items-center p-6 md:p-10 max-w-3xl mx-auto w-full gap-6">

      <div className="text-center animate-slide-up pt-4">
        <h2 className="text-5xl font-black text-gradient-purple mb-1">Leaderboard</h2>
        <p className="text-white/30 text-sm">After this round</p>
      </div>

      <div className="w-full flex flex-col gap-3 flex-1 stagger">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-4 rounded-2xl px-6 py-4 ${
              i < 3 ? RANK_CLASS[i] : "glass"
            }`}
          >
            <span className="text-2xl w-8 text-center flex-shrink-0">
              {i < 3
                ? RANK_MEDAL[i]
                : <span className="text-white/25 font-bold text-base">{i + 1}</span>
              }
            </span>
            <span className="text-xl font-bold text-white flex-1 truncate">{p.nickname}</span>
            <span className="text-2xl font-black text-gradient-gold flex-shrink-0">{p.score}</span>
          </div>
        ))}
      </div>

      {err && <p className="text-rose-400 text-sm font-medium">{err}</p>}
      <div className="flex gap-4 pb-4">
        <button
          onClick={nextRound}
          disabled={advancing || ending}
          className="btn btn-green px-10 py-4 text-lg rounded-2xl flex-1"
        >
          {advancing ? "Loading…" : "▶ Next Round"}
        </button>
        <button
          onClick={endGame}
          disabled={ending || advancing}
          className="btn btn-red px-10 py-4 text-lg rounded-2xl flex-1"
        >
          {ending ? "Ending…" : "🏆 End Game"}
        </button>
      </div>
    </div>
  );
}

// ─── Game Over (host view) ────────────────────────────────────────────────────

function HostGameOver({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <Confetti />

      <div className="animate-pop text-9xl mb-6">🏆</div>

      <div className="animate-slide-up-1 mb-10">
        <h1 className="text-6xl font-black text-gradient-gold mb-2">
          {winner?.nickname ?? "Nobody"}
        </h1>
        <p className="text-white/40 text-xl">wins with {winner?.score ?? 0} points!</p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3 stagger animate-slide-up-2">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-4 rounded-2xl px-5 py-4 ${
              i < 3 ? RANK_CLASS[i] : "glass"
            }`}
          >
            <span className="text-xl w-8 text-center flex-shrink-0">
              {i < 3 ? RANK_MEDAL[i] : <span className="text-white/25 font-bold">{i + 1}</span>}
            </span>
            <span className="text-white font-bold flex-1 truncate text-lg">{p.nickname}</span>
            <span className="text-gradient-gold font-black text-xl flex-shrink-0">{p.score}</span>
          </div>
        ))}
      </div>

      <p className="mt-12 text-white/20 text-sm animate-slide-up-3">
        🎂 Happy 28th Birthday, Nadav! 🎂
      </p>
    </div>
  );
}

// ─── Admin Controls ───────────────────────────────────────────────────────────

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
  const [isLoading, setIsLoading] = useState(false);

  const runAction = useCallback(
    async (act: string, extra?: Record<string, unknown>) => {
      setIsLoading(true);
      setMsg("");
      try {
        const res = await fetch(`/api/rooms/${room.code}/host/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin, action: act, ...extra }),
        });
        const data = await res.json();
        setMsg(res.ok ? (data.message ?? "Done.") : (data.error ?? "Failed."));
      } catch {
        setMsg("Network error.");
      } finally {
        setIsLoading(false);
      }
    },
    [pin, room.code]
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-strong rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-pop">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white">⚙ Admin</h2>
          <button
            onClick={onDone}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-all text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => runAction("skip_round")}
            disabled={isLoading}
            className="btn btn-amber py-3 rounded-xl text-sm"
          >
            ⏭ Skip Current Round
          </button>
          <button
            onClick={() => runAction("restart_round")}
            disabled={isLoading}
            className="btn btn-purple py-3 rounded-xl text-sm"
          >
            🔄 Restart Round
          </button>
          <button
            onClick={() => runAction("reset_scores")}
            disabled={isLoading}
            className="btn btn-ghost py-3 rounded-xl text-sm text-orange-300"
          >
            🗑 Reset All Scores
          </button>
          {players.length > 0 && (
            <div className="border-t border-white/10 pt-3 mt-1">
              <p className="text-xs text-white/30 mb-2 uppercase tracking-widest">Remove player</p>
              <div className="flex flex-col gap-2">
                {players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => runAction("remove_player", { playerId: p.id })}
                    disabled={isLoading}
                    className="flex justify-between items-center py-2.5 px-4 rounded-xl bg-rose-900/30 hover:bg-rose-800/50 text-white text-sm transition-all disabled:opacity-50"
                  >
                    <span className="font-semibold">{p.nickname}</span>
                    <span className="text-rose-400 text-xs font-bold">Remove</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {msg && (
          <p className="mt-5 text-center text-sm text-white/60 glass rounded-xl px-4 py-2">
            {msg}
          </p>
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

  const [pin, setPin] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    async function restore() {
      await Promise.resolve();
      const stored = sessionStorage.getItem("hostPin");
      if (stored) setPin(stored);
    }
    void restore();
  }, []);

  const pinVerified = pin !== "" && room !== null && pin === room.host_pin;

  if (loading) return <Spinner />;
  if (error)   return <ErrorCard message={error} />;
  if (!room)   return null;

  if (!pinVerified) {
    return <PinGate correctPin={room.host_pin} onVerify={setPin} />;
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
        return (
          <div className="text-center p-8 text-white/30">
            Unknown state: {room.state}
          </div>
        );
    }
  }

  return (
    <>
      {/* Admin button — always visible */}
      <button
        onClick={() => setShowAdmin(true)}
        className="fixed top-4 right-4 z-40 glass hover:glass-strong text-white/50 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
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
