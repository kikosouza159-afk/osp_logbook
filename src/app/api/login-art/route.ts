import { NextResponse } from "next/server";
import { christmasLoginArt } from "./christmas-art";

export async function GET() {
  const bytes = Buffer.from(christmasLoginArt, "base64");

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
