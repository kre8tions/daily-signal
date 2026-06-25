import { TrendItem } from "@/types";

export function TrendBar({ trends }: { trends: TrendItem[] }) {
  return (
    <div className="trend-bar">
      <span className="trend-label">TRENDING</span>
      {trends.map((t, i) => (
        <span key={i} className={`trend-pill trend-${t.direction}`}>
          {t.direction === "hot" ? "🔥" : t.direction === "up" ? "↑" : "↓"} {t.topic}
        </span>
      ))}
    </div>
  );
}
