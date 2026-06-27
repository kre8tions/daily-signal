import { NextResponse } from "next/server";
import { list, put, head } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blobs } = await list({ prefix: "archive/editions/", limit: 100 });

  const entries = await Promise.all(
    blobs.map(async (blob) => {
      const key = blob.pathname.replace("archive/editions/", "").replace(".json", "");
      const parts = key.split("_");
      const date = parts[0] ?? key;
      try {
        const res = await fetch(blob.url + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        let imageUrl = data.stories?.[0]?.imageUrl;
        try { const p = await head(`archive/photos/${key}.jpg`); if (p) imageUrl = p.url; } catch { /* ok */ }
        return { key, label: data.editionLabel ?? key, date, theme: data.synthesis?.theme ?? "", imageUrl };
      } catch { return null; }
    })
  );

  const sorted = entries.filter(Boolean).sort((a, b) => b!.key.localeCompare(a!.key));

  await put("archive/index.json", JSON.stringify(sorted), {
    access: "public", contentType: "application/json", addRandomSuffix: false,
  });

  return NextResponse.json({ rebuilt: sorted.length, keys: sorted.map(e => e!.key) });
}
