import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

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
      // Guard: only valid from lobby or leaderboard — prevents double-click races
      if (room.state !== "lobby" && room.state !== "leaderboard") {
        return NextResponse.json(
          { error: "A round is already in progress." },
          { status: 409 }
        );
      }

      const { data: prompt } = await supabase
        .from("prompts")
        .select("id, text, order_index")
        .eq("room_id", roomId)
        .eq("used", false)
        .order("order_index", { ascending: true })
        .limit(1)
        .single();

      if (!prompt) {
        return NextResponse.json(
          { error: "No prompts remaining. Add more prompts or end the game." },
          { status: 400 }
        );
      }

      const { data: latestRound } = await supabase
        .from("rounds")
        .select("round_number")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1)
        .single();

      const nextRoundNumber = (latestRound?.round_number ?? 0) + 1;

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

      // Mark prompt as used and advance room state atomically-ish
      await Promise.all([
        supabase.from("prompts").update({ used: true }).eq("id", prompt.id),
        supabase.from("rooms").update({ state: "answer_submission" }).eq("id", roomId),
      ]);

      return NextResponse.json({ message: "Round started." });
    }

    // ── end_submission ───────────────────────────────────────────────────────
    if (action === "end_submission") {
      if (room.state !== "answer_submission") {
        return NextResponse.json({ error: "Not in submission phase." }, { status: 409 });
      }
      const { error: updErr } = await supabase
        .from("rooms")
        .update({ state: "voting" })
        .eq("id", roomId)
        .eq("state", "answer_submission"); // optimistic lock
      if (updErr) {
        return NextResponse.json({ error: "State update failed." }, { status: 500 });
      }
      return NextResponse.json({ message: "Voting phase started." });
    }

    // ── end_voting ───────────────────────────────────────────────────────────
    if (action === "end_voting") {
      if (room.state !== "voting") {
        return NextResponse.json({ error: "Not in voting phase." }, { status: 409 });
      }

      // Atomically transition state first — prevents double-scoring on concurrent calls.
      // If state is no longer "voting" (another request already handled this), return ok.
      const { data: transitioned } = await supabase
        .from("rooms")
        .update({ state: "results" })
        .eq("id", roomId)
        .eq("state", "voting")  // only succeeds if still in voting
        .select("id");

      if (!transitioned || transitioned.length === 0) {
        // Already transitioned — idempotent success
        return NextResponse.json({ message: "Already done." });
      }

      // Now we're the sole thread computing scores. Safe to do read-modify-write.
      const { data: currentRoundRows } = await supabase
        .from("rounds")
        .select("id")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1);

      const currentRoundId = currentRoundRows?.[0]?.id;

      if (currentRoundId) {
        const [{ data: votes }, { data: answers }] = await Promise.all([
          supabase.from("votes").select("answer_id").eq("round_id", currentRoundId),
          supabase.from("answers").select("id, player_id").eq("round_id", currentRoundId),
        ]);

        if (votes && votes.length > 0 && answers) {
          // Tally votes per player
          const scoreMap: Record<string, number> = {};
          for (const vote of votes) {
            const answer = answers.find((a) => a.id === vote.answer_id);
            if (answer) {
              scoreMap[answer.player_id] = (scoreMap[answer.player_id] ?? 0) + 100;
            }
          }

          if (Object.keys(scoreMap).length > 0) {
            // Batch-read current scores, then update all in parallel
            const { data: currentPlayers } = await supabase
              .from("players")
              .select("id, score")
              .in("id", Object.keys(scoreMap));

            if (currentPlayers && currentPlayers.length > 0) {
              await Promise.all(
                currentPlayers.map((player) => {
                  const earned = scoreMap[player.id] ?? 0;
                  if (!earned) return Promise.resolve();
                  return supabase
                    .from("players")
                    .update({ score: player.score + earned })
                    .eq("id", player.id);
                })
              );
            }
          }
        }
      }

      return NextResponse.json({ message: "Results shown." });
    }

    // ── show_leaderboard ──────────────────────────────────────────────────────
    if (action === "show_leaderboard") {
      if (room.state !== "results") {
        return NextResponse.json({ error: "Not in results phase." }, { status: 409 });
      }
      await supabase
        .from("rooms")
        .update({ state: "leaderboard" })
        .eq("id", roomId)
        .eq("state", "results");
      return NextResponse.json({ message: "Leaderboard shown." });
    }

    // ── end_game ──────────────────────────────────────────────────────────────
    if (action === "end_game") {
      if (room.state === "game_over") {
        return NextResponse.json({ message: "Already ended." });
      }
      await supabase.from("rooms").update({ state: "game_over" }).eq("id", roomId);
      return NextResponse.json({ message: "Game over." });
    }

    // ── skip_round — admin: jump to leaderboard from any active state ─────────
    if (action === "skip_round") {
      const validStates = ["answer_submission", "voting", "results"];
      if (!validStates.includes(room.state)) {
        return NextResponse.json(
          { error: "No active round to skip." },
          { status: 400 }
        );
      }
      await supabase.from("rooms").update({ state: "leaderboard" }).eq("id", roomId);
      return NextResponse.json({ message: "Round skipped. Press Next Round to continue." });
    }

    // ── restart_round — admin: wipe current round and replay ─────────────────
    if (action === "restart_round") {
      const { data: roundRows } = await supabase
        .from("rounds")
        .select("id, prompt_id")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1);

      const currentRound = roundRows?.[0];
      if (currentRound) {
        // Delete answers + votes in parallel, then delete round
        await Promise.all([
          supabase.from("votes").delete().eq("round_id", currentRound.id),
          supabase.from("answers").delete().eq("round_id", currentRound.id),
        ]);
        if (currentRound.prompt_id) {
          await supabase
            .from("prompts")
            .update({ used: false })
            .eq("id", currentRound.prompt_id);
        }
        await supabase.from("rounds").delete().eq("id", currentRound.id);
      }

      // Pick next unused prompt (the one we just un-used will be first)
      const { data: prompt } = await supabase
        .from("prompts")
        .select("id, text")
        .eq("room_id", roomId)
        .eq("used", false)
        .order("order_index", { ascending: true })
        .limit(1)
        .single();

      if (!prompt) {
        await supabase.from("rooms").update({ state: "lobby" }).eq("id", roomId);
        return NextResponse.json({
          message: "Round cleared. No prompts remaining — returned to lobby.",
        });
      }

      const { data: latestRound } = await supabase
        .from("rounds")
        .select("round_number")
        .eq("room_id", roomId)
        .order("round_number", { ascending: false })
        .limit(1)
        .single();

      const nextNum = (latestRound?.round_number ?? 0) + 1;

      await supabase.from("rounds").insert({
        room_id: roomId,
        prompt_id: prompt.id,
        prompt_text: prompt.text,
        round_number: nextNum,
        state: "answer_submission",
      });
      await Promise.all([
        supabase.from("prompts").update({ used: true }).eq("id", prompt.id),
        supabase.from("rooms").update({ state: "answer_submission" }).eq("id", roomId),
      ]);
      return NextResponse.json({ message: "Round restarted." });
    }

    // ── reset_scores ──────────────────────────────────────────────────────────
    if (action === "reset_scores") {
      await supabase.from("players").update({ score: 0 }).eq("room_id", roomId);
      return NextResponse.json({ message: "All scores reset to 0." });
    }

    // ── remove_player ─────────────────────────────────────────────────────────
    if (action === "remove_player") {
      const { playerId } = extra as { playerId?: string };
      if (!playerId || typeof playerId !== "string") {
        return NextResponse.json({ error: "playerId required." }, { status: 400 });
      }
      const { error: removeErr } = await supabase
        .from("players")
        .update({ is_active: false })
        .eq("id", playerId)
        .eq("room_id", roomId); // safety: ensure player belongs to this room
      if (removeErr) {
        return NextResponse.json({ error: "Failed to remove player." }, { status: 500 });
      }
      return NextResponse.json({ message: "Player removed." });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("Unexpected error in host action:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
