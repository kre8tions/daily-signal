import { NextRequest, NextResponse } from "next/server";
import { buildPageData, labelFromKey } from "@/lib/stories";

export async function POST(req: NextRequest) {
  const { key } = await req.json().catch(() => ({}));
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const label = labelFromKey(key);
  const pageData = await buildPageData(key, label);
  return NextResponse.json({ ok: true, key, stories: pageData.stories.length, hasWeeklySignal: !!pageData.weeklySignal });
}
