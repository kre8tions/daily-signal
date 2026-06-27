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
    const TIME_LABELS: Record<string, string> = {
      early: "Early Edition", morning: "Morning Edition", afternoon: "Afternoon Edition",
      evening: "Evening Edition", night: "Night Edition",
    };
    const entries = editionBlobs.map(blob => {
      const key = blob.pathname.replace("archive/editions/", "").replace(".json", "");
      const parts = key.split("_");
      const date = parts[0] ?? key;
      const slot = parts[1] ?? "";
      const label = TIME_LABELS[slot] ?? key;
      return { key, label, date, theme: "", imageUrl: undefined as string | undefined };
    }).sort((a, b) => b.key.localeCompare(a.key));
    await put("archive/index.json", JSON.stringify(entries), { access: "public", contentType: "application/json", addRandomSuffix: false });
    rebuiltCount = entries.length;
  }

  return NextResponse.json({
    editionBlobs: editionBlobs.map(b => ({ path: b.pathname, size: b.size, uploaded: b.uploadedAt })),
    photoCount: photoBlobs.length,
    indexEntries: Array.isArray(indexData) ? indexData.map((e: { key: string; label: string }) => ({ key: e.key, label: e.label })) : indexData,
    ...(rebuild ? { rebuiltCount } : {}),
  });
}
