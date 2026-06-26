import { NextResponse } from "next/server";
import { getPageData, getFullArticle, getFeatureCreature, getEdition, saveToArchive } from "@/lib/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const { key: editionKey, label: editionLabel } = getEdition();
  const results: Record<string, "cached" | "generated" | "failed"> = {};

  // Load page data (stories + synthesis)
  const { stories, synthesis } = await getPageData();

  // Check synthesis health
  results["synthesis"] = synthesis.actions?.length > 0 && synthesis.theme ? "cached" : "failed";

  // Ensure this edition is in the archive index
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

  // Warm Feature Creature
  try {
    const fc = await getFeatureCreature(editionKey);
    results["feature-creature"] = fc ? "cached" : "failed";
  } catch {
    results["feature-creature"] = "failed";
  }

  // Warm all article commentaries in parallel
  const related = stories.slice(1);
  await Promise.allSettled(
    stories.map(async (story, i) => {
      const key = `article-${i}-${story.link.slice(-30)}`;
      try {
        const commentary = await getFullArticle(story, related, editionKey);
        results[key] = commentary.body ? "cached" : "failed";
      } catch {
        results[key] = "failed";
      }
    })
  );

  const failed = Object.entries(results).filter(([, v]) => v === "failed").map(([k]) => k);
  return NextResponse.json({ editionKey, at: new Date().toISOString(), results, failed, ok: failed.length === 0 });
}
