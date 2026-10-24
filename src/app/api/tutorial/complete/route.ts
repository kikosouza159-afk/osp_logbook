import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok:false }, { status:401 });

  if (user.role === "ANALYST" && !user.tutorial_completed) {
    await query(
      "UPDATE users SET tutorial_completed=TRUE, updated_at=NOW() WHERE id=$1",
      [user.id]
    );
    await audit(user.id, "COMPLETE_FIRST_ACCESS_TUTORIAL", "user", user.id);
  }

  return NextResponse.json({ ok:true });
}
