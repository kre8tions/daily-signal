"use client";
import { useState, useRef, useEffect } from "react";

export function EmailCapture({ accent, ink, cardBg, fontBody, pillHeight = 36 }: { accent: string; ink: string; cardBg: string; fontBody: string; pillHeight?: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "transparent", color: accent, border: `1px solid ${accent}`, borderRadius: 50,
          height: pillHeight, paddingLeft: 22, paddingRight: 22,
          fontSize: 13, fontWeight: 700, fontFamily: fontBody, cursor: "pointer",
          boxSizing: "border-box", whiteSpace: "nowrap" as const,
        }}
      >
        Get the Signal
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        ref={inputRef}
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
          background: accent, color: cardBg, border: `1px solid ${accent}`, borderRadius: 50,
          height: pillHeight, paddingLeft: 22, paddingRight: 22,
          fontSize: 13, fontWeight: 700, fontFamily: fontBody, cursor: "pointer",
          opacity: status === "loading" ? 0.6 : 1, boxSizing: "border-box", whiteSpace: "nowrap" as const,
        }}
      >
        {status === "loading" ? "..." : "Subscribe"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{
          background: "transparent", border: "none", color: accent, cursor: "pointer",
          fontSize: 18, lineHeight: 1, padding: "0 4px", opacity: 0.5, fontFamily: fontBody,
        }}
      >
        ×
      </button>
      {status === "error" && <span style={{ fontSize: 11, color: "#ff6b6b", fontFamily: fontBody }}>Something went wrong.</span>}
    </form>
  );
}
