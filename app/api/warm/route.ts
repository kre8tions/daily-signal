import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { buildPageData, getEdition, clearEditionCache } from "@/lib/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const editionParam = url.searchParams.get("edition");
  const EDITION_LABELS: Record<string, string> = {
    early: "First Light", morning: "The Brief", afternoon: "Midday",
    evening: "The Digest", night: "Night Dispatch",
  };
  const { key: currentKey, label: currentLabel } = getEdition();
  const editionKey = editionParam ?? currentKey;
  const editionLabel = editionParam
    ? (EDITION_LABELS[editionParam.split("_")[1] ?? ""] ?? editionParam)
    : currentLabel;
  const startedAt = new Date().toISOString();

  try {
    await clearEditionCache(editionKey);
    const pageData = await buildPageData(editionKey, editionLabel);
    revalidateTag(`edition-${editionKey}`);

    const ok = pageData.stories.filter(s => s.summary).map(s => s.ownedTitle || s.title);
    const failed = pageData.stories
      .filter(s => !s.summary)
      .map(s => ({ title: s.title, error: s.generationError ?? "no error captured" }));

    if (failed.length > 0) {
      failed.forEach(f => console.error(`[warm] missing summary: "${f.title}" — ${f.error}`));
    }
    // The insight failing is easy to miss: the edition still renders, it just leads with an
    // RSS story instead of the column. Report it explicitly rather than leaving it to be
    // spotted on the front page.
    const insight = pageData.stories[0]?.section === "Insight"
      ? { ok: true as const, title: pageData.stories[0].ownedTitle ?? pageData.stories[0].title }
      : { ok: false as const, error: pageData.insightError ?? "unknown", promoted: pageData.stories[0]?.ownedTitle ?? pageData.stories[0]?.title ?? null };
    if (!insight.ok) console.error(`[warm] ${editionKey} NO INSIGHT — ${insight.error}`);
    console.log(`[warm] ${editionKey} done — ${failed.length} failed, insight: ${insight.ok}, FC: ${!!pageData.featureCreature}, theme: "${pageData.synthesis.theme}"`);

    return NextResponse.json({
      editionKey,
      theme: pageData.synthesis.theme,
      insight,
      fc: pageData.featureCreature?.universe ?? null,
      startedAt,
      completedAt: new Date().toISOString(),
      ok,
      failed,
    });
  } catch (e) {
    console.error(`[warm] ${editionKey} FAILED`, e);
    return NextResponse.json({ editionKey, startedAt, error: String(e) }, { status: 500 });
  }
}
