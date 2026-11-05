import { NextResponse } from "next/server";
import { bg01 } from "./bg-01";
import { bg02 } from "./bg-02";
import { bg03 } from "./bg-03";
import { bg04 } from "./bg-04";
import { bg05 } from "./bg-05";
import { bg06 } from "./bg-06";
import { bg07 } from "./bg-07";
import { bg08 } from "./bg-08";
import { bg09 } from "./bg-09";

const LOGIN_ART_BASE64 = [
  bg01,bg02,bg03,bg04,bg05,bg06,bg07,bg08,bg09,
].join("");

export async function GET() {
  const bytes = Buffer.from(LOGIN_ART_BASE64, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
