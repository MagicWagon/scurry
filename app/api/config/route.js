import { NextResponse } from "next/server";
import { readSettings } from "@/src/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { search } = readSettings();
  return NextResponse.json({
    defaultSearchCategory: search.defaultCategory,
    preferEpubOnly: search.preferEpubOnly,
    preferM4b: search.preferM4b,
  });
}
