import { getPageData, getEdition } from "@/lib/stories";
import type { Metadata } from "next";
import { EditionView } from "@/components/EditionView";

export const revalidate = 14400;

export async function generateMetadata(): Promise<Metadata> {
  const { stories, synthesis } = await getPageData();
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
  const { stories, synthesis, editionLabel, featureCreature } = await getPageData();
  const { key: editionKey } = getEdition();
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <EditionView
      stories={stories}
      synthesis={synthesis}
      featureCreature={featureCreature}
      editionKey={editionKey}
      editionLabel={editionLabel}
      dateStr={dateStr}
    />
  );
}
