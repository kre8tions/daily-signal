"use client";
import { useEffect, useState } from "react";

// Edition boundaries are defined in UTC+14. Convert to UTC for countdown math.
// UTC+14 boundaries: 5,9,13,17,21 → UTC: 15,19,23,3,7 (previous UTC day for 15,19,23)
const NEXT_BOUNDARY_UTC_HOURS = [3, 7, 15, 19, 23]; // sorted

function getNextEditionStart(): Date {
  const now = new Date();
  const h = now.getUTCHours();
  const next = new Date(now);
  next.setUTCSeconds(0);
  next.setUTCMilliseconds(0);
  const boundary = NEXT_BOUNDARY_UTC_HOURS.find(b => b > h);
  if (boundary !== undefined) {
    next.setUTCHours(boundary, 0, 0, 0);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(NEXT_BOUNDARY_UTC_HOURS[0], 0, 0, 0);
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
