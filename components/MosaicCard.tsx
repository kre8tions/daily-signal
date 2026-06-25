import Image from "next/image";
import { Story } from "@/types";

type Variant = "hero" | "stacked" | "secondary" | "ribbon";

const SENTIMENT_LABELS: Record<Story["sentiment"], string> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
  divided: "Divided",
};

export function MosaicCard({ story, variant }: { story: Story; variant: Variant }) {
  return (
    <a href={`/article/${story.id}`} className={`mc mc--${variant}`}>
      <div className="mc-img">
        {story.imageUrl ? (
          <Image
            src={story.imageUrl}
            alt={story.title}
            fill
            sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
            style={{ objectFit: "cover" }}
            unoptimized
          />
        ) : (
          <div className="mc-img-placeholder" />
        )}
      </div>
      <div className="mc-body">
        {variant === "hero" && <span className="ai-badge">AI CURATED</span>}
        <div className="mc-section">{story.section}</div>
        <span className="mc-title">{story.title}</span>
        {(variant === "hero" || variant === "secondary") && story.aiSummary && (
          <>
            {variant === "hero" ? (
              <div className="mc-ai-summary">
                <strong>AI Summary — </strong>{story.aiSummary}
              </div>
            ) : (
              <p className="mc-summary">{story.aiSummary}</p>
            )}
          </>
        )}
        <div className="mc-meta">
          <span className="mc-source">{story.source}</span>
          <span className={`sentiment sentiment--${story.sentiment}`}>
            {SENTIMENT_LABELS[story.sentiment]}
          </span>
        </div>
      </div>
    </a>
  );
}
