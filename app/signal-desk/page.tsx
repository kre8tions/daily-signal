import { getPageData, getEdition, getWriterAssignments, getSynthWriterIndex, getFCWriterIndex, getArchiveList, getArchivedPageData, WRITERS, urlToSlug } from "@/lib/stories";
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

type StoryLike = { title: string; ownedTitle?: string; source: string; section: string; link: string };
type FCData = { title?: string; universe?: string; angleLabel?: string; editionKey?: string } | null | undefined;

function buildRows(stories: StoryLike[], editionKey: string, fc: FCData, synthTheme?: string) {
  const writerSlots = getWriterAssignments(editionKey);
  const storyRows = stories.map((s, i) => ({
    title: s.title, ownedTitle: s.ownedTitle ?? "", source: s.source, section: s.section,
    link: s.link, slug: urlToSlug(s.link), writerIdx: writerSlots[i] ?? 0, cardType: "story" as const,
  }));
  const synthRow = {
    title: synthTheme ?? "", ownedTitle: "", source: "", section: "Synthesis",
    link: "", slug: "", writerIdx: getSynthWriterIndex(editionKey), cardType: "synthesis" as const,
  };
  const fcRow = fc ? {
    title: fc.title ?? "", ownedTitle: fc.angleLabel ?? "", source: fc.universe ?? "", section: "Feature Creature",
    link: "", slug: fc.editionKey ? `/feature-creature/${fc.editionKey}` : "", writerIdx: getFCWriterIndex(editionKey), cardType: "fc" as const,
  } : null;
  return [synthRow, ...(fcRow ? [fcRow] : []), ...storyRows];
}

export default async function SignalDeskPage() {
  const { key: currentKey } = getEdition();
  const { stories: currentStories, synthesis: currentSynthesis, editionLabel, featureCreature: currentFC } = await getPageData();

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
      rows: buildRows(r.value.data.stories, r.value.key, r.value.data.featureCreature ?? null, r.value.data.synthesis?.theme),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));

  const allEditions = [
    { key: currentKey, label: editionLabel, theme: currentSynthesis?.theme ?? "", isCurrent: true, rows: buildRows(currentStories, currentKey, currentFC, currentSynthesis?.theme) },
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
