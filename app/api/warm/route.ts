import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getPageData, getFullArticle, getFeatureCreature, getEdition, saveToArchive, getWriterAssignments } from "@/lib/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function runWarm(editionKey: string, editionLabel: string) {
  const results: Record<string, "cached" | "generated" | "failed"> = {};

  const { stories, synthesis } = await getPageData();
  results["synthesis"] = synthesis.actions?.length > 0 && synthesis.theme ? "cached" : "failed";

  try {
    await saveToArchive({
      key: editionKey,
      label: editionLabel,
      date: editionKey.split("_")[0],
      theme: synthesis.theme,
      imageUrl: stories[0]?.imageUrl,
    });
    results["archive"] = "generated";
  } catch {
    results["archive"] = "failed";
  }

  try {
    const fc = await getFeatureCreature(editionKey);
    results["feature-creature"] = fc ? "cached" : "failed";
  } catch {
    results["feature-creature"] = "failed";
  }

  const related = stories.slice(1);
  const writerSlots = getWriterAssignments(editionKey);
  await Promise.allSettled(
    stories.map(async (story, i) => {
      const key = `article-${i}-${story.link.slice(-30)}`;
      try {
        const commentary = await getFullArticle(story, related, editionKey, writerSlots[i]);
        results[key] = commentary.body ? "cached" : "failed";
      } catch (e) {
        console.error(`[warm] failed: ${key}`, e);
        results[key] = "failed";
      }
    })
  );

  const failed = Object.entries(results).filter(([, v]) => v === "failed").map(([k]) => k);
  console.log(`[warm] ${editionKey} done — ${failed.length} failed`, results);
}

export async function GET() {
  const { key: editionKey, label: editionLabel } = getEdition();
  // Respond immediately so external crons (30s timeout) don't time out
  waitUntil(runWarm(editionKey, editionLabel));
  return NextResponse.json({ accepted: true, editionKey, at: new Date().toISOString() }, { status: 202 });
}
