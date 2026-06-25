import Image from "next/image";
import { Story } from "@/types";

export function HeroStory({ story }: { story: Story }) {
  return (
    <article className="hero-story">
      {story.imageUrl && (
        <div className="hero-image">
          <Image src={story.imageUrl} alt={story.title} fill style={{ objectFit: "cover" }} unoptimized />
          <span className="ai-badge">AI CURATED</span>
        </div>
      )}
      <h2 className="hero-title">
        <a href={story.link} target="_blank" rel="noopener noreferrer">
          {story.title}
        </a>
      </h2>
      <div className="byline">
        {story.sources.join(" · ")} · {formatDate(story.pubDate)}
      </div>
      {story.aiSummary && (
        <div className="ai-summary">
          <strong>AI Summary — </strong>
          {story.aiSummary}
        </div>
      )}
    </article>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}
