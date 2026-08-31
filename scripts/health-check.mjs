#!/usr/bin/env node
/**
 * Operational health check for The Daily Signal.
 *
 * Every automated evaluation this project had was EDITORIAL — they read published output and
 * judged craft. None would have caught a one-card edition, the S1 Insight silently failing, the
 * same photo running six days, or eight of eighteen feeds being dead. Those are the failures
 * that actually shipped broken product, and they are all machine-checkable without a model.
 *
 * Exits 0 when healthy, 1 when something needs attention, so it can gate a notification.
 *   node scripts/health-check.mjs [--editions 6] [--json]
 */
import Parser from "rss-parser";

const SITE = "https://dailysignal.cc";
const args = process.argv.slice(2);
const EDITIONS = Number(args[args.indexOf("--editions") + 1]) || 6;
const AS_JSON = args.includes("--json");
const TARGET_CARDS = 8;
const STALE_DAYS = 90;   // some good sources publish quarterly; a check that cries daily gets ignored

const problems = [];
const notes = [];

const recentKeys = (n = EDITIONS) => {
  const slots = ["evening", "afternoon", "morning", "early"];
  const keys = [];
  for (let d = 0; d < 10 && keys.length < n; d++) {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - d);
    const date = dt.toISOString().slice(0, 10);
    if (dt.getUTCDay() === 6) continue;              // Saturday is dark by design
    for (const s of slots) { if (keys.length < n) keys.push(`${date}_${s}`); }
  }
  return keys;
};

// The S1 hook protagonist repeated across a week before anyone noticed — "Priya" led 9 of 16
// pieces over Aug 25-31, twice as an identical full name. That is invisible to the card-count
// and image checks. Look back further than the ops checks: a name only reads as repetitive
// once you have several editions in view.
const S1_NAME_LOOKBACK = 16;

async function checkS1Names() {
  const byFirst = new Map();   // first name -> Set(editionKey)
  const byFull = new Map();    // "full name" -> Set(editionKey)
  let named = 0, exposed = 0, missing = 0;
  for (const key of recentKeys(S1_NAME_LOOKBACK)) {
    const insightSlug = Buffer.from(`https://dailysignal.cc/insight/${key}`)
      .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    let html;
    try {
      const res = await fetch(`${SITE}/article/${insightSlug}?e=${key}`, { headers: { "User-Agent": "DailySignal-HealthCheck" } });
      if (!res.ok) continue;                          // not built yet
      html = await res.text();
    } catch { continue; }

    const meta = html.match(/<meta name="ds:s1-hook" content="([^"]+)"/);
    if (!meta) { missing++; continue; }               // pre-dates the field, or a non-person hook
    exposed++;
    const full = meta[1].replace(/&#x27;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
    if (!full) continue;                              // explicit empty = non-person hook
    named++;
    const first = full.split(/\s+/)[0].toLowerCase();
    if (!byFirst.has(first)) byFirst.set(first, new Set());
    byFirst.get(first).add(key);
    const fl = full.toLowerCase();
    if (!byFull.has(fl)) byFull.set(fl, new Set());
    byFull.get(fl).add(key);
  }

  for (const [first, keys] of byFirst) {
    if (keys.size >= 2) problems.push(`S1 hook first name "${first}" repeats in ${keys.size} editions: ${[...keys].sort().join(", ")}`);
  }
  for (const [full, keys] of byFull) {
    if (keys.size >= 2) problems.push(`S1 hook name "${full}" is identical across ${keys.size} editions: ${[...keys].sort().join(", ")}`);
  }
  notes.push(`S1 hooks: ${byFirst.size} distinct first names across ${named} named editions (${exposed} checked${missing ? `, ${missing} not exposing the name yet` : ""})`);
}

async function checkEditions() {
  const seenImages = new Map();
  const seenStories = new Map();   // source URL -> first edition that ran it
  let checked = 0;
  for (const key of recentKeys()) {
    let html;
    try {
      const res = await fetch(`${SITE}/archive/${key}`, { headers: { "User-Agent": "DailySignal-HealthCheck" } });
      if (!res.ok) continue;                          // not built yet — not a failure
      html = await res.text();
    } catch { continue; }
    checked++;

    const cards = (html.match(/class="ds-card-h"/g) ?? []).length;
    if (cards < TARGET_CARDS) problems.push(`${key}: ${cards}/${TARGET_CARDS} cards`);

    // The Insight's card links via urlToSlug(), which base64-encodes the synthetic link — so
    // "insight/" never appears literally in the markup. Encode it the same way and look for that.
    const insightSlug = Buffer.from(`https://dailysignal.cc/insight/${key}`)
      .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    if (!html.includes(insightSlug)) problems.push(`${key}: S1 Insight missing — an RSS story is leading`);

    // Dedupe per edition first — the same image appears many times in one page's markup.
    const idsHere = new Set([...html.matchAll(/\/(photo-[^?"/]+)/g)].map(m => m[1]));
    for (const id of idsHere) {
      const prior = seenImages.get(id);
      if (prior && prior !== key) problems.push(`${key}: image ${id} already used in ${prior}`);
      else if (!prior) seenImages.set(id, key);
    }

    // Same RSS item running in more than one edition. Article slugs are base64 of the source
    // URL, so decoding them matches exactly rather than by headline. Measured at 9% on
    // 2026-08-25: loadUsedLinks was walking back 150 editions and fetching every archive blob,
    // and enough of those 300 calls failed silently that the dedup set came back partial.
    const slugs = new Set([...html.matchAll(/\/article\/([A-Za-z0-9_-]{16,})/g)].map(m => m[1]));
    for (const slug of slugs) {
      let url;
      try { url = Buffer.from(slug.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
      catch { continue; }
      if (!url.startsWith("http") || url.includes("/insight/")) continue;   // insight links are synthetic
      const prior = seenStories.get(url);
      if (prior && prior !== key) {
        const host = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
        problems.push(`${key}: story also in ${prior} — ${host}${url.slice(url.indexOf(host) + host.length, url.indexOf(host) + host.length + 42)}`);
      } else if (!prior) seenStories.set(url, key);
    }
  }
  notes.push(`${checked} editions checked, ${seenImages.size} distinct images, ${seenStories.size} distinct stories`);
}

async function checkFeeds() {
  // Uplift feeds only — Psychology and HumanPotential are the only sections that can fill the
  // lead RSS slots through the section gate, so their supply is what starves an edition first.
  const feeds = [
    ["Behavioral Scientist", "https://behavioralscientist.org/feed/"],
    ["Ness Labs", "https://nesslabs.com/feed"],
    ["Raptitude", "https://www.raptitude.com/feed/"],
    ["Psyche", "https://psyche.co/feed"],
    ["Barking Up the Wrong Tree", "https://bakadesuyo.com/feed"],
    ["Farnam Street", "https://fs.blog/feed/"],
    ["Big Think", "https://bigthink.com/feed/"],
    ["Fast Company Ideas", "https://www.fastcompany.com/leadership/rss"],
    ["Kottke", "https://feeds.kottke.org/main"],
    ["Darius Foroux", "https://dariusforoux.com/feed"],
    ["Derek Sivers", "https://sive.rs/en.atom"],
    ["Scott H. Young", "https://www.scotthyoung.com/blog/feed/"],
    ["Art of Manliness", "https://www.artofmanliness.com/feed/"],
    ["Outside", "https://www.outsideonline.com/feed/"],
    ["Stronger by Science", "https://www.strongerbyscience.com/feed/"],
    ["Reasons to be Cheerful", "https://reasonstobecheerful.world/feed/"],
    ["Positive News", "https://www.positive.news/feed/"],
    ["Good Good Good", "https://www.goodgoodgood.co/articles/rss.xml"],
    ["Runner's World", "https://www.runnersworld.com/rss/all.xml/"],
  ];
  const parser = new Parser({ timeout: 8000, headers: { "User-Agent": "DailySignal-HealthCheck" } });
  let live = 0;
  const cutoff = Date.now() - STALE_DAYS * 864e5;
  await Promise.all(feeds.map(async ([name, url]) => {
    try {
      const f = await parser.parseURL(url);
      const newest = f.items?.[0]?.isoDate ?? f.items?.[0]?.pubDate;
      const t = newest ? new Date(newest).getTime() : NaN;
      if (!f.items?.length) problems.push(`feed empty: ${name}`);
      else if (!Number.isNaN(t) && t < cutoff) problems.push(`feed stale: ${name} — newest ${String(newest).slice(0, 16)}`);
      else live++;
    } catch (e) {
      problems.push(`feed dead: ${name} — ${String(e.message).slice(0, 50)}`);
    }
  }));
  notes.push(`${live}/${feeds.length} uplift feeds healthy`);
  if (live < 10) problems.push(`only ${live} uplift feeds live — the lead RSS slots will starve`);
}

await checkEditions();
await checkS1Names();
await checkFeeds();

if (AS_JSON) {
  console.log(JSON.stringify({ ok: problems.length === 0, problems, notes }, null, 2));
} else {
  for (const n of notes) console.log(`  ${n}`);
  if (problems.length === 0) console.log("\nOK — no operational problems found");
  else { console.log(`\n${problems.length} PROBLEM(S):`); for (const p of problems) console.log(`  - ${p}`); }
}
process.exit(problems.length ? 1 : 0);
