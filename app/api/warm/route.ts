import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { revalidateTag } from "next/cache";
import { buildPageData, getEdition } from "@/lib/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runWarm(editionKey: string, editionLabel: string) {
  try {
    const pageData = await buildPageData(editionKey, editionLabel);
    const failed = pageData.stories.filter(s => !s.summary);
    if (failed.length > 0) {
      failed.forEach(s => console.error(`[warm] missing summary: "${s.title}" — ${s.generationError ?? "no error captured"}`));
    }
    console.log(`[warm] ${editionKey} done — ${failed.length} stories missing summary, FC: ${!!pageData.featureCreature}, theme: "${pageData.synthesis.theme}"`);
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
