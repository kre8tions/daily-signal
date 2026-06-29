import { getPageData, getEditionForTimezone, getArchiveList } from "@/lib/stories";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { EditionView } from "@/components/EditionView";

export const dynamic = "force-dynamic";

async function getLocalEdition() {
  const headersList = await headers();
  const timezone = headersList.get("x-vercel-ip-timezone") ?? "UTC";
  return getEditionForTimezone(timezone);
}

export async function generateMetadata(): Promise<Metadata> {
  const edition = await getLocalEdition();
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
  const edition = await getLocalEdition();
  const { key: editionKey } = edition;
  const [{ stories, synthesis, editionLabel, featureCreature }, archiveList] = await Promise.all([
    getPageData(edition),
    getArchiveList(),
  ]);
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const prevEdition = archiveList.find(e => e.key !== editionKey) ?? null;

  return (
    <EditionView
      stories={stories}
      synthesis={synthesis}
      featureCreature={featureCreature}
      editionKey={editionKey}
      editionLabel={editionLabel}
      dateStr={dateStr}
      prevEdition={prevEdition}
    />
  );
}
