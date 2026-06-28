import { NextResponse } from "next/server";
import { buildPageData, getEdition } from "@/lib/stories";
import { put } from "@vercel/blob";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: editionKey, label: editionLabel } = getEdition();

  try {
    const pageData = await buildPageData(editionKey, editionLabel);
    const blobResult = await put(`archive/editions/${editionKey}.json`, JSON.stringify(pageData), {
      access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
    });
    revalidateTag(`edition-${editionKey}`);
    return NextResponse.json({
      ok: true,
      editionKey,
      storyCount: pageData.stories.length,
      storiesWithSummary: pageData.stories.filter(s => s.summary).length,
      theme: pageData.synthesis.theme,
      hasFC: !!pageData.featureCreature,
      blobUrl: blobResult.url,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
