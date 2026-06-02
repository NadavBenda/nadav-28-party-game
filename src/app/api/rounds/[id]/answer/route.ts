import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roundId } = await params;
    const body = await request.json();
    const { playerId, text } = body;

    if (!playerId || !text?.trim()) {
      return NextResponse.json({ error: "playerId and text are required." }, { status: 400 });
    }

    const cleanText = String(text).trim().slice(0, 300);

    const supabase = createServiceClient();

    // Verify the round exists and is in answer_submission state
    const { data: round, error: roundErr } = await supabase
      .from("rounds")
      .select("id, room_id, state")
      .eq("id", roundId)
      .single();

    if (roundErr || !round) {
      return NextResponse.json({ error: "Round not found." }, { status: 404 });
    }

    // Check room state (room is the source of truth for game state)
    const { data: room } = await supabase
      .from("rooms")
      .select("state")
      .eq("id", round.room_id)
      .single();

    if (room?.state !== "answer_submission") {
      return NextResponse.json({ error: "Answer submission is closed." }, { status: 400 });
    }

    // Verify player belongs to this room and is active
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("id", playerId)
      .eq("room_id", round.room_id)
      .eq("is_active", true)
      .single();

    if (!player) {
      return NextResponse.json({ error: "Player not found in this room." }, { status: 404 });
    }

    // Upsert answer — idempotent if they somehow submit twice
    const { data: answer, error: ansErr } = await supabase
      .from("answers")
      .upsert(
        { round_id: roundId, player_id: playerId, text: cleanText },
        { onConflict: "round_id,player_id" }
      )
      .select()
      .single();

    if (ansErr || !answer) {
      console.error("Answer insert error:", ansErr);
      return NextResponse.json({ error: "Failed to submit answer." }, { status: 500 });
    }

    return NextResponse.json({ answerId: answer.id });
  } catch (err) {
    console.error("Unexpected error in /api/rounds/[id]/answer:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
