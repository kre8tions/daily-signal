import { Edition } from "@/types";
import { TrendBar } from "@/components/TrendBar";
import { HeroStory } from "@/components/HeroStory";
import { StoryCard } from "@/components/StoryCard";
import { TrendPanel } from "@/components/TrendPanel";

async function getEdition(): Promise<Edition | null> {
  try {
    // In production this hits the API route; in dev same server
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/news`, {
      next: { revalidate: 1800 }, // ISR: rebuild at most every 30 min
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function Home() {
  const edition = await getEdition();

  if (!edition) {
    return (
      <div className="page-container">
        <Masthead date="Today" />
        <div className="error">Failed to load today's edition. Please try again shortly.</div>
      </div>
    );
  }

  const sectionEntries = Object.entries(edition.sections);

  return (
    <>
      <div className="page-container">
        <Masthead date={edition.date} cachedUntil={edition.cachedUntil} />
      </div>

      <TrendBar trends={edition.trends} />

      <div className="page-container">
        <div className="main-grid">
          <div className="content-col">
            <HeroStory story={edition.hero} />
          </div>
          <div className="sidebar-col">
            {edition.topStories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
            {edition.trends.length > 0 && <TrendPanel trends={edition.trends} />}
          </div>
        </div>

        {sectionEntries.length > 0 && (
          <div className="bottom-grid">
            {sectionEntries.slice(0, 3).map(([section, stories]) =>
              stories[0] ? (
                <StoryCard key={section} story={{ ...stories[0], section }} size="mini" />
              ) : null
            )}
          </div>
        )}

        <footer className="footer">
          <span>The Daily Signal · AI-Curated Edition</span>
          <span>Next refresh: {formatRefresh(edition.cachedUntil)}</span>
        </footer>
      </div>
    </>
  );
}

function Masthead({ date, cachedUntil }: { date: string; cachedUntil?: string }) {
  return (
    <header className="masthead">
      <h1>The Daily Signal</h1>
      <div className="masthead-meta">
        <span>{date}</span>
        <span>AI-Curated · Real-Time Trends</span>
        {cachedUntil && <span>Updated {formatRefresh(cachedUntil)}</span>}
      </div>
    </header>
  );
}

function formatRefresh(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}
