import { NextResponse } from "next/server";
import { list, head, put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blobs: editionBlobs } = await list({ prefix: "archive/editions/", limit: 100 });
  const { blobs: photoBlobs } = await list({ prefix: "archive/photos/", limit: 100 });

  let indexData = null;
  try {
    const idx = await head("archive/index.json");
    if (idx) {
      const res = await fetch(idx.url + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) indexData = await res.json();
    }
  } catch { /* ok */ }

  // Rebuild index from blobs if rebuild=1 param is present
  const rebuild = new URL(req.url).searchParams.get("rebuild") === "1";
  let rebuiltCount = 0;
  if (rebuild) {
    try {
      await put("archive/test-ping.json", JSON.stringify({ ok: true, t: Date.now() }), { access: "public", contentType: "application/json", addRandomSuffix: false });
      rebuiltCount = 1;
    } catch (e) {
      return NextResponse.json({ putError: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({
    editionBlobs: editionBlobs.map(b => ({ path: b.pathname, size: b.size, uploaded: b.uploadedAt })),
    photoCount: photoBlobs.length,
    indexEntries: Array.isArray(indexData) ? indexData.map((e: { key: string; label: string }) => ({ key: e.key, label: e.label })) : indexData,
    ...(rebuild ? { rebuiltCount } : {}),
  });
}
