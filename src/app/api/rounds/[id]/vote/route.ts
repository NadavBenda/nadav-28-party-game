import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { MAX_VOTES_PER_PLAYER } from "@/lib/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roundId } = await params;
    const body = await request.json();
    const { voterId, answerId } = body;

    if (!voterId || !answerId) {
      return NextResponse.json({ error: "voterId and answerId are required." }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: round, error: roundErr } = await supabase
      .from("rounds")
      .select("id, room_id")
      .eq("id", roundId)
      .single();

    if (roundErr || !round) {
      return NextResponse.json({ error: "Round not found." }, { status: 404 });
    }

    const { data: room } = await supabase
      .from("rooms")
      .select("state")
      .eq("id", round.room_id)
      .single();

    if (room?.state !== "voting") {
      return NextResponse.json({ error: "Voting is closed." }, { status: 400 });
    }

    const { data: voter } = await supabase
      .from("players")
      .select("id")
      .eq("id", voterId)
      .eq("room_id", round.room_id)
      .eq("is_active", true)
      .single();

    if (!voter) {
      return NextResponse.json({ error: "Voter not found in this room." }, { status: 404 });
    }

    const { data: answer } = await supabase
      .from("answers")
      .select("id, player_id")
      .eq("id", answerId)
      .eq("round_id", roundId)
      .single();

    if (!answer) {
      return NextResponse.json({ error: "Answer not found." }, { status: 404 });
    }

    if (answer.player_id === voterId) {
      return NextResponse.json({ error: "You cannot vote for your own answer." }, { status: 400 });
    }

    const { data: voterAnswer } = await supabase
      .from("answers")
      .select("id")
      .eq("round_id", roundId)
      .eq("player_id", voterId)
      .single();

    if (!voterAnswer) {
      return NextResponse.json({ error: "You must submit an answer to vote." }, { status: 400 });
    }

    // Check total votes used this round by this voter
    const { count: usedVotes } = await supabase
      .from("votes")
      .select("id", { count: "exact", head: true })
      .eq("round_id", roundId)
      .eq("voter_id", voterId);

    if ((usedVotes ?? 0) >= MAX_VOTES_PER_PLAYER) {
      return NextResponse.json(
        { error: `You've used all ${MAX_VOTES_PER_PLAYER} votes this round.` },
        { status: 409 }
      );
    }

    // Check not already voted for this specific answer (also caught by DB constraint)
    const { data: dupVote } = await supabase
      .from("votes")
      .select("id")
      .eq("round_id", roundId)
      .eq("voter_id", voterId)
      .eq("answer_id", answerId)
      .single();

    if (dupVote) {
      return NextResponse.json({ error: "You already voted for this answer." }, { status: 409 });
    }

    const { error: voteErr } = await supabase.from("votes").insert({
      round_id: roundId,
      voter_id: voterId,
      answer_id: answerId,
    });

    if (voteErr) {
      if (voteErr.code === "23505") {
        return NextResponse.json({ error: "You already voted for this answer." }, { status: 409 });
      }
      console.error("Vote insert error:", voteErr);
      return NextResponse.json({ error: "Failed to submit vote." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unexpected error in /api/rounds/[id]/vote:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
