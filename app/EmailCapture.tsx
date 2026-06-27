"use client";
import { useState } from "react";

export function EmailCapture({ accent, ink, cardBg, fontBody, pillHeight = 36 }: { accent: string; ink: string; cardBg: string; fontBody: string; pillHeight?: number }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: accent + "22", border: `1px solid ${accent}55`, borderRadius: 50 }}>
        <span style={{ fontSize: 16 }}>⚡</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: accent, fontFamily: fontBody }}>You&apos;re in. Signal incoming.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="email"
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{
          background: cardBg, border: `1px solid ${accent}44`, borderRadius: 50,
          height: pillHeight, paddingLeft: 20, paddingRight: 20,
          fontSize: 13, color: ink, fontFamily: fontBody, outline: "none", minWidth: 180, boxSizing: "border-box",
        }}
      />
      <button
        type="submit"
        disabled={status === "loading"}
        style={{
          background: accent, color: "#000", border: "none", borderRadius: 50,
          height: pillHeight, paddingLeft: 22, paddingRight: 22,
          fontSize: 13, fontWeight: 700, fontFamily: fontBody, cursor: "pointer",
          opacity: status === "loading" ? 0.6 : 1, boxSizing: "border-box",
        }}
      >
        {status === "loading" ? "..." : "Get the Signal"}
      </button>
      {status === "error" && <span style={{ fontSize: 11, color: "#ff6b6b", fontFamily: fontBody }}>Something went wrong. Try again.</span>}
    </form>
  );
}
