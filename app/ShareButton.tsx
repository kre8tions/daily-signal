"use client";

import { useState } from "react";

interface ShareButtonProps {
  title: string;
  url: string;
  color: string;
  fontBody: string;
}

export function ShareButton({ title, url, color, fontBody }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or API unsupported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — silently ignore
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "transparent",
        border: `1px solid ${color}55`,
        borderRadius: 20,
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 12,
        paddingRight: 12,
        cursor: "pointer",
        fontSize: 12,
        color: color,
        fontFamily: fontBody,
        letterSpacing: 0.5,
        transition: "border-color 0.15s, color 0.15s",
      }}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM3.5 4.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM8.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z" fill="none" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5 5.5L7 4M5 6.5L7 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Share
        </>
      )}
    </button>
  );
}
