import { GoogleTrend } from "@/types";

export function MostSearched({ trends }: { trends: GoogleTrend[] }) {
  if (!trends.length) return (
    <aside className="most-searched">
      <div className="most-searched-header">Most Searched</div>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--ink-light)", padding: "12px 0" }}>
        Trending searches unavailable — check back shortly.
      </p>
    </aside>
  );
  return (
    <aside className="most-searched">
      <div className="most-searched-header">Most Searched</div>
      {trends.slice(0, 8).map((t) => (
        <a
          key={t.rank}
          href={t.link ?? `https://trends.google.com/trends/explore?q=${encodeURIComponent(t.title)}&geo=US`}
          target="_blank"
          rel="noopener noreferrer"
          className="ms-item"
        >
          <span className="ms-rank">{t.rank}</span>
          <div className="ms-body">
            <div className="ms-title">{t.title}</div>
            {t.traffic && <div className="ms-traffic">{t.traffic} searches</div>}
            {t.relatedArticle && <div className="ms-related">{t.relatedArticle}</div>}
          </div>
        </a>
      ))}
    </aside>
  );
}
