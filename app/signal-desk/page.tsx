import { getPageData, getEdition, getWriterAssignments, getArchiveList, getArchivedPageData, WRITERS, urlToSlug, type Story } from "@/lib/stories";
import { P } from "@/lib/palette";
import { DeskClient } from "./DeskClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SignalDeskPage() {
  const { key: currentKey } = getEdition();
  const { stories: currentStories, synthesis: currentSynthesis, editionLabel } = await getPageData();

  // Load archive list then fetch all edition JSONs in parallel
  const archiveList = await getArchiveList();
  const archivedKeys = archiveList.map(e => e.key).filter(k => k !== currentKey);

  const results = await Promise.allSettled(
    archivedKeys.map(key => getArchivedPageData(key).then(data => ({ key, data })))
  );

  const archivedEditions = results
    .filter((r): r is PromiseFulfilledResult<{ key: string; data: NonNullable<Awaited<ReturnType<typeof getArchivedPageData>>> }> =>
      r.status === "fulfilled" && r.value.data !== null
    )
    .map(r => ({
      key: r.value.key,
      label: r.value.data.editionLabel ?? r.value.key,
      theme: r.value.data.synthesis?.theme ?? "",
      stories: r.value.data.stories,
      isCurrent: false,
    }))
    .sort((a, b) => b.key.localeCompare(a.key));

  const allEditions = [
    { key: currentKey, label: editionLabel, theme: currentSynthesis?.theme ?? "", stories: currentStories, isCurrent: true },
    ...archivedEditions,
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
      writers={WRITERS.map((w, i) => ({
        id: i,
        name: w.name,
        inspiration: writerInspiration[w.name] ?? "",
        personality: writerShortStyle[w.name] ?? "",
      }))}
      getWriterAssignments={getWriterAssignments}
      urlToSlug={urlToSlug}
      palette={{ pageBg: P.articleBg, cardBg: P.cardBg, ink: P.ink, inkMid: P.inkMid, inkLight: P.inkLight, accent: P.accent, tint: P.tint, fontBody: P.fontBody, fontHeading: P.fontHeading }}
    />
  );
}
