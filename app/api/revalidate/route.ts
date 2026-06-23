import { NextResponse } from "next/server";
import { cacheClearAll } from "@/lib/cache";

export async function GET() {
  const count = cacheClearAll(); // no prefix = nuke everything
  return NextResponse.json({ cleared: true, filesRemoved: count, at: new Date().toISOString() });
}
