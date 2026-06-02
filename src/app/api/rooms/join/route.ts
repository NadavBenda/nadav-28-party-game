import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, nickname } = body;

    if (!code || !nickname) {
      return NextResponse.json(
        { error: "Room code and nickname are required." },
        { status: 400 }
      );
    }

    const cleanNickname = String(nickname).trim().slice(0, 20);
    if (!cleanNickname) {
      return NextResponse.json({ error: "Nickname cannot be empty." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Find the room
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, code, state")
      .eq("code", String(code).toUpperCase())
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: "Room not found. Check the code and try again." },
        { status: 404 }
      );
    }

    if (room.state === "game_over") {
      return NextResponse.json(
        { error: "This game has already ended." },
        { status: 400 }
      );
    }

    // Insert player (upsert so rejoining works if session reloads)
    const { data: player, error: playerError } = await supabase
      .from("players")
      .upsert(
        { room_id: room.id, nickname: cleanNickname, is_active: true },
        { onConflict: "room_id,nickname", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (playerError || !player) {
      // Unique constraint violation means nickname is taken
      if (playerError?.code === "23505") {
        return NextResponse.json(
          { error: "That nickname is already taken in this room." },
          { status: 409 }
        );
      }
      console.error("Error inserting player:", playerError);
      return NextResponse.json(
        { error: "Failed to join room." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      playerId: player.id,
      nickname: player.nickname,
      code: room.code,
      roomState: room.state,
    });
  } catch (err) {
    console.error("Unexpected error in /api/rooms/join:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
