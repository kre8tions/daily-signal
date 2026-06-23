import { GoogleTrend } from "@/types";

export function GoogleTrendsPanel({ trends }: { trends: GoogleTrend[] }) {
  if (!trends.length) return null;
  return (
    <aside className="google-trends-panel">
      <div className="gt-header">
        <span className="section-label">Trending Searches</span>
        <span className="gt-source">via Google Trends</span>
      </div>
      <ol className="gt-list">
        {trends.map((t) => (
          <li key={t.rank} className="gt-item">
            <span className="gt-rank">{t.rank}</span>
            <div className="gt-body">
              <a
                href={t.link ?? `https://trends.google.com/trends/explore?q=${encodeURIComponent(t.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gt-title"
              >
                {t.title}
              </a>
              {t.traffic && <span className="gt-traffic">{t.traffic} searches</span>}
              {t.relatedArticle && <p className="gt-related">{t.relatedArticle}</p>}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
