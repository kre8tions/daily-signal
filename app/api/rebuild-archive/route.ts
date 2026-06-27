import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blobs } = await list({ prefix: "archive/editions/", limit: 100 });

  const entries: { key: string; label: string; date: string; theme: string; imageUrl?: string }[] = [];

  for (const blob of blobs) {
    const key = blob.pathname.replace("archive/editions/", "").replace(".json", "");
    const date = key.split("_")[0] ?? key;
    try {
      const res = await fetch(blob.url + "?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      entries.push({
        key,
        label: data.editionLabel ?? key,
        date,
        theme: data.synthesis?.theme ?? "",
        imageUrl: data.stories?.[0]?.imageUrl,
      });
    } catch { /* skip */ }
  }

  entries.sort((a, b) => b.key.localeCompare(a.key));

  await put("archive/index.json", JSON.stringify(entries), {
    access: "public", contentType: "application/json", addRandomSuffix: false,
  });

  return NextResponse.json({ rebuilt: entries.length, keys: entries.map(e => e.key) });
}
