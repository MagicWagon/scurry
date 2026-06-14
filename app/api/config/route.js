import { NextResponse } from "next/server";
import { config } from "@/src/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    defaultSearchCategory: config.defaultSearchCategory
  });
}
