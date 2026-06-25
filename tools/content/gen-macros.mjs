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
  },
  {
    name: "Ashen: Spend a Cinder",
    img: "icons/magic/fire/flame-burning-fist-orange.webp",
    body: `
async function getRes(x, slot) { return Number(x?.system?.resources?.[slot]?.value ?? 0); }
async function setRes(x, slot, v, max) { const u = {}; u["system.resources." + slot + ".value"] = Math.max(0, Math.round(v)); if (max != null) u["system.resources." + slot + ".max"] = Math.max(0, Math.round(max)); return x.update(u); }
const a = getLedger(); if (!a) return;
const cur = await getRes(a, "primary");
if (cur <= 0) {
  return Dialog.prompt({ title: "No Cinders left", label: "Understood",
    content: "<p>The party is <b>out of Cinders</b>. The next fall is final \u2014 this is the moment the stakes turn real. (DM Handbook: <i>Cinders \u2014 How to Run Them</i>.)</p>" });
}
const ok = await Dialog.confirm({ title: "Spend a Cinder",
  content: "<p>Spend one Cinder to raise a fallen hero (or respawn after a wipe)?</p><p>Cinders: <b>" + cur + "</b> \u2192 <b>" + (cur - 1) + "</b>.</p>" });
if (!ok) return;
const left = cur - 1;
await setRes(a, "primary", left);
let msg = "<b>A Cinder is spent.</b> Ash stirs, and a fallen Unkindled rises. Cinders remaining: <b>" + left + "</b>.";
if (left === 0) msg += " <span style=\\"color:#a33\\">That was the last one \u2014 from here, death is final.</span>";
else if (left <= 2) msg += " <i>The fire is guttering.</i>";
ChatMessage.create({ content: msg });
ui.notifications.info("Ashen: Cinder spent. " + left + " remaining.");
`
  },
  {
    name: "Ashen: Boss Defeated",
    img: "icons/skills/melee/strike-sword-blood-red.webp",
    body: `
async function getRes(x, slot) { return Number(x?.system?.resources?.[slot]?.value ?? 0); }
async function setRes(x, slot, v, max) { const u = {}; u["system.resources." + slot + ".value"] = Math.max(0, Math.round(v)); if (max != null) u["system.resources." + slot + ".max"] = Math.max(0, Math.round(max)); return x.update(u); }
const a = getLedger(); if (!a) return;
const tier = await getRes(a, "secondary");
const newTier = Math.min(3, tier + 1);
const souls = await askNumber("Boss Defeated", "Souls to award the party (added to CARRIED). 0 to skip:");
if (souls === null) return;
if (souls > 0) { const carried = await getSouls(a, "carried"); await setSouls(a, "carried", carried + souls); }
if (newTier !== tier) await setRes(a, "secondary", newTier, 3);
const parts = ["<h3>A great soul is claimed.</h3>"];
if (souls > 0) parts.push("<p><b>+" + souls + " souls</b> to the carried pool \u2014 bank them at the bonfire before you push on.</p>");
if (newTier !== tier) parts.push("<p>The Firelink shops sense it: <b>Shop Tier " + tier + " \u2192 " + newTier + "</b>. Andre and the Handmaid lay out greater wares (see <i>Firelink Services</i>).</p>");
else parts.push("<p>Shop Tier already at its cap (<b>3</b>).</p>");
parts.push("<p style=\\"opacity:.8\\">Remember: each boss/mini-boss also frees a budget of <b>Cinders</b> \u2014 see the DM Handbook.</p>");
ChatMessage.create({ content: parts.join("") });
ui.notifications.info("Ashen: boss down \u2014 Shop Tier " + newTier + (souls > 0 ? (", +" + souls + " souls") : "") + ".");
`
  },
  {
    name: "Ashen: New Run / Reset Bonfire",
    img: "icons/magic/fire/flame-burning-campfire-yellow.webp",
    body: `
async function getRes(x, slot) { return Number(x?.system?.resources?.[slot]?.value ?? 0); }
async function setRes(x, slot, v, max) { const u = {}; u["system.resources." + slot + ".value"] = Math.max(0, Math.round(v)); if (max != null) u["system.resources." + slot + ".max"] = Math.max(0, Math.round(max)); return x.update(u); }
const a = getLedger(); if (!a) return;
const players = await askNumber("New Run \u2014 Reset the Bonfire", "How many players? (Cinders = 4 \u00d7 players)");
if (players === null) return;
const cind = players > 0 ? players * 4 : 0;
const ok = await Dialog.confirm({ title: "Reset for a fresh run?",
  content: "<p>This will:</p><ul>" +
    "<li>Set <b>Cinders</b> to <b>" + cind + "</b> (" + players + " \u00d7 4).</li>" +
    "<li>Reset <b>Shop Tier</b> to <b>0</b>.</li>" +
    "<li>Zero <b>carried / banked / bloodstain</b> souls.</li>" +
    "<li>Long-rest every pregen (full HP, Estus &amp; spell charges; clears Frostbite, kindle &amp; temp HP).</li>" +
    "</ul><p>Use it to start a new game, or to reset between the two sessions of a two-shot.</p>" });
if (!ok) return;
await setRes(a, "primary", cind, cind);
await setRes(a, "secondary", 0, 3);
for (const k of ["carried", "banked", "bloodstain"]) await setSouls(a, k, 0);
let rested = 0;
for (const act of game.actors) {
  if (act === a) continue;
  if (act.getFlag("ashen", "role") === "souls") continue;
  if (act.type !== "character") continue;
  try { await act.longRest({ dialog: false, chat: false }); rested++; } catch (e) {}
  try { await act.update({ "system.attributes.hp.tempmax": 0 }); } catch (e) {}
  try { await act.setFlag("ashen", "frostbite", 0); } catch (e) {}
  try { await act.unsetFlag("ashen", "kindled"); } catch (e) {}
}
ChatMessage.create({ content: "<h3>A new flame is lit.</h3><p>Cinders set to <b>" + cind + "</b>, Shop Tier reset to <b>0</b>, souls cleared, and <b>" + rested + "</b> pregen(s) restored to full.</p><p><i>The cycle begins again. Don't go Hollow.</i></p>" });
ui.notifications.info("Ashen: new run ready \u2014 Cinders " + cind + ", " + rested + " pregens rested.");
`
  },
  {
    name: "Ashen: Teardown / Reset World",
    img: "icons/magic/unholy/strike-beam-blood-red-purple.webp",
    body: `
const MODULE_ID = "ashen-of-lothric";
const FPREFIX = "Ashen \\u2014 ";
if (!game.user.isGM) return ui.notifications.warn("Ashen: only the GM can run Teardown.");

// World collections this macro manages (primary documents only).
const COLLS = [
  ["Actor", game.actors, "Actors"],
  ["Item", game.items, "Items"],
  ["JournalEntry", game.journal, "Journals"],
  ["Scene", game.scenes, "Scenes"],
  ["RollTable", game.tables, "Roll Tables"],
  ["Macro", game.macros, "Macros"],
  ["Playlist", game.playlists, "Playlists"]
];

// A doc is "Ashen" if it was imported from our compendium (v12/v13 _stats marker
// or v11 sourceId flag) or lives in an "Ashen \\u2014" folder. We deliberately do NOT
// match on flags.ashen, so a player's own token that picked up a frostbite/kindle
// flag is never deleted.
function isAshen(doc) {
  const cs = doc?._stats?.compendiumSource;
  if (typeof cs === "string" && cs.indexOf("Compendium." + MODULE_ID + ".") === 0) return true;
  const sid = doc?.flags?.core?.sourceId;
  if (typeof sid === "string" && sid.indexOf("Compendium." + MODULE_ID + ".") === 0) return true;
  const fn = doc?.folder?.name;
  if (typeof fn === "string" && fn.indexOf(FPREFIX) === 0) return true;
  return false;
}

const mode = await new Promise((resolve) => {
  new Dialog({
    title: "Ashen \\u2014 Teardown / Reset World",
    content: "<p>Remove imported Ashen content from <b>this world</b> so you can re-import a clean copy. " +
      "Your module compendiums (the source) are <b>not</b> touched \\u2014 this only clears what was imported here. " +
      "Use it between test runs whenever a system needs adjusting.</p>" +
      "<p><b>Reset content</b> keeps the macro toolbar, so you can immediately re-run <i>Assemble Adventure</i> " +
      "(pick <i>Fill gaps</i>) for the fastest loop. <b>Full wipe</b> removes everything including macros &amp; folders; " +
      "reload the world afterwards and the welcome prompt re-imports a fresh copy (use this after updating the module).</p>",
    buttons: {
      keep: { label: "Reset content (keep macros)", callback: () => resolve("keep") },
      full: { label: "Full wipe (everything)", callback: () => resolve("full") },
      cancel: { label: "Cancel", callback: () => resolve(null) }
    },
    default: "keep", close: () => resolve(null)
  }).render(true);
});
if (!mode) return;

const targets = {};
let total = 0;
const summary = [];
for (const [type, coll, label] of COLLS) {
  if (mode === "keep" && type === "Macro") continue;
  const ids = coll.filter(isAshen).map((d) => d.id);
  if (ids.length) { targets[type] = { coll, ids }; total += ids.length; summary.push(ids.length + " " + label); }
}
const ashenSceneIds = new Set(targets["Scene"]?.ids ?? []);
const folders = game.folders.filter((f) =>
  typeof f.name === "string" && f.name.indexOf(FPREFIX) === 0 && (mode === "full" || f.type !== "Macro"));

if (!total && !folders.length) return ui.notifications.info("Ashen: nothing to tear down \\u2014 no imported Ashen content in this world.");

const confirm = await Dialog.confirm({
  title: "Confirm teardown \\u2014 this cannot be undone",
  content: "<p>Permanently delete from this world:</p><p><b>" + (summary.join(", ") || "0 documents") + "</b>" +
    (folders.length ? (" and <b>" + folders.length + "</b> Ashen folder(s)") : "") + ".</p>" +
    "<p>Re-import any time with <b>Assemble Adventure</b>" + (mode === "full" ? " or by reloading the world" : "") + ".</p>"
});
if (!confirm) return;

// If the canvas is showing a scene we're about to delete, switch away first.
try {
  if (canvas?.scene && ashenSceneIds.has(canvas.scene.id)) {
    const other = game.scenes.find((s) => !ashenSceneIds.has(s.id));
    if (other) await other.view();
  }
} catch (e) { /* deleting the active scene still works; canvas just clears */ }

// Drop any combats tied to the scenes we're removing.
try {
  const combatIds = game.combats.filter((c) => c.scene && ashenSceneIds.has(c.scene.id)).map((c) => c.id);
  if (combatIds.length) await Combat.deleteDocuments(combatIds);
} catch (e) { console.error("Ashen teardown: combat cleanup", e); }

let deleted = 0;
for (const [type, entry] of Object.entries(targets)) {
  try { await entry.coll.documentClass.deleteDocuments(entry.ids); deleted += entry.ids.length; }
  catch (e) { console.error("Ashen teardown: failed deleting " + type, e); ui.notifications.warn("Ashen: some " + type + " could not be deleted (see console)."); }
}
try {
  const fids = folders.map((f) => f.id);
  if (fids.length) await Folder.deleteDocuments(fids);
} catch (e) { console.error("Ashen teardown: folder cleanup", e); }

ChatMessage.create({ content: "<h3>World reset.</h3><p>Removed <b>" + deleted + "</b> Ashen document(s)" +
  (folders.length ? (" and " + folders.length + " folder(s)") : "") + " from this world.</p>" +
  "<p>" + (mode === "full"
    ? "Reload the world (F5) and accept the welcome prompt to re-import a fresh copy, or run <b>Assemble Adventure</b> from the Ashen Macros compendium."
    : "Run <b>Ashen: Assemble Adventure</b> (choose <i>Fill gaps</i>) to import a fresh copy.") + "</p>" });
ui.notifications.info("Ashen: teardown complete \\u2014 " + deleted + " document(s) removed.");
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
