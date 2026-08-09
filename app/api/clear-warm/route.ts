import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { revalidateTag } from "next/cache";
import { buildPageData, getEdition } from "@/lib/stories";
import { list, del } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function clearAndWarm(editionKey: string, editionLabel: string) {
  try {
    // Delete all blobs for this edition
    const prefixes = [
      `articles/${editionKey}/`,
      `synthesis/v1/${editionKey}`,
      `feature-creature/v20/${editionKey}`,
      `archive/editions/${editionKey}`,
    ];

    for (const prefix of prefixes) {
      const { blobs } = await list({ prefix });
      if (blobs.length) await del(blobs.map(b => b.url));
    }

    console.log(`[clear-warm] blobs cleared for ${editionKey}`);
    await buildPageData(editionKey, editionLabel);
    revalidateTag(`edition-${editionKey}`);
    console.log(`[clear-warm] ${editionKey} rebuilt`);
  } catch (e) {
    console.error(`[clear-warm] ${editionKey} FAILED`, e);
  }
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { key: editionKey, label: editionLabel } = getEdition();
  waitUntil(clearAndWarm(editionKey, editionLabel));
  return NextResponse.json({ accepted: true, editionKey, at: new Date().toISOString() }, { status: 202 });
}
