#!/usr/bin/env node
/**
 * Deterministic craft checks over recently published articles.
 *
 * The weekly editorial audit used to ask a model to count em-dashes, match banned phrases and
 * verify a pull quote appeared verbatim. Counting is the one thing an LLM does badly and a
 * regex does perfectly — and every mis-count became a finding someone then acted on. Worse, it
 * spent the audit's attention on bookkeeping instead of on factual integrity, which is the
 * check that actually catches fabricated studies.
 *
 * So: everything countable happens here. The audit reads this output and spends its whole
 * budget on judgment — uplift, voice, facts, whether a headline says what the piece is about.
 *
 *   node scripts/prose-lint.mjs [--editions 8] [--json]
 */

const SITE = "https://dailysignal.cc";
const args = process.argv.slice(2);
const EDITIONS = Number(args[args.indexOf("--editions") + 1]) || 8;
const AS_JSON = args.includes("--json");

// Caps and lists mirror the rules in lib/stories.ts. If you change one, change both.
const EM_DASH_CAP = 2;
const NOT_X_Y_CAP = 1;
const PULL_QUOTE_MAX_WORDS = 25;

const BANNED_WORDS = ["furthermore", "moreover", "additionally", "delve", "in conclusion",
  "it's worth noting", "it is worth noting", "one might argue", "this suggests that",
  "in today's world", "it's no secret", "now more than ever"];
const ANNOUNCE = ["here's how it works", "here's the thing", "so here is", "made specific",
  "let me explain", "what's fascinating is", "the key insight is"];
const WEAK_ENDINGS = ["ultimately", "in conclusion", "only time will tell", "time will tell"];

// "Not X. Y." and the variants that are the same move in different clothes.
const NOT_X_Y = [
  /\bNot\s+[^.!?]{1,60}\.\s+[A-Z]/g,
  /\bIt\s+is\s?n[o']t\s+[^.!?]{1,60},\s+it'?s\s+/gi,
  /\bwas\s?n[o']t\s+[^.!?]{1,60}\.\s+(?:It|He|She|They)\s+was\b/gi,
  /\bnot\s+because\s+[^.!?]{1,60}\.\s+Because\b/gi,
];

const findings = [];
const stats = { articles: 0, emDashes: 0, notXY: 0 };
const add = (sev, edition, title, msg) => findings.push({ sev, edition, title: title.slice(0, 60), msg });

const recentKeys = () => {
  const slots = ["evening", "afternoon", "morning", "early"];
  const keys = [];
  for (let d = 0; d < 5 && keys.length < EDITIONS; d++) {
    const dt = new Date(); dt.setUTCDate(dt.getUTCDate() - d);
    if (dt.getUTCDay() === 6) continue;                       // Saturday is dark
    const date = dt.toISOString().slice(0, 10);
    for (const s of slots) if (keys.length < EDITIONS) keys.push(`${date}_${s}`);
  }
  return keys;
};

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

function lintArticle(edition, title, body, pullQuote) {
  stats.articles++;
  const lower = body.toLowerCase();

  const dashes = (body.match(/—/g) ?? []).length;
  stats.emDashes += dashes;
  if (dashes > EM_DASH_CAP) add("warn", edition, title, `${dashes} em-dashes (cap ${EM_DASH_CAP})`);

  let notCount = 0;
  for (const re of NOT_X_Y) notCount += (body.match(re) ?? []).length;
  stats.notXY += notCount;
  if (notCount > NOT_X_Y_CAP) add("warn", edition, title, `${notCount} "Not X. Y." constructions (cap ${NOT_X_Y_CAP})`);

  for (const w of BANNED_WORDS) if (lower.includes(w)) add("warn", edition, title, `banned phrase: "${w}"`);
  for (const a of ANNOUNCE) if (lower.includes(a)) add("warn", edition, title, `announce-sentence: "${a}"`);

  if (/;/.test(body)) add("warn", edition, title, `semicolon in body (rule is none, ever)`);

  // Headline
  if (/^The\s+\w+\s+(You|That)\b/i.test(title)) add("warn", edition, title, `banned frame: "The [noun] You ..."`);
  if (/^(Why\s+Your|You\s+Already\s+Know)\b/i.test(title)) add("warn", edition, title, `banned title frame`);
  const titleNums = [...title.matchAll(/\b(\d[\d,.]*)\b/g)].map(m => m[1].replace(/[,.]$/, ""));
  // Only flag a spelled-out number when the headline makes a STATISTIC claim — "Seventy Percent
  // of Coached Clients Never Change" over a body that never says it. A bare spelled number is
  // usually a price or a count ("Thirteen Ninety-Nine" = $13.99) and is not a claim.
  const spelled = { seventy: "70", eighty: "80", ninety: "90", fifty: "50", forty: "40", thirty: "30", twenty: "20" };
  for (const [word, digits] of Object.entries(spelled)) {
    const isStatClaim = new RegExp(`\\b${word}[\\s-]?(?:percent|per cent|%)`, "i").test(title);
    if (isStatClaim && !lower.includes(word) && !body.includes(digits)) {
      add("ERROR", edition, title, `headline claims "${word} percent" — body never supports it`);
    }
  }
  for (const n of titleNums) {
    if (n.length > 1 && !body.includes(n)) add("ERROR", edition, title, `headline number ${n} absent from body`);
  }

  // Ending
  const lastSentence = (body.match(/[^.!?]+[.!?]["']?\s*$/) ?? [""])[0].trim();
  if (lastSentence && !/[.!?]["']?$/.test(lastSentence)) add("ERROR", edition, title, `body ends mid-sentence`);
  for (const w of WEAK_ENDINGS) if (lastSentence.toLowerCase().startsWith(w)) add("warn", edition, title, `weak ending: "${w}"`);
  if (/\?["']?\s*$/.test(body)) add("warn", edition, title, `ends on a question`);

  // Pull quote
  if (pullQuote) {
    const words = pullQuote.trim().split(/\s+/).length;
    if (words > PULL_QUOTE_MAX_WORDS) add("warn", edition, title, `pull quote ${words} words (max ${PULL_QUOTE_MAX_WORDS})`);
    const norm = (t) => t.replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
    if (!norm(body).includes(norm(pullQuote))) add("ERROR", edition, title, `pull quote is not verbatim in the body`);
  }
}

for (const key of recentKeys()) {
  let html;
  try {
    const res = await fetch(`${SITE}/archive/${key}`, { headers: { "User-Agent": "DailySignal-ProseLint" } });
    if (!res.ok) continue;
    html = await res.text();
  } catch { continue; }

  const slugs = [...new Set([...html.matchAll(/\/article\/([A-Za-z0-9_-]{16,})/g)].map(m => m[1]))];
  for (const slug of slugs) {
    let page;
    try {
      const r = await fetch(`${SITE}/article/${slug}?e=${key}`, { headers: { "User-Agent": "DailySignal-ProseLint" } });
      if (!r.ok) continue;
      page = await r.text();
    } catch { continue; }

    const title = strip((page.match(/<h1[^>]*>([\s\S]{3,200}?)<\/h1>/) ?? [, ""])[1]);
    // Body paragraphs are the serif <p> blocks in the commentary section.
    // Exclude italic paragraphs: the pull quote is a verbatim lift rendered in Georgia italic,
    // so including it counts its em-dashes and phrases twice.
    const paras = [...page.matchAll(/<p([^>]*Georgia[^>]*)>([\s\S]*?)<\/p>/g)]
      .filter(m => !/font-style:\s*italic/.test(m[1]))
      .map(m => strip(m[2])).filter(t => t.length > 40);
    const quote = [...page.matchAll(/<p[^>]*font-style:\s*italic[^>]*>([\s\S]*?)<\/p>/g)].map(m => strip(m[1]))[0];
    if (!title || paras.length < 2) continue;
    lintArticle(key, title, paras.join(" "), quote);
  }
}

const errors = findings.filter(f => f.sev === "ERROR");
if (AS_JSON) {
  console.log(JSON.stringify({ ok: errors.length === 0, stats, findings }, null, 2));
} else {
  console.log(`  ${stats.articles} articles linted · ${stats.emDashes} em-dashes · ${stats.notXY} "Not X. Y." total`);
  if (!findings.length) console.log("\nOK — no mechanical craft problems");
  else {
    console.log(`\n${errors.length} error(s), ${findings.length - errors.length} warning(s):`);
    for (const f of [...errors, ...findings.filter(f => f.sev !== "ERROR")]) {
      console.log(`  ${f.sev === "ERROR" ? "!" : "-"} [${f.edition}] ${f.title}`);
      console.log(`      ${f.msg}`);
    }
  }
}
process.exit(errors.length ? 1 : 0);
