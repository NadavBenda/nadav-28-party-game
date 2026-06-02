import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Replace all prompts for a room (host only, verified by PIN)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { pin, prompts } = body;

    if (!pin || !Array.isArray(prompts) || prompts.length === 0) {
      return NextResponse.json({ error: "PIN and prompts are required." }, { status: 400 });
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
    if (room.state !== "lobby") {
      return NextResponse.json({ error: "Cannot import prompts once game has started." }, { status: 400 });
    }

    const cleanPrompts = (prompts as unknown[])
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 100); // cap at 100

    if (!cleanPrompts.length) {
      return NextResponse.json({ error: "No valid prompts." }, { status: 400 });
    }

    // Delete existing prompts, then insert fresh ones
    await supabase.from("prompts").delete().eq("room_id", room.id);

    const rows = cleanPrompts.map((text, i) => ({
      room_id: room.id,
      text,
      order_index: i,
      used: false,
    }));

    const { error: insertErr } = await supabase.from("prompts").insert(rows);
    if (insertErr) {
      console.error("Prompt insert error:", insertErr);
      return NextResponse.json({ error: "Failed to save prompts." }, { status: 500 });
    }

    return NextResponse.json({ count: cleanPrompts.length });
  } catch (err) {
    console.error("Unexpected error in /api/rooms/[code]/host/prompts:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
