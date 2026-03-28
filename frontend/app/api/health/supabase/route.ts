import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** 연결 확인: Supabase에 단순 쿼리 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("teams").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
