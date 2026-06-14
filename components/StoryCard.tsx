import { Story } from "@/types";

const SENTIMENT_LABELS: Record<Story["sentiment"], string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
  divided: "Divided",
};

export function StoryCard({ story, size = "normal" }: { story: Story; size?: "normal" | "mini" }) {
  return (
    <article className={`story-card story-card--${size}`}>
      <div className="section-label">{story.section}</div>
      <h3 className="story-title">
        <a href={story.link} target="_blank" rel="noopener noreferrer">
          {story.title}
        </a>
      </h3>
      {size === "normal" && story.aiSummary && <p className="story-summary">{story.aiSummary}</p>}
      <div className="story-meta">
        <span className="story-source">{story.source}</span>
        <span className={`sentiment sentiment--${story.sentiment}`}>
          {SENTIMENT_LABELS[story.sentiment]}
        </span>
      </div>
    </article>
  );
}
