// Fetches all archive edition blobs from the live site and studies titles.
// Run: node scripts/study-titles.mjs <CRON_SECRET>
// Or pass secret as env: CRON_SECRET=xxx node scripts/study-titles.mjs

const secret = process.argv[2] ?? process.env.CRON_SECRET;
if (!secret) { console.error("Usage: node scripts/study-titles.mjs <CRON_SECRET>"); process.exit(1); }

const BASE = "https://daily-signal-omega.vercel.app";

// 1. Get list of edition blobs via debug-archive
const debugRes = await fetch(`${BASE}/api/debug-archive?secret=${secret}`);
if (!debugRes.ok) { console.error("debug-archive failed:", debugRes.status); process.exit(1); }
const { editionBlobs } = await debugRes.json();
console.log(`Found ${editionBlobs.length} edition blobs\n`);

// 2. Fetch each edition blob and extract title pairs
const pairs = [];
for (const b of editionBlobs.sort((a, b) => a.path.localeCompare(b.path))) {
  const key = b.path.replace("archive/editions/", "").replace(".json", "");
  // Edition blobs are public — fetch via the Vercel Blob CDN
  // We get the URL by fetching the page data endpoint
  const res = await fetch(`${BASE}/api/debug-archive?secret=${secret}&key=${key}`).catch(() => null);
  // Fallback: construct blob URL pattern from known working blob
  // Actually debug-archive doesn't return content — fetch via warm data
  // Use archive page API instead
  const archRes = await fetch(`${BASE}/archive/${key}`, {
    headers: { Accept: "text/html" }
  }).catch(() => null);

  // Actually let's just hit the Next.js page and extract JSON from __NEXT_DATA__
  if (!archRes?.ok) { console.log(`  [${key}] fetch failed`); continue; }
  const html = await archRes.text();
  const match = html.match(/"stories"\s*:\s*(\[[\s\S]*?\])\s*,\s*"synthesis"/);
  if (!match) { console.log(`  [${key}] no stories found`); continue; }
  try {
    const stories = JSON.parse(match[1]);
    for (const s of stories) {
      if (s.title && s.ownedTitle) {
        pairs.push({ key, section: s.section, original: s.title, owned: s.ownedTitle });
      }
    }
  } catch { console.log(`  [${key}] parse error`); }
}

console.log(`\nTotal pairs extracted: ${pairs.length}`);
console.log("=".repeat(80) + "\n");
for (const p of pairs) {
  console.log(`[${p.key}] [${p.section}]`);
  console.log(`  RSS:   ${p.original}`);
  console.log(`  OWNED: ${p.owned}`);
  console.log();
}
