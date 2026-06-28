import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blobs } = await list({ prefix: "archive/editions/", limit: 100 });
  const pairs: { edition: string; section: string; original: string; owned: string }[] = [];

  await Promise.all(
    blobs.map(async (blob) => {
      const edition = blob.pathname.replace("archive/editions/", "").replace(".json", "");
      try {
        const res = await fetch(blob.url, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { stories?: { title?: string; ownedTitle?: string; section?: string }[] };
        for (const s of data.stories ?? []) {
          if (s.title && s.ownedTitle) {
            pairs.push({ edition, section: s.section ?? "", original: s.title, owned: s.ownedTitle });
          }
        }
      } catch { /* skip */ }
    })
  );

  pairs.sort((a, b) => a.edition.localeCompare(b.edition));
  return NextResponse.json({ count: pairs.length, pairs });
}
