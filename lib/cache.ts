// File-based cache — no Redis needed early on.
// Keeps Claude API calls minimal: summarize once, serve many times.
import fs from "fs";
import path from "path";
import os from "os";

const CACHE_DIR = path.join(os.tmpdir(), "daily-signal-cache");
const TTL_MS = parseInt(process.env.CACHE_TTL_SECONDS ?? "1800") * 1000;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

function keyPath(key: string): string {
  const safe = key.replace(/[^a-z0-9_-]/gi, "_");
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  return path.join(CACHE_DIR, `${safe}.json`);
}

export function cacheGet<T>(key: string): T | null {
  try {
    const file = keyPath(key);
    if (!fs.existsSync(file)) return null;
    const entry: CacheEntry<T> = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (Date.now() > entry.expiresAt) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs = TTL_MS): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    fs.writeFileSync(keyPath(key), JSON.stringify(entry));
  } catch {
    // non-fatal — degrade gracefully without cache
  }
}

export function cacheDelete(key: string): void {
  try {
    const file = keyPath(key);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {}
}
