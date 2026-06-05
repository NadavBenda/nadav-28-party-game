"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
import { useAudio, type AudioController } from "@/hooks/useAudio";
import { MAX_VOTES_PER_PLAYER } from "@/lib/config";
import type { Room, Player, Round, Answer, Vote } from "@/lib/types";

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin-game" />
        <p className="text-white/30 text-sm tracking-wide">Loading…</p>
      </div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4">
      <div className="glass rounded-3xl p-8 text-center max-w-sm w-full border-rose-500/30">
        <div className="text-4xl mb-4">😕</div>
        <p className="text-rose-300 text-lg font-semibold">{message}</p>
      </div>
    </div>
  );
}

function WaitingBanner({ text }: { text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
      <div className="text-6xl animate-bounce-slow">⏳</div>
      <p className="text-white/80 text-xl font-semibold max-w-xs leading-relaxed">{text}</p>
      <div className="flex gap-3 mt-2">
        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full dot-1" />
        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full dot-2" />
        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full dot-3" />
      </div>
    </div>
  );
}

// ─── Sound Button ─────────────────────────────────────────────────────────────

function SoundButton({ audio }: { audio: AudioController }) {
  if (!audio.enabled) {
    return (
      <button
        onClick={audio.enable}
        className="fixed bottom-4 right-4 z-40 glass hover:glass-strong text-white/60 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
      >
        🔊 Sound
      </button>
    );
  }
  return (
    <button
      onClick={audio.toggleMute}
      className="fixed bottom-4 right-4 z-40 glass hover:glass-strong text-white/40 hover:text-white text-xs font-bold px-3 py-2 rounded-xl transition-all"
      title={audio.muted ? "Unmute" : "Mute"}
    >
      {audio.muted ? "🔇" : "🔊"}
    </button>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function Confetti() {
  const colors  = ['#a78bfa','#fbbf24','#22d3ee','#34d399','#fb923c','#f472b6','#818cf8','#fde68a'];
  const lefts   = [3,8,13,18,23,28,33,38,43,48,52,57,62,67,72,77,82,87,92,97,5,15,25,35,45,55,65,75,85,95];
  const delays  = [0,0.2,0.5,0.8,1.1,1.4,0.3,0.7,1.0,1.3,0.1,0.4,0.9,1.2,1.5,0.6,0.15,0.45,0.75,1.05,0.35,0.65,0.95,1.25,0.25,0.55,0.85,1.15,0.05,0.7];
  const durs    = [3,3.5,4,3.2,3.8,4.5,3.1,3.7,4.2,3.3,3.9,4.1,3.6,4.3,3.4,4.4,3.15,3.75,4.15,3.45,3.85,4.35,3.25,3.65,4.25,3.55,3.95,4.05,3.05,4.45];
  const sizes   = ['10px','7px','5px','8px','6px','9px','5px','7px','10px','6px','8px','5px','9px','7px','6px','10px','8px','5px','7px','9px','6px','10px','5px','8px','7px','9px','6px','10px','8px','5px'];
  const radii   = ['50%','2px','0%','50%','20%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%','2px','50%','0%','20%','50%'];

  return (
    <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden z-10">
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

// ─── Player Lobby ─────────────────────────────────────────────────────────────

function PlayerLobby({ room, players, me }: { room: Room; players: Player[]; me: Player }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-10 text-center">

      <div className="animate-pop mb-8">
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">Room Code</p>
        <p className="text-shimmer text-7xl font-black tracking-[0.2em] leading-none">
          {room.code}
        </p>
      </div>

      <div className="animate-slide-up-1 mb-8">
        <p className="text-2xl font-black text-white mb-1">
          Welcome, <span className="text-gradient-purple">{me.nickname}</span>!
        </p>
        <p className="text-white/40 text-base">Waiting for the host to start the game…</p>
        <div className="flex gap-2 justify-center mt-4">
          <div className="w-2 h-2 bg-purple-500 rounded-full dot-1" />
          <div className="w-2 h-2 bg-purple-500 rounded-full dot-2" />
          <div className="w-2 h-2 bg-purple-500 rounded-full dot-3" />
        </div>
      </div>

      <div className="w-full max-w-xs glass rounded-3xl p-5 animate-slide-up-2">
        <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4 text-center">
          {players.length} {players.length === 1 ? "player" : "players"} joined
        </p>
        <div className="flex flex-col gap-2 stagger">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                p.id === me.id
                  ? "bg-purple-600/30 border border-purple-500/40"
                  : "bg-white/5"
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.id === me.id ? "bg-purple-400" : "bg-white/20"}`} />
              <span className="text-white font-semibold text-sm flex-1 text-left auto-dir" dir="auto">{p.nickname}</span>
              {p.id === me.id && (
                <span className="text-xs text-purple-300 font-bold">You</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Answer Submission ────────────────────────────────────────────────────────

function SubmittedScreen({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center gap-6">
      <div className="animate-pop text-8xl">{emoji}</div>
      <div className="animate-slide-up-1">
        <p className="text-3xl font-black text-white mb-2">{title}</p>
        <p className="text-white/50 text-lg">{subtitle}</p>
      </div>
      <div className="flex gap-3 animate-slide-up-2">
        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full dot-1" />
        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full dot-2" />
        <div className="w-2.5 h-2.5 bg-purple-500 rounded-full dot-3" />
      </div>
    </div>
  );
}

function PlayerAnswerForm({
  round,
  me,
  existingAnswer,
  playSfx,
}: {
  round: Round;
  me: Player;
  existingAnswer: Answer | undefined;
  playSfx: AudioController["playSfx"];
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [localSubmitted, setLocalSubmitted] = useState(false);

  if (localSubmitted || existingAnswer) {
    return (
      <SubmittedScreen
        emoji="✅"
        title="Answer submitted!"
        subtitle="Waiting for everyone else…"
      />
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) { setErr("Write something first!"); return; }
    setSubmitting(true); setErr("");
    try {
      const res = await fetch(`/api/rounds/${round.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: me.id, text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Failed to submit."); return; }
      playSfx("sfx-answer-submit");
      setLocalSubmitted(true);
    } catch { setErr("Network error. Try again."); }
    finally { setSubmitting(false); }
  }

  const remaining = 300 - text.length;

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <div className="flex-1 flex flex-col justify-center gap-5 max-w-lg mx-auto w-full">

        <div className="flex justify-center animate-slide-up">
          <span className="glass px-4 py-1.5 rounded-full text-xs font-bold text-purple-300 uppercase tracking-widest">
            Round {round.round_number}
          </span>
        </div>

        <div className="glass rounded-3xl p-6 animate-slide-up-1" style={{ borderColor: 'rgba(139,92,246,0.25)' }}>
          <p className="text-2xl font-black text-white text-center leading-snug auto-dir" dir="auto">
            {round.prompt_text}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3 animate-slide-up-2">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setErr(""); }}
              placeholder="Type your answer…"
              rows={4}
              maxLength={300}
              autoFocus
              className="auto-dir w-full px-4 py-4 rounded-2xl glass text-white text-lg placeholder-white/20 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/40 transition-all"
            />
            <span className={`absolute bottom-3 right-3 text-xs font-mono ${remaining < 50 ? 'text-amber-400' : 'text-white/20'}`}>
              {remaining}
            </span>
          </div>
          {err && <p className="text-rose-400 text-sm text-center font-medium">{err}</p>}
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="btn btn-purple w-full py-5 text-xl rounded-2xl"
          >
            {submitting ? "Submitting…" : "Submit Answer 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Voting Form ──────────────────────────────────────────────────────────────

function PlayerVotingForm({
  round,
  me,
  answers,
  myAnswer,
  myVotes,
  playSfx,
}: {
  round: Round;
  me: Player;
  answers: Answer[];
  myAnswer: Answer | undefined;
  myVotes: Vote[];
  playSfx: AudioController["playSfx"];
}) {
  // Single map tracks optimistic intent per answer: "add" | "remove"
  // On success we leave the entry (server broadcast cleans it up naturally).
  // On failure we delete the entry to revert.
  const [pendingOps, setPendingOps] = useState<Map<string, "add" | "remove">>(new Map());

  const serverVotedIds = useMemo(
    () => new Set(myVotes.map((v) => v.answer_id)),
    [myVotes]
  );

  // Effective voted state = apply pendingOps on top of server state (insertion order)
  const effectiveVotedIds = useMemo(() => {
    const s = new Set(serverVotedIds);
    for (const [id, op] of pendingOps) {
      if (op === "add") s.add(id);
      else s.delete(id);
    }
    return s;
  }, [serverVotedIds, pendingOps]);

  const votesLeft = MAX_VOTES_PER_PLAYER - effectiveVotedIds.size;

  // Answers sorted consistently (exclude own)
  const shuffled = useMemo(
    () => answers.filter((a) => a.player_id !== me.id).sort((a, b) => a.id.localeCompare(b.id)),
    [answers, me.id]
  );

  function setPendingOp(answerId: string, op: "add" | "remove") {
    setPendingOps((prev) => { const m = new Map(prev); m.set(answerId, op); return m; });
  }
  function clearPendingOp(answerId: string) {
    setPendingOps((prev) => { const m = new Map(prev); m.delete(answerId); return m; });
  }

  function toggleVote(answerId: string) {
    const isVoted = effectiveVotedIds.has(answerId);

    if (isVoted) {
      setPendingOp(answerId, "remove");
      fetch(`/api/rounds/${round.id}/vote`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: me.id, answerId }),
      }).catch(() => clearPendingOp(answerId)); // revert on network error
    } else {
      if (votesLeft <= 0) return;
      setPendingOp(answerId, "add");
      playSfx("sfx-vote");
      fetch(`/api/rounds/${round.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: me.id, answerId }),
      })
        .then((res) => { if (!res.ok) clearPendingOp(answerId); })
        .catch(() => clearPendingOp(answerId));
    }
  }

  if (!myAnswer) {
    return <WaitingBanner text="You didn't submit an answer this round, so you can't vote." />;
  }

  if (shuffled.length === 0) {
    return <WaitingBanner text="Not enough answers to vote on yet." />;
  }

  const letterLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-4 flex-1">

        {/* Votes remaining pips */}
        <div className="flex flex-col items-center gap-2 animate-slide-up">
          <div className="flex gap-2">
            {Array.from({ length: MAX_VOTES_PER_PLAYER }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  i < effectiveVotedIds.size
                    ? "bg-purple-500 scale-110"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
          <p className="text-white/50 text-sm font-bold">
            {votesLeft > 0
              ? `${votesLeft} vote${votesLeft !== 1 ? "s" : ""} remaining`
              : "All votes cast — tap to swap"}
          </p>
        </div>

        {/* Prompt */}
        <div className="glass rounded-3xl p-5 text-center animate-slide-up-1">
          <p className="text-lg font-bold text-white leading-snug auto-dir" dir="auto">
            {round.prompt_text}
          </p>
        </div>

        {/* Answer cards */}
        <div className="flex flex-col gap-3 flex-1 stagger">
          {shuffled.map((a, i) => {
            const hasVoted = effectiveVotedIds.has(a.id);
            const isInFlight = pendingOps.has(a.id);

            return (
              <button
                key={a.id}
                onClick={() => toggleVote(a.id)}
                className={`w-full text-left p-5 rounded-2xl transition-all duration-150 active:scale-[0.97] ${
                  hasVoted
                    ? "bg-emerald-700/30 border border-emerald-400/60 shadow-[0_0_16px_rgba(52,211,153,0.25)]"
                    : "glass hover:bg-purple-700/20 hover:border-purple-500/30"
                } ${isInFlight ? "opacity-75" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all duration-150 ${
                    hasVoted
                      ? "bg-emerald-400 text-black scale-110"
                      : "bg-white/10 text-white/40"
                  }`}>
                    {hasVoted ? "✓" : (letterLabels[i] ?? i + 1)}
                  </span>
                  <span className="text-white text-base font-semibold leading-snug flex-1 auto-dir" dir="auto">
                    {a.text}
                  </span>
                  {hasVoted && (
                    <span className="text-emerald-400 text-xs font-black flex-shrink-0">
                      Tap to undo
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-center text-white/25 text-xs pb-2">
          Tap to vote · Tap again to undo
        </p>
      </div>
    </div>
  );
}

// ─── Results View ─────────────────────────────────────────────────────────────

function PlayerResults({
  round,
  answers,
  votes,
  players,
  me,
}: {
  round: Round;
  answers: Answer[];
  votes: Vote[];
  players: Player[];
  me: Player;
}) {
  const sorted = [...answers]
    .map((a) => ({
      ...a,
      voteCount: votes.filter((v) => v.answer_id === a.id).length,
      authorNickname: players.find((p) => p.id === a.player_id)?.nickname ?? "?",
      isMe: a.player_id === me.id,
    }))
    .sort((a, b) => b.voteCount - a.voteCount);

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-5">

        <div className="flex justify-center animate-slide-up">
          <span className="glass px-4 py-1.5 rounded-full text-xs font-bold text-amber-300 uppercase tracking-widest">
            Results
          </span>
        </div>

        <div className="glass rounded-3xl p-5 text-center animate-slide-up-1">
          <p className="text-lg font-bold text-white leading-snug auto-dir" dir="auto">
            {round.prompt_text}
          </p>
        </div>

        {sorted.length === 0 ? (
          <p className="text-white/30 text-center py-8">No answers this round.</p>
        ) : (
          <div className="flex flex-col gap-3 stagger">
            {sorted.map((a, i) => {
              const isWinner = i === 0 && a.voteCount > 0;
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl p-4 transition-all ${
                    isWinner ? "winner-card animate-gold-glow" : "glass"
                  } ${a.isMe ? "ring-2 ring-purple-500/50" : ""}`}
                >
                  {isWinner && (
                    <div className="text-xs text-amber-400 font-black uppercase tracking-widest mb-2">
                      🏆 Winner
                    </div>
                  )}
                  <div className="flex justify-between items-start gap-3">
                    <p className="text-white font-bold text-base flex-1 leading-snug auto-dir" dir="auto">
                      {a.text}
                    </p>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-2xl font-black ${a.voteCount > 0 ? "text-gradient-gold animate-score-slam" : "text-white/20"}`}>
                        {a.voteCount}
                      </span>
                      <p className="text-xs text-white/30">
                        {a.voteCount === 1 ? "vote" : "votes"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-white/40 text-xs auto-dir" dir="auto">— {a.authorNickname}</span>
                    {a.isMe && <span className="text-xs text-purple-400 font-bold">you</span>}
                    {a.voteCount > 0 && (
                      <span className="text-xs text-emerald-400 font-bold">+{a.voteCount * 100} pts</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

const RANK_MEDAL = ["🥇", "🥈", "🥉"];
const RANK_CLASS = ["rank-gold", "rank-silver", "rank-bronze"];

function PlayerLeaderboard({ players, me }: { players: Player[]; me: Player }) {
  const sorted = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players]);
  const myRank = sorted.findIndex((p) => p.id === me.id) + 1;

  return (
    <div className="flex flex-col min-h-screen px-4 py-10">
      <div className="max-w-md mx-auto w-full flex flex-col gap-5">

        <div className="text-center animate-slide-up">
          <h2 className="text-4xl font-black text-gradient-purple mb-1">Leaderboard</h2>
          {myRank > 0 && (
            <p className="text-white/40 text-sm">
              You are <span className="text-purple-300 font-bold">#{myRank}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 stagger">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-4 rounded-2xl px-5 py-4 ${
                i < 3 ? RANK_CLASS[i] : "glass"
              } ${p.id === me.id ? "ring-2 ring-purple-500/50" : ""}`}
            >
              <span className="text-xl w-8 flex-shrink-0 text-center">
                {i < 3 ? RANK_MEDAL[i] : <span className="text-white/30 font-bold text-base">{i + 1}</span>}
              </span>
              <span className="text-white font-bold flex-1 truncate auto-dir" dir="auto">{p.nickname}</span>
              {p.id === me.id && (
                <span className="text-xs text-purple-300 font-bold flex-shrink-0">You</span>
              )}
              <span className="text-gradient-gold font-black text-lg flex-shrink-0">{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Game Over ────────────────────────────────────────────────────────────────

function PlayerGameOver() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center gap-6">
      <Confetti />
      <div className="animate-pop text-8xl">👀</div>
      <div className="animate-slide-up-1 flex flex-col gap-2">
        <h1 className="text-3xl font-black text-white">Final reveal is on the big screen!</h1>
        <p className="text-white/40 text-base">Look at the TV/projector for the results</p>
      </div>
      <p className="animate-slide-up-2 text-white/20 text-sm mt-6">
        🎂 Happy Birthday Nadav!
      </p>
    </div>
  );
}

// ─── Main Player Page ─────────────────────────────────────────────────────────

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const { room, players, currentRound, answers, votes, loading, error } = useGameRoom(code);

  const [playerId, setPlayerId] = useState<string | null>(null);

  const audio = useAudio();

  useEffect(() => {
    async function restoreIdentity() {
      await Promise.resolve();
      const id = sessionStorage.getItem("playerId");
      const nick = sessionStorage.getItem("playerNickname");
      if (!id || !nick) {
        router.replace(`/?code=${code}`);
        return;
      }
      setPlayerId(id);
    }
    void restoreIdentity();
  }, [code, router]);

  const me = useMemo(
    () => (playerId ? (players.find((p) => p.id === playerId) ?? null) : null),
    [players, playerId]
  );

  useEffect(() => {
    if (!playerId) return;
    if (!loading && me === null) {
      sessionStorage.removeItem("playerId");
      sessionStorage.removeItem("playerNickname");
      router.replace(`/?code=${code}`);
    }
  }, [playerId, loading, me, code, router]);

  // Phase-based background music
  useEffect(() => {
    if (!room) return;
    const trackMap: Record<string, Parameters<typeof audio.playBg>[0]> = {
      lobby: "bg-lobby",
      answer_submission: "bg-answering",
      voting: "bg-voting",
      results: "bg-results",
      leaderboard: "bg-leaderboard",
      game_over: "bg-gameover",
    };
    audio.playBg(trackMap[room.state] ?? null);
  }, [room?.state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner />;
  if (error)   return <ErrorCard message={error} />;
  if (!room)   return null;
  if (!me)     return <Spinner />;

  const myAnswer = currentRound ? answers.find((a) => a.player_id === me.id) : undefined;
  const myVotes  = currentRound ? votes.filter((v) => v.voter_id === me.id) : [];

  return (
    <>
      <SoundButton audio={audio} />
      {(() => {
        switch (room.state) {
          case "lobby":
            return <PlayerLobby room={room} players={players} me={me} />;

          case "answer_submission":
            if (!currentRound) return <WaitingBanner text="Round starting…" />;
            return (
              <PlayerAnswerForm
                round={currentRound}
                me={me}
                existingAnswer={myAnswer}
                playSfx={audio.playSfx}
              />
            );

          case "voting":
            if (!currentRound) return <WaitingBanner text="Voting starting…" />;
            return (
              <PlayerVotingForm
                round={currentRound}
                me={me}
                answers={answers}
                myAnswer={myAnswer}
                myVotes={myVotes}
                playSfx={audio.playSfx}
              />
            );

          case "results":
            if (!currentRound) return <WaitingBanner text="Loading results…" />;
            return (
              <PlayerResults
                round={currentRound}
                answers={answers}
                votes={votes}
                players={players}
                me={me}
              />
            );

          case "leaderboard":
            return <PlayerLeaderboard players={players} me={me} />;

          case "game_over":
            return <PlayerGameOver />;

          default:
            return <WaitingBanner text="Waiting…" />;
        }
      })()}
    </>
  );
}
