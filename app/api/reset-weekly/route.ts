import { NextRequest, NextResponse } from "next/server";
import { del, list } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  const blobKey = `weekly-signal/v1/${date}.json`;

  try {
    const { blobs } = await list({ prefix: `weekly-signal/v1/${date}` });
    if (blobs.length === 0) {
      return NextResponse.json({ ok: true, note: "blob not found", key: blobKey });
    }
    await del(blobs.map(b => b.url));
    return NextResponse.json({ ok: true, deleted: blobs.map(b => b.pathname) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
