"use client";
import { useState } from "react";

type Row = { title: string; ownedTitle: string; source: string; section: string; link: string; slug: string; writerIdx: number; cardType: "story" | "synthesis" | "fc" | "failed"; generationError?: string; generationStatus?: string };
type Diagnostics = { target: number; survived: number; poolSize: number; benchSize: number; failures: { title: string; section: string; status?: string; error?: string }[] };
type Edition = { key: string; label: string; theme: string; isCurrent: boolean; rows: Row[]; diagnostics?: Diagnostics; insightError?: string };
type Writer = { id: number; name: string; inspiration: string; personality: string };
type Palette = { pageBg: string; cardBg: string; ink: string; inkMid: string; inkLight: string; accent: string; tint: string; fontBody: string; fontHeading: string };

const PASSWORD = "office";

export function DeskClient({ allEditions, writers, palette: P }: { allEditions: Edition[]; writers: Writer[]; palette: Palette }) {
  const [input, setInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState(false);

  const attempt = () => { if (input === PASSWORD) setAuthed(true); else setErr(true); };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: P.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: P.fontBody }}>
        <div style={{ background: P.cardBg, borderRadius: 20, padding: 48, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", minWidth: 320, textAlign: "center" as const }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, marginBottom: 8 }}>Signal Desk</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: P.ink, marginBottom: 32 }}>Internal Access</div>
          <input
            type="password" placeholder="Password" value={input} autoFocus
            onChange={e => { setInput(e.target.value); setErr(false); }}
            onKeyDown={e => e.key === "Enter" && attempt()}
            style={{ width: "100%", padding: "12px 16px", borderRadius: 50, border: `1.5px solid ${err ? "#e05c5c" : P.tint}`, fontSize: 14, fontFamily: P.fontBody, outline: "none", boxSizing: "border-box" as const, marginBottom: 12 }}
          />
          {err && <div style={{ fontSize: 12, color: "#e05c5c", marginBottom: 12 }}>Incorrect password</div>}
          <button onClick={attempt} style={{ width: "100%", padding: "12px 0", borderRadius: 50, background: P.accent, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, fontFamily: P.fontBody, cursor: "pointer" }}>
            Enter
          </button>
        </div>
      </div>
    );
  }

  const COLS = ["#", "Status", "Our Headline", "Original Headline", "Source", "Section", "W#", "Pseudonym", "Modeled After", "Personality", "Error"];

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    ok:           { label: "✓ OK",         color: "#22c55e" },
    no_body:      { label: "No Body",      color: "#f59e0b" },
    pass1_failed: { label: "Pass 1 Fail",  color: "#e05c5c" },
    missing:      { label: "Missing",      color: "#94a3b8" },
  };

  return (
    <div style={{ minHeight: "100vh", background: P.pageBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>
      <div style={{ borderBottom: `1px solid ${P.tint}44`, padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, textDecoration: "none" }}>&lt; Home</a>
          <span style={{ color: P.tint }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: P.accent }}>Signal Desk</span>
        </div>
        <span style={{ fontSize: 11, color: P.inkLight }}>{allEditions.length} editions</span>
      </div>

      <div style={{ maxWidth: 1300, marginLeft: "auto", marginRight: "auto", padding: "32px 24px" }}>
        {allEditions.map(edition => (
          <div key={edition.key} style={{ marginBottom: 56 }}>
            {(() => {
              const [datePart = "", slotPart = ""] = edition.key.split("_");
              const [yr, mo, dy] = datePart.split("-");
              const dateDisplay = mo && dy && yr ? `${mo}/${dy}/${yr.slice(2)}` : "";
              const slotDisplay = slotPart.charAt(0).toUpperCase() + slotPart.slice(1);
              return (
                <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `2px solid ${P.accent}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight }}>
                      {edition.label}
                    </div>
                    {edition.isCurrent && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: P.accent, background: P.accent + "22", padding: "2px 7px", borderRadius: 20 }}>● Live</span>}
                    {dateDisplay && <span style={{ fontSize: 10, fontWeight: 600, color: P.inkLight, opacity: 0.6, marginLeft: "auto" }}>{dateDisplay}{slotDisplay ? ` · ${slotDisplay}` : ""}</span>}
                  </div>
                  {edition.theme && (
                    <a
                      href={edition.isCurrent ? "/" : `/archive/${edition.key}`}
                      style={{ fontSize: 20, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading, textDecoration: "none", display: "inline-flex", alignItems: "baseline", gap: 8 }}
                    >
                      {edition.theme}
                      <span style={{ fontSize: 12, color: P.accent, fontWeight: 700 }} aria-hidden>&gt;</span>
                    </a>
                  )}
                </div>
              );
            })()}
            {(() => {
              const d = edition.diagnostics;
              const short = d ? d.survived < d.target : false;
              if (!d && !edition.insightError) return null;
              return (
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, alignItems: "center", marginBottom: 10, fontSize: 11, fontFamily: "monospace" }}>
                  {d && (
                    <span style={{ fontWeight: 700, letterSpacing: 0.5, color: short ? "#e05c5c" : "#22c55e", background: (short ? "#e05c5c" : "#22c55e") + "1f", padding: "4px 10px", borderRadius: 20 }}>
                      {short ? "SHORT" : "FULL"} {d.survived}/{d.target} stories
                    </span>
                  )}
                  {d && <span style={{ color: P.inkLight }}>pool {d.poolSize} · bench {d.benchSize} · dropped {d.failures.length}</span>}
                  {edition.insightError && (
                    <span style={{ fontWeight: 700, color: "#e05c5c", background: "#e05c5c1f", padding: "4px 10px", borderRadius: 20 }}>
                      NO INSIGHT — {edition.insightError}
                    </span>
                  )}
                </div>
              );
            })()}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${P.tint}88` }}>
                    {COLS.map(h => (
                      <th key={h} style={{ textAlign: "left" as const, padding: "6px 10px", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: h === "Our Headline" ? P.accent : P.inkLight, whiteSpace: "nowrap" as const }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let storyCount = 0;
                    return edition.rows.map((row, i) => {
                    // -1 marks an unknown writer (editions built before the index was recorded).
                    // Modulo would wrap it to the last writer and invent an attribution.
                    const writer = row.writerIdx >= 0 ? writers[row.writerIdx % writers.length] : null;
                    const isCard = row.cardType === "synthesis" || row.cardType === "fc";
                    const isFailed = row.cardType === "failed";
                    const storyNum = isCard || isFailed ? null : ++storyCount;
                    const na = <span style={{ color: P.inkLight, opacity: 0.35 }}>—</span>;
                    const sectionColor = row.cardType === "synthesis" ? P.accent : row.cardType === "fc" ? "#8B5CF6" : P.inkLight;
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${P.tint}33`, background: isFailed ? "#e05c5c18" : isCard ? P.tint + "18" : "transparent" }}>
                        <td style={{ padding: "10px 10px", color: P.inkLight, fontSize: 11, verticalAlign: "top" as const }}>{storyNum ?? ""}</td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, whiteSpace: "nowrap" as const }}>
                          {isCard ? (
                            row.cardType === "synthesis"
                              ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: row.title ? "#22c55e" : "#f59e0b", background: (row.title ? "#22c55e" : "#f59e0b") + "22", padding: "3px 8px", borderRadius: 20 }}>{row.title ? "✓ OK" : "No Theme"}</span>
                              : row.cardType === "fc"
                                ? <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: row.title ? "#22c55e" : "#e05c5c", background: (row.title ? "#22c55e" : "#e05c5c") + "22", padding: "3px 8px", borderRadius: 20 }}>{row.title ? "✓ OK" : "FC Failed"}</span>
                                : na
                          ) : (() => {
                            const s = STATUS_CONFIG[row.generationStatus ?? "missing"] ?? STATUS_CONFIG.missing;
                            return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: s.color, background: s.color + "22", padding: "3px 8px", borderRadius: 20 }}>{s.label}</span>;
                          })()}
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, minWidth: 200 }}>
                          {isCard ? (
                            row.slug ? (
                              <a href={row.slug} style={{ color: P.inkMid, textDecoration: "none", fontWeight: 600, lineHeight: 1.35, display: "block" }}>{row.title || na}</a>
                            ) : (
                              <span style={{ color: P.inkMid, fontWeight: 600, lineHeight: 1.35, display: "block" }}>{row.title || na}</span>
                            )
                          ) : row.generationError ? (
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#e05c5c", display: "block", marginBottom: 3 }}>⚠ Pre-warm failed</span>
                              <span style={{ fontSize: 11, color: "#e05c5c", opacity: 0.75, fontFamily: "monospace", lineHeight: 1.4, display: "block", wordBreak: "break-all" as const }}>{row.generationError}</span>
                            </div>
                          ) : (
                            <a href={`/article/${row.slug}`} style={{ color: P.accent, textDecoration: "none", fontWeight: 600, lineHeight: 1.35, display: "block" }}>
                              {row.ownedTitle || na}
                            </a>
                          )}
                        </td>
                        <td style={{ padding: "10px 10px", color: P.inkMid, verticalAlign: "top" as const, lineHeight: 1.4, minWidth: 200 }}>
                          {isCard ? (row.ownedTitle ? <span style={{ color: P.inkLight, fontSize: 12, fontStyle: "italic" }}>{row.ownedTitle}</span> : na) : row.title}
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, whiteSpace: "nowrap" as const }}>
                          {isCard ? (row.source ? <span style={{ color: P.inkLight, fontSize: 12 }}>{row.source}</span> : na) : (
                            <a href={row.link} target="_blank" rel="noopener noreferrer" style={{ color: P.inkLight, textDecoration: "none", fontSize: 12 }}>{row.source} &gt;</a>
                          )}
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: sectionColor, background: sectionColor + "22", padding: "3px 8px", borderRadius: 20 }}>{row.section}</span>
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, textAlign: "center" as const }}>
                          {writer ? <span style={{ fontSize: 11, fontWeight: 700, color: P.accent, fontFamily: "monospace" }}>W{writer.id}</span> : na}
                        </td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, fontWeight: 600, whiteSpace: "nowrap" as const }}>{writer?.name ?? na}</td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, color: P.inkMid, fontSize: 12, whiteSpace: "nowrap" as const, fontStyle: "italic" }}>{writer?.inspiration ?? na}</td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, color: P.inkLight, fontSize: 12, lineHeight: 1.4, minWidth: 220 }}>{writer?.personality ?? na}</td>
                        <td style={{ padding: "10px 10px", verticalAlign: "top" as const, minWidth: 260 }}>
                          {row.generationError
                            ? <span style={{ fontSize: 11, color: "#e05c5c", fontFamily: "monospace", lineHeight: 1.4, display: "block", wordBreak: "break-word" as const }}>{row.generationError}</span>
                            : na}
                        </td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
