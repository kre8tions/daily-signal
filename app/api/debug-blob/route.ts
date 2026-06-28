import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { getEdition } from "@/lib/stories";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = getEdition();
  const checks: Record<string, string> = {};

  const blobs = [
    `archive/editions/${key}.json`,
    `synthesis/v1/${key}.json`,
    `feature-creature/v20/${key}.json`,
  ];

  for (const b of blobs) {
    try {
      const info = await head(b);
      checks[b] = info ? `EXISTS (${info.size} bytes, uploaded ${info.uploadedAt})` : "NOT FOUND";
    } catch {
      checks[b] = "NOT FOUND";
    }
  }

  // Fetch actual content of archive blob
  let archiveContent: unknown = null;
  try {
    const info = await head(`archive/editions/${key}.json`);
    if (info) {
      const res = await fetch(info.url);
      const data = await res.json() as { stories?: unknown[]; synthesis?: { theme?: string } };
      archiveContent = {
        storyCount: Array.isArray(data.stories) ? data.stories.length : "n/a",
        firstTitle: Array.isArray(data.stories) && data.stories.length > 0 ? (data.stories[0] as { title?: string }).title : null,
        theme: data.synthesis?.theme ?? null,
      };
    }
  } catch { archiveContent = "fetch failed"; }

  return NextResponse.json({ editionKey: key, blobs: checks, archiveContent });
}
