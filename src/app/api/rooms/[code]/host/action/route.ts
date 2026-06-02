import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Central host action endpoint — all state transitions and admin ops go here
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { pin, action, ...extra } = body;

    if (!pin || !action) {
      return NextResponse.json({ error: "PIN and action are required." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify room and PIN
    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, host_pin, state")
      .eq("code", code.toUpperCase())
      .single();

    if (roomErr || !room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    if (room.host_pin !== pin) {
      return NextResponse.json({ error: "Invalid PIN." }, { status: 403 });
    }

    const roomId = room.id;

    // ── start_round ──────────────────────────────────────────────────────────
    if (action === "start_round") {
      // Pick next unused prompt
      const { data: prompt } = await supabase
        .from("prompts")
        .select("*")
        .eq("room_id", roomId)
        .eq("used", false)
        .order("order_index", { ascending: true })
        .limit(1)
        .single();

      if (!prompt) {
        return NextResponse.json({ error: "No prompts remaining. Import more or end the game." }, { status: 400 });
      }

      // Get the current max round number
      const { data: rounds } = await supabase
        .from("rounds")
        .select("round_number")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1);

      const nextRoundNumber = (rounds?.[0]?.round_number ?? 0) + 1;

      // Create new round
      const { error: roundErr } = await supabase.from("rounds").insert({
        room_id: roomId,
        prompt_id: prompt.id,
        prompt_text: prompt.text,
        round_number: nextRoundNumber,
        state: "answer_submission",
      });
      if (roundErr) {
        console.error("Round insert error:", roundErr);
        return NextResponse.json({ error: "Failed to create round." }, { status: 500 });
      }

      // Mark prompt as used
      await supabase.from("prompts").update({ used: true }).eq("id", prompt.id);

      // Advance room state
      await supabase.from("rooms").update({ state: "answer_submission" }).eq("id", roomId);

      return NextResponse.json({ message: "Round started." });
    }

    // ── end_submission ───────────────────────────────────────────────────────
    if (action === "end_submission") {
      if (room.state !== "answer_submission") {
        return NextResponse.json({ error: "Not in submission phase." }, { status: 400 });
      }
      await supabase.from("rooms").update({ state: "voting" }).eq("id", roomId);
      return NextResponse.json({ message: "Voting phase started." });
    }

    // ── end_voting ───────────────────────────────────────────────────────────
    if (action === "end_voting") {
      if (room.state !== "voting") {
        return NextResponse.json({ error: "Not in voting phase." }, { status: 400 });
      }

      // Calculate scores: each vote on an answer awards 100 pts to the answer's author
      const { data: rounds } = await supabase
        .from("rounds")
        .select("id")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1);

      const currentRoundId = rounds?.[0]?.id;
      if (currentRoundId) {
        const { data: votes } = await supabase
          .from("votes")
          .select("answer_id")
          .eq("round_id", currentRoundId);

        if (votes && votes.length > 0) {
          const { data: answers } = await supabase
            .from("answers")
            .select("id, player_id")
            .eq("round_id", currentRoundId);

          // Tally votes per player
          const scoreMap: Record<string, number> = {};
          for (const vote of votes) {
            const answer = answers?.find((a) => a.id === vote.answer_id);
            if (answer) {
              scoreMap[answer.player_id] = (scoreMap[answer.player_id] ?? 0) + 100;
            }
          }

          // Apply score increments
          for (const [playerId, points] of Object.entries(scoreMap)) {
            const { data: player } = await supabase
              .from("players")
              .select("score")
              .eq("id", playerId)
              .single();
            if (player) {
              await supabase
                .from("players")
                .update({ score: player.score + points })
                .eq("id", playerId);
            }
          }
        }
      }

      await supabase.from("rooms").update({ state: "results" }).eq("id", roomId);
      return NextResponse.json({ message: "Results shown." });
    }

    // ── show_leaderboard ──────────────────────────────────────────────────────
    if (action === "show_leaderboard") {
      if (room.state !== "results") {
        return NextResponse.json({ error: "Not in results phase." }, { status: 400 });
      }
      await supabase.from("rooms").update({ state: "leaderboard" }).eq("id", roomId);
      return NextResponse.json({ message: "Leaderboard shown." });
    }

    // ── end_game ──────────────────────────────────────────────────────────────
    if (action === "end_game") {
      await supabase.from("rooms").update({ state: "game_over" }).eq("id", roomId);
      return NextResponse.json({ message: "Game over." });
    }

    // ── skip_round ────────────────────────────────────────────────────────────
    if (action === "skip_round") {
      // Start next round regardless of current state (admin action)
      await supabase.from("rooms").update({ state: "leaderboard" }).eq("id", roomId);
      return NextResponse.json({ message: "Round skipped. Press Next Round to continue." });
    }

    // ── restart_round ─────────────────────────────────────────────────────────
    if (action === "restart_round") {
      // Delete answers and votes for current round, reset to answer_submission
      const { data: rounds } = await supabase
        .from("rounds")
        .select("id, prompt_id")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1);

      const currentRound = rounds?.[0];
      if (currentRound) {
        await supabase.from("votes").delete().eq("round_id", currentRound.id);
        await supabase.from("answers").delete().eq("round_id", currentRound.id);
        // Un-use the prompt so we can replay it
        if (currentRound.prompt_id) {
          await supabase.from("prompts").update({ used: false }).eq("id", currentRound.prompt_id);
        }
        await supabase.from("rounds").delete().eq("id", currentRound.id);
        // Decrement round number effectively by deleting and re-starting
      }

      // Start the round again (re-picks the prompt since we un-used it)
      // We call the start_round logic inline
      const { data: prompt } = await supabase
        .from("prompts")
        .select("*")
        .eq("room_id", roomId)
        .eq("used", false)
        .order("order_index", { ascending: true })
        .limit(1)
        .single();

      if (!prompt) {
        await supabase.from("rooms").update({ state: "lobby" }).eq("id", roomId);
        return NextResponse.json({ message: "Round restarted. No more prompts — returned to lobby." });
      }

      const { data: allRounds } = await supabase
        .from("rounds")
        .select("round_number")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1);

      const nextNum = (allRounds?.[0]?.round_number ?? 0) + 1;

      await supabase.from("rounds").insert({
        room_id: roomId,
        prompt_id: prompt.id,
        prompt_text: prompt.text,
        round_number: nextNum,
        state: "answer_submission",
      });
      await supabase.from("prompts").update({ used: true }).eq("id", prompt.id);
      await supabase.from("rooms").update({ state: "answer_submission" }).eq("id", roomId);
      return NextResponse.json({ message: "Round restarted." });
    }

    // ── reset_scores ──────────────────────────────────────────────────────────
    if (action === "reset_scores") {
      await supabase.from("players").update({ score: 0 }).eq("room_id", roomId);
      return NextResponse.json({ message: "Scores reset." });
    }

    // ── remove_player ─────────────────────────────────────────────────────────
    if (action === "remove_player") {
      const { playerId } = extra as { playerId?: string };
      if (!playerId) {
        return NextResponse.json({ error: "playerId required." }, { status: 400 });
      }
      await supabase
        .from("players")
        .update({ is_active: false })
        .eq("id", playerId)
        .eq("room_id", roomId);
      return NextResponse.json({ message: "Player removed." });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("Unexpected error in /api/rooms/[code]/host/action:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
