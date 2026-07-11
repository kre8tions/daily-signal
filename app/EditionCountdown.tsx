"use client";
import { useEffect, useState } from "react";

// Slot boundaries in local time — matches slotFromHour in stories.ts
const LOCAL_BOUNDARIES = [5, 9, 13, 17, 21];

function getNextEditionStart(): Date {
  const now = new Date();
  const h = now.getHours();
  const next = new Date(now);
  next.setSeconds(0, 0);
  const boundary = LOCAL_BOUNDARIES.find(b => b > h);
  if (boundary !== undefined) {
    next.setHours(boundary, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(LOCAL_BOUNDARIES[0], 0, 0, 0);
  }
  return next;
}

function fmt(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function EditionCountdown({ fontBody, accent, inkLight }: { fontBody: string; accent: string; inkLight: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const tick = () => {
      const ms = getNextEditionStart().getTime() - Date.now();
      setDisplay(fmt(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!display) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: fontBody }}>
      <span style={{ fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: inkLight }}>Next Edition</span>
      <span style={{ fontWeight: 700, letterSpacing: 1, color: accent, fontVariantNumeric: "tabular-nums" }}>{display}</span>
    </div>
  );
}
