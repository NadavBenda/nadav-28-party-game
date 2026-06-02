import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

function generateRoomCode(length = 5): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hostPin } = body;

    if (!hostPin || typeof hostPin !== "string" || hostPin.length < 4) {
      return NextResponse.json(
        { error: "PIN must be at least 4 characters." },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Generate a unique room code (retry up to 5 times on collision)
    let code = "";
    let attempts = 0;
    while (attempts < 5) {
      code = generateRoomCode();
      const { data: existing } = await supabase
        .from("rooms")
        .select("id")
        .eq("code", code)
        .single();
      if (!existing) break;
      attempts++;
    }

    if (!code) {
      return NextResponse.json(
        { error: "Could not generate a unique room code. Try again." },
        { status: 500 }
      );
    }

    const { data: room, error } = await supabase
      .from("rooms")
      .insert({ code, host_pin: hostPin, state: "lobby" })
      .select()
      .single();

    if (error || !room) {
      console.error("Error creating room:", error);
      return NextResponse.json(
        { error: "Failed to create room." },
        { status: 500 }
      );
    }

    return NextResponse.json({ code: room.code, roomId: room.id });
  } catch (err) {
    console.error("Unexpected error in /api/rooms/create:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
