import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return new NextResponse("Não autorizado", { status: 401 });

  const { id } = await params;
  const result = await query<{ photo_data: Buffer | null; photo_mime: string | null }>(
    "SELECT photo_data, photo_mime FROM users WHERE id=$1 AND active=TRUE",
    [id]
  );
  const row = result.rows[0];
  if (!row?.photo_data || !row.photo_mime) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(row.photo_data), {
    status: 200,
    headers: {
      "Content-Type": row.photo_mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
