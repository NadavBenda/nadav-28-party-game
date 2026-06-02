"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameRoom } from "@/hooks/useGameRoom";
import type { Room, Player, Round, Answer, Vote } from "@/lib/types";

// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="text-gray-400 text-xl animate-pulse">Loading…</div>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4">
      <div className="bg-red-900/40 border border-red-700 rounded-2xl p-8 text-center max-w-sm w-full">
        <p className="text-red-300 text-lg">{message}</p>
      </div>
    </div>
  );
}

function WaitingBanner({ text }: { text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="text-5xl mb-4 animate-bounce">⏳</div>
      <p className="text-gray-300 text-xl font-semibold">{text}</p>
    </div>
  );
}

// ─── Player Lobby ─────────────────────────────────────────────────────────────

function PlayerLobby({ room, players, me }: { room: Room; players: Player[]; me: Player }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 text-center">
      <div className="mb-8">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-1">Room Code</p>
        <p className="text-6xl font-black text-purple-300 tracking-widest">{room.code}</p>
      </div>
      <p className="text-2xl font-bold text-white mb-1">
        Hi, <span className="text-purple-400">{me.nickname}</span>!
      </p>
      <p className="text-gray-400 mb-8">Waiting for the host to start…</p>
      <div className="w-full max-w-xs bg-white/5 rounded-2xl p-4">
        <p className="text-gray-500 text-sm mb-3">
          {players.length} {players.length === 1 ? "player" : "players"} joined
        </p>
        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 ${p.id === me.id ? "bg-purple-700/40" : "bg-white/5"}`}
            >
              <span className="text-white font-semibold">{p.nickname}</span>
              {p.id === me.id && <span className="text-xs text-purple-300 ml-auto">You</span>}
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
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <div className="text-6xl mb-4">{emoji}</div>
      <p className="text-2xl font-bold text-green-400 mb-2">{title}</p>
      <p className="text-gray-400">{subtitle}</p>
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
  // Local submitted flag: set to true after successful submit.
  // We also treat existingAnswer as "already submitted" (handles page refresh).
  const [localSubmitted, setLocalSubmitted] = useState(false);

  // Show submitted state if we have an existing answer OR just submitted locally
  if (localSubmitted || existingAnswer) {
    return (
      <SubmittedScreen
        emoji="✅"
        title="Answer submitted!"
        subtitle="Waiting for others…"
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

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <div className="flex-1 flex flex-col justify-center">
        <p className="text-gray-400 text-sm uppercase tracking-widest text-center mb-3">
          Round {round.round_number}
        </p>
        <div className="bg-white/5 rounded-2xl p-6 mb-6">
          <p className="text-2xl font-bold text-white text-center leading-snug">
            {round.prompt_text}
          </p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setErr(""); }}
            placeholder="Type your answer here…"
            rows={4}
            maxLength={300}
            autoFocus
            className="auto-dir w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/20 text-white text-lg placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30"
          />
          {err && <p className="text-red-400 text-sm text-center">{err}</p>}
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="w-full py-5 rounded-2xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xl font-black transition-all disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Answer"}
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
  const [err, setErr] = useState("");

  // Order answers by ID for a stable, non-obvious display order.
  // UUIDs are randomly generated so the order varies per round without Math.random().
  const shuffled = useMemo(
    () => answers.filter((a) => a.player_id !== me.id).sort((a, b) => a.id.localeCompare(b.id)),
    [answers, me.id]
  );

  // Show voted confirmation if already voted (page refresh) or just voted locally
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
    return <WaitingBanner text="Not enough answers to vote on this round." />;
  }

  async function vote(answerId: string) {
    if (localVoted || voting) return;
    setVoting(true); setErr("");
    try {
      const res = await fetch(`/api/rounds/${round.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: me.id, answerId }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Failed to vote."); return; }
      setLocalVoted(true);
    } catch { setErr("Network error. Try again."); }
    finally { setVoting(false); }
  }

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <p className="text-gray-400 text-sm uppercase tracking-widest text-center mb-3">Vote</p>
      <div className="bg-white/5 rounded-2xl p-4 mb-6 text-center">
        <p className="text-lg font-semibold text-white">{round.prompt_text}</p>
      </div>
      <p className="text-gray-400 text-sm text-center mb-4">Tap the answer you like best:</p>
      <div className="flex flex-col gap-4 flex-1">
        {shuffled.map((a, i) => (
          <button
            key={a.id}
            onClick={() => vote(a.id)}
            disabled={voting}
            className="w-full text-left p-5 rounded-2xl bg-white/10 hover:bg-purple-700/60 active:scale-95 border border-white/10 hover:border-purple-500 transition-all disabled:opacity-50 text-white text-lg font-semibold"
          >
            <span className="text-gray-500 text-sm mr-2">
              {String.fromCharCode(65 + i)}.
            </span>
            {a.text}
          </button>
        ))}
      </div>
      {err && <p className="text-red-400 text-sm text-center mt-4">{err}</p>}
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
      <p className="text-gray-400 text-sm uppercase tracking-widest text-center mb-3">Results</p>
      <div className="bg-white/5 rounded-2xl p-4 mb-6 text-center">
        <p className="text-lg font-semibold text-white">{round.prompt_text}</p>
      </div>
      {sorted.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No answers this round.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map((a, i) => (
            <div
              key={a.id}
              className={`rounded-2xl p-4 ${i === 0 && a.voteCount > 0 ? "bg-yellow-900/40 border border-yellow-600" : "bg-white/5"} ${a.isMe ? "ring-2 ring-purple-500" : ""}`}
            >
              <div className="flex justify-between items-start gap-2">
                <p className="text-white font-bold flex-1">{a.text}</p>
                <span className={`font-black ${a.voteCount > 0 ? "text-yellow-400" : "text-gray-600"}`}>
                  {a.voteCount}v
                </span>
              </div>
              <div className="flex gap-2 mt-1 text-xs">
                <span className="text-gray-400">— {a.authorNickname}</span>
                {a.isMe && <span className="text-purple-400">(You)</span>}
                {a.voteCount > 0 && <span className="text-green-400">+{a.voteCount * 100} pts</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

function PlayerLeaderboard({ players, me }: { players: Player[]; me: Player }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const myRank = sorted.findIndex((p) => p.id === me.id) + 1;

  return (
    <div className="flex flex-col min-h-screen px-4 py-8">
      <h2 className="text-3xl font-black text-center mb-2 text-white">Leaderboard</h2>
      {myRank > 0 && (
        <p className="text-center text-gray-400 text-sm mb-6">You are #{myRank}</p>
      )}
      <div className="flex flex-col gap-3">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${p.id === me.id ? "bg-purple-700/40 border border-purple-600" : i === 0 ? "bg-yellow-900/30" : "bg-white/5"}`}
          >
            <span className="text-gray-500 font-bold w-6">{i + 1}</span>
            <span className="text-white font-bold flex-1">{p.nickname}</span>
            {p.id === me.id && <span className="text-xs text-purple-300">You</span>}
            <span className="text-yellow-400 font-black">{p.score}</span>
          </div>
        ))}
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
      <p className="text-7xl mb-4">{iWon ? "🏆" : "🎉"}</p>
      <h1 className="text-4xl font-black text-yellow-400 mb-1">
        {winner?.nickname ?? "Nobody"} wins!
      </h1>
      <p className="text-gray-400 mb-8">{winner?.score ?? 0} points</p>
      <div className="w-full max-w-xs flex flex-col gap-2">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 ${p.id === me.id ? "bg-purple-700/40" : "bg-white/5"}`}
          >
            <span className="text-gray-500 w-5">{i + 1}</span>
            <span className="text-white flex-1">{p.nickname}</span>
            <span className="text-yellow-400 font-black">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Player Page ─────────────────────────────────────────────────────────

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string).toUpperCase();

  const { room, players, currentRound, answers, votes, loading, error } = useGameRoom(code);

  // Read from sessionStorage once — stable for the component's lifetime
  const [playerId] = useState<string | null>(() =>
    typeof window !== "undefined" ? sessionStorage.getItem("playerId") : null
  );

  // Derive me directly from players — no effect, no setState
  const me = useMemo(
    () => (playerId ? (players.find((p) => p.id === playerId) ?? null) : null),
    [players, playerId]
  );

  // Redirect on missing session or when players have loaded and we're not in the active list
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
  if (error) return <ErrorCard message={error} />;
  if (!room) return null;
  if (!me) return <Spinner />;

  const myAnswer = currentRound ? answers.find((a) => a.player_id === me.id) : undefined;
  const myVote = currentRound ? votes.find((v) => v.voter_id === me.id) : undefined;

  switch (room.state) {
    case "lobby":
      return <PlayerLobby room={room} players={players} me={me} />;

    case "answer_submission":
      if (!currentRound) return <WaitingBanner text="Round starting…" />;
      return (
        <PlayerAnswerForm round={currentRound} me={me} existingAnswer={myAnswer} />
      );

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
