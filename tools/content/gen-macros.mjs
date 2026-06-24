#!/usr/bin/env node
/**
 * Generator for the Ashen macros pack. Editable SOURCE for src/macros/.
 * Re-run `node tools/content/gen-macros.mjs`.
 *
 * Macro commands are plain JS executed inside Foundry v13 / dnd5e v5. They lean on a single
 * "Bonfire Ledger" actor (flag ashen.role === "souls") that stores banked/carried/bloodstain
 * soul totals as flags, so the souls economy is schema-independent and easy to reset.
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../src/macros");

// Shared helper source, prepended into each macro command.
const HELPERS = `
const A = globalThis;
function getLedger() {
  let a = game.actors.find(x => x.getFlag("ashen", "role") === "souls");
  if (!a) a = game.actors.getName("Bonfire Ledger");
  if (!a) ui.notifications.warn("Ashen: no 'Bonfire Ledger' actor found. Import the Ashen actors pack.");
  return a;
}
async function getSouls(a, k) { return Number(a?.getFlag("ashen", k) ?? 0); }
async function setSouls(a, k, v) { return a.setFlag("ashen", k, Math.max(0, Math.round(v))); }
async function askNumber(title, label) {
  const content = '<form><div class="form-group"><label>' + label + '</label>' +
    '<input type="number" name="n" value="0" autofocus/></div></form>';
  return await new Promise((resolve) => {
    new Dialog({
      title, content,
      buttons: {
        ok: { label: "OK", callback: (h) => resolve(Number(h[0].querySelector('[name=n]').value) || 0) },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok", close: () => resolve(null)
    }).render(true);
  });
}
`;

const MACROS = [
  {
    name: "Ashen: Assemble Adventure",
    img: "icons/sundries/books/book-stack.webp",
    body: `
const MODULE_ID = "ashen-of-lothric";
const packs = game.packs.filter(p => p.metadata.packageName === MODULE_ID);
if (!packs.length) return ui.notifications.error("Ashen: module compendiums not found. Enable the 'Ashen' module in Settings \\u2192 Manage Modules first, then re-run this macro.");

const FPREFIX = "Ashen \\u2014 ";
const alreadyHere = game.folders.filter(f => f.name && f.name.indexOf(FPREFIX) === 0);
let mode = "fresh";
if (alreadyHere.length) {
  mode = await new Promise((resolve) => {
    new Dialog({
      title: "Assemble Adventure \\u2014 already assembled?",
      content: "<p>This world already has <b>" + alreadyHere.length + "</b> Ashen folder(s) \\u2014 it looks like the adventure was assembled here before.</p>" +
        "<p><b>Fill gaps</b> imports only what is missing (safe, no duplicates). <b>Re-import all</b> brings everything in again and may create duplicates.</p>",
      buttons: {
        skip: { label: "Fill gaps (safe)", callback: () => resolve("skip") },
        force: { label: "Re-import all", callback: () => resolve("force") },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "skip", close: () => resolve(null)
    }).render(true);
  });
  if (!mode) return;
} else {
  const proceed = await Dialog.confirm({
    title: "Assemble Adventure",
    content: "<p>Import <b>all Ashen content</b> (" + packs.length + " compendiums) into this world, each in its own labelled folder?</p><p>Takes a few seconds. Safe to re-run later \\u2014 it will not duplicate what is already here.</p>"
  });
  if (!proceed) return;
}

let imported = 0, skipped = 0, failed = 0;
for (const pack of packs) {
  const folderName = String(pack.metadata.label || pack.metadata.name).replace(/^Ashen:\\s*/, FPREFIX);
  const folder = game.folders.find(f => f.type === pack.metadata.type && f.name === folderName);
  const have = folder ? (folder.contents?.length ?? 0) : 0;
  if (mode === "skip" && have > 0) { skipped += have; continue; }
  try {
    const docs = await pack.importAll({ folderName });
    const n = Array.isArray(docs) ? docs.length : (pack.index?.size ?? 0);
    imported += n;
    ui.notifications.info("Ashen: imported " + folderName + " (" + n + ").");
  } catch (e) {
    failed++;
    console.error("Ashen assemble error for " + pack.collection, e);
    ui.notifications.warn("Ashen: failed to import " + folderName + " (see console).");
  }
}

// Make the souls tracker work out of the box: ensure the Bonfire Ledger has its flags initialised.
const ledger = game.actors.find(x => x.getFlag("ashen", "role") === "souls") || game.actors.getName("Bonfire Ledger");
if (ledger) {
  for (const k of ["banked", "carried", "bloodstain"]) {
    if (ledger.getFlag("ashen", k) == null) await ledger.setFlag("ashen", k, 0);
  }
}

const lines = ["<h3>Adventure assembled.</h3>"];
lines.push("<p>Imported <b>" + imported + "</b> document(s)" +
  (skipped ? ", skipped <b>" + skipped + "</b> already present" : "") +
  (failed ? ", <b>" + failed + "</b> pack(s) failed (see console)" : "") +
  ". Find them under the <b>Ashen \\u2014</b> folders in the Journals, Actors, Items, Scenes, Tables and Macros tabs.</p>");
lines.push("<p><b>Start here:</b> open the <b>Rules Bible</b>, then the <b>DM Handbook</b> (read its Quick-Start page), have each player grab a <b>Pregen</b>, and drag <b>1 \\u00b7 Cemetery of Ash</b> onto the canvas.</p>");
lines.push("<p>The shared souls live on the <b>Bonfire Ledger</b> actor \\u2014 drive it with the Ashen tracker macros (Award / Bank / Spend / Bonfire Rest), never by hand.</p>");
if (!ledger) lines.push("<p style=\\"color:#a33\\"><b>Heads up:</b> no Bonfire Ledger actor found \\u2014 make sure the <b>Pregen Characters</b> pack imported (it carries the ledger).</p>");
ChatMessage.create({ content: lines.join("") });
ui.notifications.info("Ashen: assembly complete \\u2014 " + imported + " imported" + (skipped ? ", " + skipped + " skipped" : "") + (failed ? ", " + failed + " failed" : "") + ".");
`
  },
  {
    name: "Ashen: Award Souls",
    img: "icons/commodities/currency/coins-plain-gold.webp",
    body: `
const a = getLedger(); if (!a) return;
const n = await askNumber("Award Souls", "Souls gained (added to CARRIED):");
if (n === null) return;
const carried = await getSouls(a, "carried");
await setSouls(a, "carried", carried + n);
ui.notifications.info("Ashen: +" + n + " souls. Carried = " + (carried + n) + ".");
ChatMessage.create({ content: "<b>+" + n + " souls</b> reclaimed from the fallen. Carried pool: " + (carried + n) + "." });
`
  },
  {
    name: "Ashen: Bank Souls (at Bonfire)",
    img: "icons/commodities/currency/coins-stack-gold.webp",
    body: `
const a = getLedger(); if (!a) return;
const carried = await getSouls(a, "carried");
const banked = await getSouls(a, "banked");
await setSouls(a, "banked", banked + carried);
await setSouls(a, "carried", 0);
ui.notifications.info("Ashen: banked " + carried + " souls. Banked total = " + (banked + carried) + ".");
ChatMessage.create({ content: "The party banks <b>" + carried + " souls</b> at the bonfire. Banked (safe): " + (banked + carried) + "." });
`
  },
  {
    name: "Ashen: Spend Banked Souls",
    img: "icons/commodities/currency/coin-embossed-skull-gold.webp",
    body: `
const a = getLedger(); if (!a) return;
const n = await askNumber("Spend Banked Souls", "Souls to spend (shop / upgrade):");
if (n === null) return;
const banked = await getSouls(a, "banked");
if (n > banked) return ui.notifications.warn("Ashen: not enough banked souls (have " + banked + ").");
await setSouls(a, "banked", banked - n);
ui.notifications.info("Ashen: spent " + n + ". Banked = " + (banked - n) + ".");
ChatMessage.create({ content: "Spent <b>" + n + " souls</b>. Banked remaining: " + (banked - n) + "." });
`
  },
  {
    name: "Ashen: Level Up",
    img: "icons/magic/symbols/runes-star-orange.webp",
    body: `
const a = getLedger(); if (!a) return;
const COST = { 4: 500, 5: 800, 6: 1200, 7: 1800, 8: 2600, 9: 3600, 10: 5000 };
const buttons = {};
for (const [lvl, c] of Object.entries(COST)) {
  buttons["l" + lvl] = {
    label: "\u2192 L" + lvl + " (" + c + ")",
    callback: async () => {
      const banked = await getSouls(a, "banked");
      if (c > banked) return ui.notifications.warn("Ashen: need " + c + " banked souls, have " + banked + ".");
      await setSouls(a, "banked", banked - c);
      ChatMessage.create({ content: "A character ascends to <b>Level " + lvl + "</b> (-" + c + " souls). " +
        "Bump your class level, then make your Ashen pick from the Level-Up Menu Card for L" + (lvl - 1) + " \u2192 " + lvl + "." });
      ui.notifications.info("Ashen: leveled to " + lvl + ". Banked = " + (banked - c) + ".");
    }
  };
}
new Dialog({ title: "Level Up at the Fire Keeper", content: "<p>Choose the level to purchase (cost in banked souls):</p>", buttons, default: "l4" }).render(true);
`
  },
  {
    name: "Ashen: Drop Bloodstain (on Wipe)",
    img: "icons/svg/blood.svg",
    body: `
const a = getLedger(); if (!a) return;
const carried = await getSouls(a, "carried");
await setSouls(a, "bloodstain", carried);
await setSouls(a, "carried", 0);
ChatMessage.create({ content: "<b>YOU DIED.</b> " + carried + " souls remain as a bloodstain at the place of death. " +
  "Reclaim them on your way back \u2014 but if you fall again first, they are lost forever." });
ui.notifications.warn("Ashen: bloodstain dropped (" + carried + " souls). Carried reset to 0.");
`
  },
  {
    name: "Ashen: Reclaim Bloodstain",
    img: "icons/svg/regen.svg",
    body: `
const a = getLedger(); if (!a) return;
const stain = await getSouls(a, "bloodstain");
if (stain <= 0) return ui.notifications.info("Ashen: no bloodstain to reclaim.");
const carried = await getSouls(a, "carried");
await setSouls(a, "carried", carried + stain);
await setSouls(a, "bloodstain", 0);
ChatMessage.create({ content: "Bloodstain recovered: <b>+" + stain + " souls</b>. Carried pool: " + (carried + stain) + "." });
ui.notifications.info("Ashen: reclaimed " + stain + " souls.");
`
  },
  {
    name: "Ashen: Bonfire Rest",
    img: "icons/sundries/lights/torch-brown-lit.webp",
    body: `
const tokens = canvas.tokens.controlled.filter(t => t.actor);
if (!tokens.length) ui.notifications.info("Ashen: select party tokens to auto long-rest them (optional).");
for (const t of tokens) {
  try { await t.actor.longRest({ dialog: false, chat: false }); } catch (e) { /* group/npc actors may not rest */ }
}
ChatMessage.create({ content: "<h3>Bonfire lit.</h3><ul>" +
  "<li>HP restored; <b>Estus</b> refilled; <b>spell charges</b> refilled.</li>" +
  "<li>Exhaustion &amp; status build-up (Frostbite) cleared.</li>" +
  "<li><b>All non-boss enemies in the area respawn.</b></li>" +
  "<li>At Firelink you may spend banked souls to level up.</li></ul>" });
ui.notifications.info("Ashen: bonfire rest applied. Remember to respawn cleared enemies.");
`
  },
  {
    name: "Ashen: Add Frostbite Stack",
    img: "icons/magic/water/snowflake-ice-blue-white.webp",
    body: `
const t = canvas.tokens.controlled[0];
if (!t?.actor) return ui.notifications.warn("Ashen: select one token first.");
const THRESH = 5;
const cur = Number(t.actor.getFlag("ashen", "frostbite") ?? 0) + 1;
if (cur >= THRESH) {
  await t.actor.setFlag("ashen", "frostbite", 0);
  const exh = (t.actor.system?.attributes?.exhaustion ?? 0) + 1;
  try { await t.actor.update({ "system.attributes.exhaustion": exh }); } catch (e) {}
  ChatMessage.create({ content: "<b>" + t.actor.name + "</b>'s frostbite bar FILLS \u2014 a level of <b>Exhaustion</b> sets in, and the bar resets." });
} else {
  await t.actor.setFlag("ashen", "frostbite", cur);
  ChatMessage.create({ content: t.actor.name + " gains a frostbite stack (" + cur + "/" + THRESH + ")." });
}
`
  },
  {
    name: "Ashen: Kindle (Ember)",
    img: "icons/magic/fire/flame-burning-embers-orange.webp",
    body: `
const t = canvas.tokens.controlled[0];
if (!t?.actor) return ui.notifications.warn("Ashen: select your token first.");
const bonus = 10;
const hp = t.actor.system?.attributes?.hp;
if (!hp) return ui.notifications.warn("Ashen: this actor has no HP to kindle.");
await t.actor.update({ "system.attributes.hp.tempmax": (hp.tempmax || 0) + bonus, "system.attributes.hp.value": hp.value + bonus });
await t.actor.setFlag("ashen", "kindled", true);
ChatMessage.create({ content: "<b>" + t.actor.name + "</b> kindles the bonfire \u2014 +" + bonus + " maximum HP until death." });
ui.notifications.info("Ashen: kindled (+" + bonus + " max HP). Removed on death.");
`
  }
];

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const m of MACROS) {
    const doc = {
      name: m.name,
      type: "script",
      scope: "global",
      command: (HELPERS + "\n" + m.body).trim() + "\n",
      img: m.img,
      author: null,
      flags: { ashen: { kind: "macro" } }
    };
    await writeFile(path.join(OUT, slug(m.name.replace("Ashen: ", "")) + ".json"), JSON.stringify(doc, null, 2));
  }
  console.log("Generated " + MACROS.length + " macros.");
}

main().catch((e) => { console.error(e); process.exit(1); });
