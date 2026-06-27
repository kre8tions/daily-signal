import { getArchivedPageData, getArchiveList } from "@/lib/stories";
import { EditionView } from "@/components/EditionView";

export const dynamic = "force-dynamic";

export default async function ArchiveEditionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  const [data, archiveList] = await Promise.all([
    getArchivedPageData(key),
    getArchiveList(),
  ]);

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#1a1225", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 32 }}>👾</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Edition not available</div>
        <div style={{ fontSize: 14, opacity: 0.6 }}>This edition was archived before persistent storage was set up.</div>
        <a href="/archive" style={{ marginTop: 8, fontSize: 13, color: "#FAED26", textDecoration: "none" }}>← Back to Archive</a>
      </div>
    );
  }

  const { stories, synthesis, editionLabel, featureCreature } = data;
  const [datePart] = key.split("_");
  const dateStr = new Date(datePart + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Sorted newest-first — prev = older (higher index), next = newer (lower index)
  const idx = archiveList.findIndex(e => e.key === key);
  const prevEdition = idx >= 0 && idx < archiveList.length - 1 ? archiveList[idx + 1] : null;
  const nextEdition = idx > 0 ? archiveList[idx - 1] : null;

  return (
    <EditionView
      stories={stories}
      synthesis={synthesis}
      featureCreature={featureCreature}
      editionKey={key}
      editionLabel={editionLabel}
      dateStr={dateStr}
      isArchive
      prevEdition={prevEdition}
      nextEdition={nextEdition}
    />
  );
}
