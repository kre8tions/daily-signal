import { getPageData, getEdition, getWriterAssignments, getArchiveList, getArchivedPageData, WRITERS, urlToSlug } from "@/lib/stories";
import { P } from "@/lib/palette";
import { DeskClient } from "./DeskClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WRITER_STYLE: Record<string, string> = {
  Rex:    "Prosecutorial contrarian — verdicts, not opinions",
  Eric:   "Plain language moralist — shows, never preaches",
  Margot: "Cool observer — dread underneath the detail",
  Finn:   "Narrative thriller — follow the incentive chain",
  Cal:    "Counter-intuitive — starts wrong, lands right",
  Jack:   "Sardonic equal-opportunity mocker",
  Ward:   "Status-game anthropologist — reads the room",
};
const WRITER_INSPIRATION: Record<string, string> = {
  Rex:    "Christopher Hitchens",
  Eric:   "George Orwell",
  Margot: "Joan Didion",
  Finn:   "Michael Lewis",
  Cal:    "Malcolm Gladwell",
  Jack:   "P.J. O'Rourke",
  Ward:   "Tom Wolfe",
};

const writers = WRITERS.map((w, i) => ({
  id: i, name: w.name,
  inspiration: WRITER_INSPIRATION[w.name] ?? "",
  personality: WRITER_STYLE[w.name] ?? "",
}));

export default async function SignalDeskPage() {
  const { key: currentKey } = getEdition();
  const { stories: currentStories, synthesis: currentSynthesis, editionLabel } = await getPageData();

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
      isCurrent: false,
      rows: r.value.data.stories.map((s, i) => {
        const writerSlots = getWriterAssignments(r.value.key);
        const wi = writerSlots[i] ?? 0;
        return { title: s.title, ownedTitle: s.ownedTitle ?? "", source: s.source, section: s.section, link: s.link, slug: urlToSlug(s.link), writerIdx: wi };
      }),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));

  const currentRows = currentStories.map((s, i) => {
    const writerSlots = getWriterAssignments(currentKey);
    const wi = writerSlots[i] ?? 0;
    return { title: s.title, ownedTitle: s.ownedTitle ?? "", source: s.source, section: s.section, link: s.link, slug: urlToSlug(s.link), writerIdx: wi };
  });

  const allEditions = [
    { key: currentKey, label: editionLabel, theme: currentSynthesis?.theme ?? "", isCurrent: true, rows: currentRows },
    ...archivedEditions,
  ];

  return (
    <DeskClient
      allEditions={allEditions}
      writers={writers}
      palette={{ pageBg: P.articleBg, cardBg: P.cardBg, ink: P.ink, inkMid: P.inkMid, inkLight: P.inkLight, accent: P.accent, tint: P.tint, fontBody: P.fontBody, fontHeading: P.fontHeading }}
    />
  );
}
