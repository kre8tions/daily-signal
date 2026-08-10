import { getPageData, getEditionForTimezone, getArchiveList, editionRank, FALLBACK_TIMEZONE } from "@/lib/stories";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { EditionView } from "@/components/EditionView";

export const dynamic = "force-dynamic";

async function getVisitorContext() {
  const headersList = await headers();
  const timezone = headersList.get("x-vercel-ip-timezone") ?? FALLBACK_TIMEZONE;
  const edition = getEditionForTimezone(timezone);
  // Date follows the EDITION, not the wall clock. Between midnight and 6am the current
  // edition is the previous day's Digest, so a wall-clock date would print tomorrow's
  // day above yesterday's content — the label/content mismatch fixed in 745e3c3.
  // Noon UTC + timeZone:"UTC" keeps the key's calendar date from drifting either way.
  const [datePart] = edition.key.split("_");
  const dateStr = new Date(`${datePart}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
  return { edition, dateStr };
}

export async function generateMetadata(): Promise<Metadata> {
  const { edition } = await getVisitorContext();
  const { stories, synthesis } = await getPageData(edition);
  const heroImage = stories[0]?.imageUrl;
  const title = synthesis?.theme ? `${synthesis.theme} — The Daily Signal` : "The Daily Signal";
  const description = synthesis?.observation ?? "AI-curated news — the front page, intelligently edited.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "The Daily Signal", ...(heroImage ? { images: [{ url: heroImage, width: 1200, height: 630, alt: title }] } : {}) },
    twitter: { card: heroImage ? "summary_large_image" : "summary", title, description, ...(heroImage ? { images: [heroImage] } : {}) },
  };
}

export default async function Home() {
  const { edition, dateStr } = await getVisitorContext();
  const { key: editionKey } = edition;
  const [{ stories, synthesis, editionLabel, featureCreature, weeklySignal }, archiveList] = await Promise.all([
    getPageData(edition),
    getArchiveList(),
  ]);
  const currentRank = editionRank(editionKey);
  // The requested slot may not be warmed yet — getPageData silently falls back to the
  // most recent available blob. Use the most recent archive entry at-or-before the
  // requested slot as the anchor for prevEdition, so we never point backwards to a
  // newer-than-displayed slot within the same day.
  const displayedKey = archiveList.find(e => editionRank(e.key) <= currentRank)?.key ?? editionKey;
  const prevEdition = archiveList.find(e => editionRank(e.key) < editionRank(displayedKey)) ?? null;

  return (
    <EditionView
      stories={stories}
      synthesis={synthesis}
      featureCreature={featureCreature}
      weeklySignal={weeklySignal}
      editionKey={editionKey}
      editionLabel={editionLabel}
      dateStr={dateStr}
      prevEdition={prevEdition}
    />
  );
}
