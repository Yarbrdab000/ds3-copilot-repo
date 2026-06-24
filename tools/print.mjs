#!/usr/bin/env node
/**
 * Ashen printable export.
 *
 * Renders selected DM journal pages to standalone, print-ready HTML you can open
 * in any browser and Ctrl-P — no Foundry, no internet, no tokens/art needed.
 * It's a paper backup for the table: the combat loop and every boss grid on
 * pages you can lay next to the screen.
 *
 * The HTML is pulled straight from the same source JSON the module ships, so the
 * printout can never drift from what's in Foundry.
 *
 * Usage:
 *   node tools/print.mjs                 build every target
 *   node tools/print.mjs cheat-card      just the one-page combat cheat card
 *   node tools/print.mjs boss-grids      just the consolidated boss move grids
 *   node tools/print.mjs battle-kit      cheat card + grids in one file
 *   node tools/print.mjs list            show the available targets
 *
 * Output: print-out/*.html  (gitignored)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "print-out");

const HANDBOOK = "src/journals/handbook/dm-handbook.json";
const CODEX = "src/journals/handbook/dm-codex-bestiary.json";

const CHEAT_CARD = "Combat Cheat Card (Print Me)";
const BOSS_GRIDS = "Boss Quick-Grids — Every Moveset at a Glance";

/** Each target = one printable HTML file built from one or more journal pages. */
const TARGETS = {
  "cheat-card": {
    file: "combat-cheat-card.html",
    title: "Ashen — Combat Cheat Card",
    subtitle: "Keep this next to the screen. Everything you need to run a swing.",
    sources: [{ journal: HANDBOOK, pages: [CHEAT_CARD] }]
  },
  "boss-grids": {
    file: "boss-quick-grids.html",
    title: "Ashen — Boss Quick-Grids",
    subtitle: "Every boss moveset on one sheet. Read the move, read the grid, call it.",
    sources: [{ journal: CODEX, pages: [BOSS_GRIDS] }]
  },
  "battle-kit": {
    file: "battle-kit.html",
    title: "Ashen — DM Battle Kit",
    subtitle: "The cheat card, then every boss grid. Print double-sided and run the table.",
    sources: [
      { journal: HANDBOOK, pages: [CHEAT_CARD] },
      { journal: CODEX, pages: [BOSS_GRIDS] }
    ]
  }
};

const CSS = `
:root { --ink:#1c1a17; --muted:#6b6157; --line:#bdb3a5; --ember:#b4541f; --panel:#f4efe6; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  margin: 0; color: var(--ink); background: #fff;
  font: 14px/1.5 "Segoe UI", Calibri, system-ui, sans-serif;
}
.sheet { max-width: 8.2in; margin: 0 auto; padding: 0.5in 0.55in; }
.doc-head { border-bottom: 3px solid var(--ember); margin-bottom: 14px; padding-bottom: 8px; }
.doc-head h1 { font-size: 26px; margin: 0; color: var(--ember); letter-spacing: .3px; }
.doc-head .sub { color: var(--muted); font-size: 13px; margin-top: 3px; }
.toolbar { margin: 10px 0 18px; }
.toolbar button {
  font: inherit; cursor: pointer; border: 1px solid var(--ember); color: #fff;
  background: var(--ember); border-radius: 5px; padding: 7px 14px;
}
.toolbar .hint { color: var(--muted); font-size: 12px; margin-left: 10px; }
section.page { break-after: page; }
section.page:last-child { break-after: auto; }
h2 { font-size: 20px; color: var(--ember); border-bottom: 1px solid var(--line);
     padding-bottom: 4px; margin: 22px 0 10px; }
h3 { font-size: 16px; margin: 16px 0 6px; }
p { margin: 7px 0; }
em { color: var(--muted); font-style: italic; }
ul, ol { margin: 7px 0 7px 22px; padding: 0; }
li { margin: 3px 0; }
hr { border: none; border-top: 1px solid var(--line); margin: 16px 0; }
table { border-collapse: collapse; margin: 6px 0 12px; width: auto; break-inside: avoid; }
td, th { border: 1px solid var(--line); padding: 4px 9px; text-align: center; font-size: 13px; }
tr:first-child td, td:first-child { background: var(--panel); font-weight: 600; }
/* keep a move's label paragraph attached to its grid */
p + table { break-before: avoid; }
blockquote { margin: 8px 0; padding: 6px 12px; border-left: 3px solid var(--ember);
             background: var(--panel); color: var(--ink); }
.foot { margin-top: 26px; padding-top: 8px; border-top: 1px solid var(--line);
        color: var(--muted); font-size: 11px; }
@media print {
  @page { size: letter; margin: 0.5in; }
  .toolbar { display: none; }
  .sheet { max-width: none; padding: 0; }
  a[href]:after { content: ""; }
}
`;

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

async function loadJournal(rel) {
  const raw = await readFile(path.join(ROOT, rel), "utf8");
  return JSON.parse(raw);
}

function findPage(journal, name) {
  const page = journal.pages.find((p) => p.name === name);
  if (!page) {
    const have = journal.pages.map((p) => `"${p.name}"`).join(", ");
    throw new Error(`page "${name}" not found in "${journal.name}".\n  available: ${have}`);
  }
  return page;
}

async function renderTarget(key, mod) {
  const t = TARGETS[key];
  const blocks = [];
  for (const src of t.sources) {
    const journal = await loadJournal(src.journal);
    for (const name of src.pages) {
      const page = findPage(journal, name);
      const heading = page.title?.show ? `<h2>${esc(page.name)}</h2>` : "";
      blocks.push(`<section class="page">\n${heading}\n${page.text.content}\n</section>`);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="sheet">
  <div class="doc-head">
    <h1>${esc(t.title)}</h1>
    <div class="sub">${esc(t.subtitle)}</div>
  </div>
  <div class="toolbar">
    <button onclick="window.print()">Print this sheet</button>
    <span class="hint">or just press Ctrl/Cmd&#8201;+&#8201;P</span>
  </div>
  ${blocks.join("\n\n")}
  <div class="foot">
    ${esc(mod.title)} v${esc(mod.version)} · generated ${today} · legend: — ordinary block ·
    half lesser shield halves · chip heavy hit chips through · X unblockable.
    Personal, non-commercial fan project; D&amp;D mechanics use SRD 5.1.
  </div>
</div>
</body>
</html>
`;
  const outPath = path.join(OUT_DIR, t.file);
  await writeFile(outPath, html, "utf8");
  return outPath;
}

async function main() {
  const arg = (process.argv[2] ?? "all").toLowerCase();

  if (arg === "list") {
    console.log("[ashen] print targets:");
    for (const [k, t] of Object.entries(TARGETS)) console.log(`  ${k.padEnd(12)} -> print-out/${t.file}`);
    return;
  }

  const keys = arg === "all" ? Object.keys(TARGETS) : [arg];
  for (const k of keys) {
    if (!TARGETS[k]) {
      console.error(`[ashen] unknown target "${k}". Try one of: ${Object.keys(TARGETS).join(", ")}, all, list`);
      process.exit(1);
    }
  }

  const mod = JSON.parse(await readFile(path.join(ROOT, "module.json"), "utf8"));
  await mkdir(OUT_DIR, { recursive: true });

  for (const k of keys) {
    const out = await renderTarget(k, mod);
    console.log(`[ashen] wrote ${path.relative(ROOT, out)}`);
  }
  console.log(`[ashen] done — open the file(s) in any browser and print. No Foundry needed.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
