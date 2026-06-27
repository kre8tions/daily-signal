"use client";
import { useState } from "react";

type Edition = { key: string; label: string; theme: string; stories: Story[]; isCurrent: boolean };
type Story = { title: string; ownedTitle?: string; source: string; section: string; link: string; pubDate: string; cardStyle: string; imageUrl?: string; summary?: string; bullets?: string[]; pullquote?: string; insight?: string };
type Writer = { id: number; name: string; personality: string };
type Palette = { pageBg: string; cardBg: string; ink: string; inkMid: string; inkLight: string; accent: string; tint: string; fontBody: string; fontHeading: string };

const PASSWORD = "office";

export function DeskClient({
  allEditions, writers, getWriterAssignments, urlToSlug, palette: P,
}: {
  allEditions: Edition[];
  writers: Writer[];
  getWriterAssignments: (key: string) => number[];
  urlToSlug: (url: string) => string;
  palette: Palette;
}) {
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState(false);

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: P.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: P.fontBody }}>
        <div style={{ background: P.cardBg, borderRadius: 20, padding: 48, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", minWidth: 320, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: P.inkLight, marginBottom: 8 }}>Signal Desk</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: P.ink, marginBottom: 32 }}>Internal Access</div>
          <input
            type="password"
            placeholder="Password"
            value={input}
            onChange={e => { setInput(e.target.value); setErr(false); }}
            onKeyDown={e => { if (e.key === "Enter") { if (input === PASSWORD) setAuthed(true); else setErr(true); } }}
            autoFocus
            style={{ width: "100%", padding: "12px 16px", borderRadius: 50, border: `1.5px solid ${err ? "#e05c5c" : P.tint}`, fontSize: 14, fontFamily: P.fontBody, outline: "none", boxSizing: "border-box", marginBottom: 12 }}
          />
          {err && <div style={{ fontSize: 12, color: "#e05c5c", marginBottom: 12 }}>Incorrect password</div>}
          <button
            onClick={() => { if (input === PASSWORD) setAuthed(true); else setErr(true); }}
            style={{ width: "100%", padding: "12px 0", borderRadius: 50, background: P.accent, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, fontFamily: P.fontBody, cursor: "pointer" }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: P.pageBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.tint}44`, paddingTop: 18, paddingBottom: 18, paddingLeft: 28, paddingRight: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, textDecoration: "none" }}>← Home</a>
          <span style={{ color: P.tint }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: P.accent }}>Signal Desk</span>
        </div>
        <span style={{ fontSize: 11, color: P.inkLight }}>{allEditions.length} editions</span>
      </div>

      <div style={{ maxWidth: 1200, marginLeft: "auto", marginRight: "auto", paddingTop: 32, paddingLeft: 24, paddingRight: 24 }}>
        {allEditions.map(edition => {
          const writerSlots = getWriterAssignments(edition.key);
          return (
            <div key={edition.key} style={{ marginBottom: 56 }}>
              {/* Edition header */}
              <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${P.accent}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, marginBottom: 4 }}>
                  {edition.isCurrent ? "Current Edition" : edition.label}
                </div>
                {edition.theme && <div style={{ fontSize: 20, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading }}>{edition.theme}</div>}
              </div>

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${P.tint}88` }}>
                      {["#", "Our Headline", "Original Headline", "Source", "Section", "W#", "Pseudonym", "Personality"].map(h => (
                        <th key={h} style={{ textAlign: "left" as const, padding: "6px 10px", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: h === "Our Headline" ? P.accent : P.inkLight, whiteSpace: "nowrap" as const }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {edition.stories.map((story, i) => {
                      const writerIdx = writerSlots[i] ?? 0;
                      const writer = writers[writerIdx % writers.length];
                      const slug = urlToSlug(story.link);
                      return (
                        <tr key={i} style={{ borderBottom: `1px solid ${P.tint}33` }}>
                          <td style={{ padding: "10px 10px", color: P.inkLight, fontSize: 11, verticalAlign: "top" as const }}>{i + 1}</td>
                          <td style={{ padding: "10px 10px", verticalAlign: "top" as const, minWidth: 200 }}>
                            <a href={`/article/${slug}`} style={{ color: P.accent, textDecoration: "none", fontWeight: 600, lineHeight: 1.35, display: "block" }}>
                              {story.ownedTitle || <span style={{ color: P.inkLight, fontStyle: "italic" }}>—</span>}
                            </a>
                          </td>
                          <td style={{ padding: "10px 10px", color: P.inkMid, verticalAlign: "top" as const, lineHeight: 1.4, minWidth: 200 }}>{story.title}</td>
                          <td style={{ padding: "10px 10px", verticalAlign: "top" as const, whiteSpace: "nowrap" as const }}>
                            <a href={story.link} target="_blank" rel="noopener noreferrer" style={{ color: P.inkLight, textDecoration: "none", fontSize: 12 }}>
                              {story.source} ↗
                            </a>
                          </td>
                          <td style={{ padding: "10px 10px", verticalAlign: "top" as const }}>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, background: P.tint + "44", padding: "3px 8px", borderRadius: 20 }}>{story.section}</span>
                          </td>
                          <td style={{ padding: "10px 10px", verticalAlign: "top" as const, textAlign: "center" as const }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: P.accent, fontFamily: "monospace" }}>W{writer.id}</span>
                          </td>
                          <td style={{ padding: "10px 10px", verticalAlign: "top" as const, fontWeight: 600, whiteSpace: "nowrap" as const }}>{writer.name}</td>
                          <td style={{ padding: "10px 10px", verticalAlign: "top" as const, color: P.inkLight, fontSize: 12, lineHeight: 1.4, minWidth: 220 }}>{writer.personality}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
