import { NextRequest, NextResponse } from "next/server";
import { del, head } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const { date } = await req.json().catch(() => ({}));
  const target = date ?? new Date().toISOString().slice(0, 10);
  const blobKey = `weekly-signal/v1/${target}.json`;

  try {
    const existing = await head(blobKey);
    if (existing) {
      await del(blobKey);
      return NextResponse.json({ ok: true, deleted: blobKey });
    }
    return NextResponse.json({ ok: true, note: "blob not found", key: blobKey });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
