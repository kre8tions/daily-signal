import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { revalidateTag } from "next/cache";
import { buildPageData, getEdition } from "@/lib/stories";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runWarm(editionKey: string, editionLabel: string) {
  try {
    const pageData = await buildPageData(editionKey, editionLabel);
    // buildPageData's archive put() is fire-and-forget — await it explicitly here
    await put(`archive/editions/${editionKey}.json`, JSON.stringify(pageData), {
      access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
    });
    const failed = pageData.stories.filter(s => !s.summary).length;
    console.log(`[warm] ${editionKey} done — ${failed} stories missing summary, FC: ${!!pageData.featureCreature}, theme: "${pageData.synthesis.theme}"`);
    revalidateTag(`edition-${editionKey}`);
  } catch (e) {
    console.error(`[warm] ${editionKey} FAILED`, e);
  }
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { key: editionKey, label: editionLabel } = getEdition();
  waitUntil(runWarm(editionKey, editionLabel));
  return NextResponse.json({ accepted: true, editionKey, at: new Date().toISOString() }, { status: 202 });
}
