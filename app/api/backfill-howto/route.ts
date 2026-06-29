import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getArchiveList, generateHowTo, actionSlug } from "@/lib/stories";
import { head } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Synthesis {
  theme?: string;
  hook?: string;
  actions?: string[];
}

async function runBackfill() {
  const editions = await getArchiveList();
  let generated = 0;
  let skipped = 0;

  for (const edition of editions) {
    // Load synthesis blob for this edition
    let synthesis: Synthesis | null = null;
    try {
      const blob = await head(`synthesis/v1/${edition.key}.json`);
      if (blob) {
        const res = await fetch(blob.url);
        if (res.ok) synthesis = await res.json() as Synthesis;
      }
    } catch { /* no synthesis blob */ }

    if (!synthesis?.actions?.length) { skipped++; continue; }

    const context = { theme: synthesis.theme, hook: synthesis.hook };

    for (const action of synthesis.actions) {
      const slug = actionSlug(action);
      // Skip if blob already exists
      try {
        await head(`howto/${slug}.json`);
        continue; // exists, skip
      } catch { /* not found, generate */ }

      await generateHowTo(action, slug, context);
      generated++;
      await new Promise(r => setTimeout(r, 500)); // rate limit buffer
    }
  }

  console.log(`[backfill-howto] done — ${generated} generated, ${skipped} editions skipped (no synthesis)`);
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  waitUntil(runBackfill());
  return NextResponse.json({ accepted: true, at: new Date().toISOString() }, { status: 202 });
}
