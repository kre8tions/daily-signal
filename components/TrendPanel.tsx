import { TrendItem } from "@/types";

export function TrendPanel({ trends }: { trends: TrendItem[] }) {
  return (
    <aside className="trend-panel">
      <div className="section-label">Trend Watch</div>
      {trends.map((t, i) => (
        <div key={i} className="trend-item">
          <span className="trend-rank">{i + 1}</span>
          <div className="trend-body">
            <div className="trend-topic">{t.topic}</div>
            <div className={`trend-change trend-change--${t.direction}`}>{t.changeLabel}</div>
            <div className="trend-reason">{t.reason}</div>
          </div>
        </div>
      ))}
    </aside>
  );
}
