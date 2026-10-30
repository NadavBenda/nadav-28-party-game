import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true });
  return NextResponse.json({ ok: true, rooms: count ?? 0 });
}
