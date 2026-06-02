"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
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
              <span className="text-white font-semibold text-sm flex-1 text-left">{p.nickname}</span>
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
}: {
  round: Round;
  me: Player;
  existingAnswer: Answer | undefined;
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
      setLocalSubmitted(true);
    } catch { setErr("Network error. Try again."); }
    finally { setSubmitting(false); }
  }

  const remaining = 300 - text.length;

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <div className="flex-1 flex flex-col justify-center gap-5 max-w-lg mx-auto w-full">

        {/* Round badge */}
        <div className="flex justify-center animate-slide-up">
          <span className="glass px-4 py-1.5 rounded-full text-xs font-bold text-purple-300 uppercase tracking-widest">
            Round {round.round_number}
          </span>
        </div>

        {/* Prompt card */}
        <div className="glass rounded-3xl p-6 animate-slide-up-1" style={{ borderColor: 'rgba(139,92,246,0.25)' }}>
          <p className="text-2xl font-black text-white text-center leading-snug auto-dir">
            {round.prompt_text}
          </p>
        </div>

        {/* Answer form */}
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
  alreadyVoted,
}: {
  round: Round;
  me: Player;
  answers: Answer[];
  myAnswer: Answer | undefined;
  alreadyVoted: boolean;
}) {
  const [voting, setVoting] = useState(false);
  const [localVoted, setLocalVoted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const shuffled = useMemo(
    () => answers.filter((a) => a.player_id !== me.id).sort((a, b) => a.id.localeCompare(b.id)),
    [answers, me.id]
  );

  if (localVoted || alreadyVoted) {
    return (
      <SubmittedScreen
        emoji="🗳️"
        title="Vote cast!"
        subtitle="Waiting for results…"
      />
    );
  }

  if (!myAnswer) {
    return <WaitingBanner text="You didn't submit an answer, so you can't vote this round." />;
  }

  if (shuffled.length === 0) {
    return <WaitingBanner text="Not enough answers to vote on yet." />;
  }

  async function vote(answerId: string) {
    if (localVoted || voting) return;
    setSelected(answerId);
    setVoting(true); setErr("");
    try {
      const res = await fetch(`/api/rounds/${round.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: me.id, answerId }),
      });
      const data = await res.json();
      if (!res.ok) { setSelected(null); setErr(data.error ?? "Failed to vote."); return; }
      setLocalVoted(true);
    } catch { setSelected(null); setErr("Network error. Try again."); }
    finally { setVoting(false); }
  }

  const letterLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-5 flex-1">

        {/* Header */}
        <div className="flex justify-center animate-slide-up">
          <span className="glass px-4 py-1.5 rounded-full text-xs font-bold text-pink-300 uppercase tracking-widest">
            Vote
          </span>
        </div>

        {/* Prompt */}
        <div className="glass rounded-3xl p-5 text-center animate-slide-up-1">
          <p className="text-lg font-bold text-white leading-snug auto-dir">{round.prompt_text}</p>
        </div>

        <p className="text-white/40 text-sm text-center animate-slide-up-2">
          Tap the answer you like best ↓
        </p>

        {/* Answer cards */}
        <div className="flex flex-col gap-3 flex-1 stagger">
          {shuffled.map((a, i) => {
            const isSelected = selected === a.id;
            return (
              <button
                key={a.id}
                onClick={() => vote(a.id)}
                disabled={voting}
                className={`w-full text-left p-5 rounded-2xl transition-all duration-200 active:scale-[0.97] disabled:opacity-60 ${
                  isSelected
                    ? "bg-purple-600/50 border border-purple-400/70 shadow-lg shadow-purple-900/30"
                    : "glass hover:bg-purple-700/20 hover:border-purple-500/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                    isSelected ? 'bg-purple-400 text-white' : 'bg-white/10 text-white/40'
                  }`}>
                    {letterLabels[i] ?? i + 1}
                  </span>
                  <span className="text-white text-base font-semibold leading-snug flex-1 auto-dir">
                    {a.text}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {err && <p className="text-rose-400 text-sm text-center font-medium">{err}</p>}
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
          <p className="text-lg font-bold text-white leading-snug auto-dir">{round.prompt_text}</p>
        </div>

        {sorted.length === 0 ? (
          <p className="text-white/30 text-center py-8">No answers this round.</p>
        ) : (
          <div className="flex flex-col gap-3 stagger">
            {sorted.map((a, i) => (
              <div
                key={a.id}
                className={`rounded-2xl p-4 transition-all ${
                  i === 0 && a.voteCount > 0
                    ? "winner-card animate-gold-glow"
                    : "glass"
                } ${a.isMe ? "ring-2 ring-purple-500/50" : ""}`}
              >
                {i === 0 && a.voteCount > 0 && (
                  <div className="text-xs text-amber-400 font-black uppercase tracking-widest mb-2">
                    🏆 Winner
                  </div>
                )}
                <div className="flex justify-between items-start gap-3">
                  <p className="text-white font-bold text-base flex-1 leading-snug auto-dir">{a.text}</p>
                  <span className={`text-xl font-black flex-shrink-0 ${a.voteCount > 0 ? "text-gradient-gold" : "text-white/20"}`}>
                    {a.voteCount}
                    <span className="text-sm font-bold"> {a.voteCount === 1 ? "vote" : "votes"}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-white/40 text-xs">— {a.authorNickname}</span>
                  {a.isMe && <span className="text-xs text-purple-400 font-bold">you</span>}
                  {a.voteCount > 0 && (
                    <span className="text-xs text-emerald-400 font-bold">+{a.voteCount * 100} pts</span>
                  )}
                </div>
              </div>
            ))}
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
  const sorted = [...players].sort((a, b) => b.score - a.score);
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
              <span className="text-white font-bold flex-1 truncate">{p.nickname}</span>
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

function PlayerGameOver({ players, me }: { players: Player[]; me: Player }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const iWon = winner?.id === me.id;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <Confetti />

      <div className="animate-pop text-8xl mb-4">{iWon ? "🏆" : "🎉"}</div>

      <div className="animate-slide-up-1 mb-8">
        <h1 className="text-4xl font-black text-gradient-gold mb-1">
          {winner?.nickname ?? "Nobody"} wins!
        </h1>
        <p className="text-white/40 text-base">{winner?.score ?? 0} points</p>
        {iWon && (
          <p className="text-purple-300 font-bold mt-2 animate-slide-up-2">
            That&apos;s you! 🌟
          </p>
        )}
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2 animate-slide-up-2 stagger">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              i < 3 ? RANK_CLASS[i] : "glass"
            } ${p.id === me.id ? "ring-2 ring-purple-500/50" : ""}`}
          >
            <span className="text-lg w-6 text-center">
              {i < 3 ? RANK_MEDAL[i] : <span className="text-white/30 text-sm font-bold">{i + 1}</span>}
            </span>
            <span className="text-white flex-1 font-semibold text-sm">{p.nickname}</span>
            <span className="text-gradient-gold font-black">{p.score}</span>
          </div>
        ))}
      </div>

      <p className="mt-10 text-white/20 text-sm animate-slide-up-3">
        Thanks for playing! 🎂 Happy Birthday Nadav!
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

  const [playerId] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("playerId") : null
  );

  const me = useMemo(
    () => (playerId ? (players.find((p) => p.id === playerId) ?? null) : null),
    [players, playerId]
  );

  useEffect(() => {
    const nick = typeof window !== "undefined" ? sessionStorage.getItem("playerNickname") : null;
    if (!playerId || !nick) {
      router.replace(`/?code=${code}`);
      return;
    }
    if (!loading && me === null) {
      sessionStorage.removeItem("playerId");
      sessionStorage.removeItem("playerNickname");
      router.replace(`/?code=${code}`);
    }
  }, [playerId, loading, me, code, router]);

  if (loading) return <Spinner />;
  if (error)   return <ErrorCard message={error} />;
  if (!room)   return null;
  if (!me)     return <Spinner />;

  const myAnswer = currentRound ? answers.find((a) => a.player_id === me.id) : undefined;
  const myVote   = currentRound ? votes.find((v)   => v.voter_id   === me.id) : undefined;

  switch (room.state) {
    case "lobby":
      return <PlayerLobby room={room} players={players} me={me} />;

    case "answer_submission":
      if (!currentRound) return <WaitingBanner text="Round starting…" />;
      return <PlayerAnswerForm round={currentRound} me={me} existingAnswer={myAnswer} />;

    case "voting":
      if (!currentRound) return <WaitingBanner text="Voting starting…" />;
      return (
        <PlayerVotingForm
          round={currentRound}
          me={me}
          answers={answers}
          myAnswer={myAnswer}
          alreadyVoted={!!myVote}
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
      return <PlayerGameOver players={players} me={me} />;

    default:
      return <WaitingBanner text="Waiting…" />;
  }
}
