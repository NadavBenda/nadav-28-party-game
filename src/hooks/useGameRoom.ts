"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, Player, Round, Answer, Vote } from "@/lib/types";

export interface GameRoomState {
  room: Room | null;
  players: Player[];
  currentRound: Round | null;
  answers: Answer[];
  votes: Vote[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGameRoom(code: string): GameRoomState {
  // Stable supabase client — created once per component mount
  const supabase = useRef(createClient()).current;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs so callbacks can read latest values without stale closures
  const roomIdRef = useRef<string | null>(null);
  const currentRoundIdRef = useRef<string | null>(null);

  const fetchAnswersAndVotes = useCallback(
    async (roundId: string) => {
      const [{ data: ans }, { data: vts }] = await Promise.all([
        supabase.from("answers").select("*").eq("round_id", roundId),
        supabase.from("votes").select("*").eq("round_id", roundId),
      ]);
      setAnswers(ans ?? []);
      setVotes(vts ?? []);
    },
    [supabase]
  );

  const fetchPlayersAndRound = useCallback(
    async (roomId: string) => {
      const [{ data: pls }, { data: rds }] = await Promise.all([
        supabase
          .from("players")
          .select("*")
          .eq("room_id", roomId)
          .eq("is_active", true)
          .order("score", { ascending: false }),
        supabase
          .from("rounds")
          .select("*")
          .eq("room_id", roomId)
          .order("round_number", { ascending: false })
          .limit(1),
      ]);

      setPlayers(pls ?? []);

      const round = rds?.[0] ?? null;
      const prevRoundId = currentRoundIdRef.current;
      currentRoundIdRef.current = round?.id ?? null;
      setCurrentRound(round);

      if (round) {
        await fetchAnswersAndVotes(round.id);
      } else if (prevRoundId) {
        setAnswers([]);
        setVotes([]);
      }
    },
    [supabase, fetchAnswersAndVotes]
  );

  const refetch = useCallback(async () => {
    if (roomIdRef.current) await fetchPlayersAndRound(roomIdRef.current);
  }, [fetchPlayersAndRound]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data: r, error: rErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .single();

      if (cancelled) return;

      if (rErr || !r) {
        setError("Room not found. Check the code and try again.");
        setLoading(false);
        return;
      }

      setRoom(r);
      roomIdRef.current = r.id;
      await fetchPlayersAndRound(r.id);
      if (!cancelled) setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── Room-level realtime subscription ─────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    const roomId = room.id;

    const ch = supabase
      .channel(`game:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (p) => setRoom(p.new as Room)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
        () => fetchPlayersAndRound(roomId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${roomId}` },
        () => fetchPlayersAndRound(roomId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // ── Round-level realtime subscription (answers & votes) ──────────────────
  useEffect(() => {
    if (!currentRound) return;
    const roundId = currentRound.id;

    const ch = supabase
      .channel(`round:${roundId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `round_id=eq.${roundId}` },
        () => fetchAnswersAndVotes(roundId)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `round_id=eq.${roundId}` },
        () => fetchAnswersAndVotes(roundId)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound?.id]);

  return { room, players, currentRound, answers, votes, loading, error, refetch };
}
