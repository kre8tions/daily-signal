import { getPageData, getEdition, getWriterAssignments, getArchiveList, WRITERS, urlToSlug, type Story, type PageData } from "@/lib/stories";
import { P } from "@/lib/palette";
import { DeskClient } from "./DeskClient";
import { head } from "@vercel/blob";

export const dynamic = "force-dynamic";

async function loadEditionData(key: string): Promise<PageData | null> {
  try {
    const meta = await head(`archive/editions/${key}.json`);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as PageData;
  } catch { return null; }
}

export default async function SignalDeskPage() {
  const { key: currentKey } = getEdition();
  const { stories: currentStories, synthesis: currentSynthesis, editionLabel } = await getPageData();

  // Load all archived editions
  const archiveList = await getArchiveList();
  const archivedKeys = archiveList.map(e => e.key).filter(k => k !== currentKey);

  const archivedEditions: { key: string; label: string; theme: string; stories: Story[] }[] = [];
  for (const key of archivedKeys) {
    const data = await loadEditionData(key);
    if (data?.stories?.length) {
      archivedEditions.push({ key, label: data.editionLabel ?? key, theme: data.synthesis?.theme ?? "", stories: data.stories });
    }
  }

  // Latest first
  archivedEditions.sort((a, b) => b.key.localeCompare(a.key));

  const allEditions = [
    { key: currentKey, label: editionLabel, theme: currentSynthesis?.theme ?? "", stories: currentStories, isCurrent: true },
    ...archivedEditions.map(e => ({ ...e, isCurrent: false })),
  ];

  const writerShortStyle: Record<string, string> = {
    "Rex":   "Prosecutorial contrarian — verdicts, not opinions",
    "Eric":  "Plain language moralist — shows, never preaches",
    "Margot":"Cool observer — dread underneath the detail",
    "Finn":  "Narrative thriller — follow the incentive chain",
    "Cal":   "Counter-intuitive — starts wrong, lands right",
    "Jack":  "Sardonic equal-opportunity mocker",
    "Ward":  "Status-game anthropologist — reads the room",
  };

  const writerInspiration: Record<string, string> = {
    "Rex":   "Christopher Hitchens",
    "Eric":  "George Orwell",
    "Margot":"Joan Didion",
    "Finn":  "Michael Lewis",
    "Cal":   "Malcolm Gladwell",
    "Jack":  "P.J. O'Rourke",
    "Ward":  "Tom Wolfe",
  };

  return (
    <DeskClient
      allEditions={allEditions}
      writers={WRITERS.map((w, i) => ({ id: i, name: w.name, personality: writerShortStyle[w.name] ?? "", inspiration: writerInspiration[w.name] ?? "" }))}
      getWriterAssignments={getWriterAssignments}
      urlToSlug={urlToSlug}
      palette={{ pageBg: P.articleBg, cardBg: P.cardBg, ink: P.ink, inkMid: P.inkMid, inkLight: P.inkLight, accent: P.accent, tint: P.tint, fontBody: P.fontBody, fontHeading: P.fontHeading }}
    />
  );
}
