import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ status: "ok", database: "connected", service: "osp-logbook" });
  } catch {
    return NextResponse.json({ status: "degraded", database: "disconnected", service: "osp-logbook" }, { status: 503 });
  }
}
