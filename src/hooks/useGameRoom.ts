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
  const supabase = useRef(createClient()).current;

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const currentRoundIdRef = useRef<string | null>(null);

  // Guards against applying stale fetch results when concurrent fetches race
  const playersRoundGenRef = useRef(0);
  const answersVotesGenRef = useRef(0);

  // Prevents state updates after component unmounts
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchAnswersAndVotes = useCallback(
    async (roundId: string) => {
      const gen = ++answersVotesGenRef.current;

      const [{ data: ans }, { data: vts }] = await Promise.all([
        supabase.from("answers").select("*").eq("round_id", roundId),
        supabase.from("votes").select("*").eq("round_id", roundId),
      ]);

      if (!mountedRef.current || gen !== answersVotesGenRef.current) return;
      setAnswers(ans ?? []);
      setVotes(vts ?? []);
    },
    [supabase]
  );

  const fetchPlayersAndRound = useCallback(
    async (roomId: string) => {
      const gen = ++playersRoundGenRef.current;

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

      if (!mountedRef.current || gen !== playersRoundGenRef.current) return;

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
    async function init() {
      const { data: r, error: rErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .single();

      if (!mountedRef.current) return;

      if (rErr || !r) {
        setError("Room not found. Check the code and try again.");
        setLoading(false);
        return;
      }

      setRoom(r);
      roomIdRef.current = r.id;
      await fetchPlayersAndRound(r.id);
      if (mountedRef.current) setLoading(false);
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ── Room-level realtime subscription ─────────────────────────────────────
  useEffect(() => {
    if (!room) return;
    const roomId = room.id;
    let firstSubscribe = true;

    const ch = supabase
      .channel(`game:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (p) => {
          if (mountedRef.current) setRoom(p.new as Room);
        }
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
      .subscribe((status) => {
        // Refetch on reconnect to catch any events missed during disconnect
        if (status === "SUBSCRIBED" && !firstSubscribe) {
          fetchPlayersAndRound(roomId);
        }
        firstSubscribe = false;
      });

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // ── Round-level realtime subscription (answers & votes) ──────────────────
  useEffect(() => {
    if (!currentRound) return;
    const roundId = currentRound.id;
    let firstSubscribe = true;

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
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !firstSubscribe) {
          fetchAnswersAndVotes(roundId);
        }
        firstSubscribe = false;
      });

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound?.id]);

  return { room, players, currentRound, answers, votes, loading, error, refetch };
}
