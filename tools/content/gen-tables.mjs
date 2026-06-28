#!/usr/bin/env node
/**
 * Generator for the Ashen loot/economy RollTables (tables pack). Editable SOURCE for
 * src/tables/. Re-run `node tools/content/gen-tables.mjs`.
 *
 * Dice-driven loot: when an enemy dies, the DM rolls on the matching tier table instead of
 * hand-picking drops. Souls are fixed per tier (stated in each table description); the roll
 * decides the ITEM/material drop. Results are text (robust across imports) and name items that
 * live in the Ashen gear compendium, so the DM just drags the named item from there.
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../src/tables");
const D20 = "icons/svg/d20-black.svg";

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

/** rows: [ [lo, hi, "text"], ... ] or [ ["x", "text"] ] for single values. */
function table(name, img, description, rows) {
  let max = 0;
  const results = rows.map(([lo, hi, text]) => {
    const r = [Number(lo), Number(hi ?? lo)];
    max = Math.max(max, r[1]);
    return { type: "text", text: text ?? hi, description: "", img: D20, range: r, weight: 1, drawn: false, flags: {} };
  });
  return {
    name, img, description, formula: `1d${max}`, replacement: true, displayRoll: true, sort: 0, flags: {},
    results
  };
}

const TABLES = [
  table("Loot \u2014 Hollow (common)", "icons/creatures/skeletons/skeleton-worn-skull-tan.webp",
    "<p>Roll when a common Hollow dies. <strong>Souls: 30\u201360 (fixed).</strong> The roll decides any extra drop.</p>",
    [
      [1, 5, "Nothing but souls \u2014 just the kill (30\u201360 souls)."],
      [6, 7, "A handful of scrap: <strong>+15 bonus souls</strong>."],
      [8, 8, "<strong>Firebomb</strong> \u00d71 (drag from the gear compendium)."],
      [9, 9, "<strong>Titanite Shard</strong> \u00d71."],
      [10, 10, "<strong>Estus Shard fragment</strong> \u2014 the DM notes it; 3 fragments fuse into 1 Estus Shard."]
    ]),

  table("Loot \u2014 Elite (Manservant / Lothric Knight)", "icons/equipment/chest/breastplate-helmet-metal.webp",
    "<p>Roll when an elite dies. <strong>Souls: 100\u2013150 (fixed).</strong></p>",
    [
      [1, 3, "<strong>Titanite Shard</strong> \u00d71."],
      [4, 5, "<strong>Firebomb</strong> \u00d72."],
      [6, 6, "<strong>Ember</strong> \u00d71 (kindle at a bonfire for +10 max HP)."],
      [7, 7, "A weapon \u2014 roll on <em>Loot \u2014 Weapon Find</em>."],
      [8, 8, "<strong>Estus Shard</strong> \u00d71 (the Fire Keeper adds an Estus charge)."]
    ]),

  table("Loot \u2014 Weapon Find", "icons/weapons/swords/sword-guard-purple.webp",
    "<p>Which weapon dropped? All live in the Ashen gear compendium \u2014 drag the named one. Pick the closest fit to the finder's class if the table is kinder than the build.</p>",
    [
      [1, 1, "<strong>Longsword</strong> / <strong>Broadsword</strong>"],
      [2, 2, "<strong>Lothric Knight Sword</strong> (uncommon, quality)"],
      [3, 3, "<strong>Claymore</strong> or <strong>Bastard Sword</strong> (greatsword)"],
      [4, 4, "<strong>Zweihander</strong> / <strong>Astora Greatsword</strong> (ultra)"],
      [5, 5, "<strong>Scimitar</strong> / <strong>Falchion</strong> (curved)"],
      [6, 6, "<strong>Rapier</strong> / <strong>Estoc</strong> (thrusting)"],
      [7, 7, "<strong>Battle Axe</strong> / <strong>Hand Axe</strong>"],
      [8, 8, "<strong>Halberd</strong> or <strong>Glaive</strong> (reach)"],
      [9, 9, "<strong>Partizan</strong> / <strong>Winged Spear</strong>"],
      [10, 10, "<strong>Mace</strong> / <strong>Morning Star</strong>"],
      [11, 11, "<strong>Great Mace</strong> / <strong>Large Club</strong> (great hammer)"],
      [12, 12, "<strong>Dragonslayer Greataxe</strong> / <strong>Yhorm's Machete</strong>"],
      [13, 13, "<strong>Bandit's Knife</strong> / <strong>Dagger</strong>"],
      [14, 14, "<strong>Long Bow</strong> / <strong>Composite Bow</strong>"],
      [15, 15, "<strong>Heavy Crossbow</strong> / <strong>Arbalest</strong>"],
      [16, 16, "<strong>Dark Sword</strong> (uncommon)"],
      [17, 17, "<strong>Sunlight Straight Sword</strong> (uncommon)"],
      [18, 18, "<strong>Pontiff Knight Curved Sword</strong> (uncommon)"],
      [19, 19, "<strong>Washing Pole</strong> / <strong>Black Blade</strong> (katana)"],
      [20, 20, "<strong>Uchigatana</strong> or <strong>Ricard's Rapier</strong> (rare prize)"]
    ]),

  table("Loot \u2014 Shield Find", "icons/equipment/shield/heater-steel-segmented-grey.webp",
    "<p>Which shield turned up? Each has a different Block profile (see its card) \u2014 match it to the threat ahead.</p>",
    [
      [1, 2, "<strong>Kite Shield</strong> \u2014 balanced all-rounder."],
      [3, 3, "<strong>Grass Crest Shield</strong> \u2014 light, parry-leaning."],
      [4, 4, "<strong>Spider Shield</strong> \u2014 near-immune to poison."],
      [5, 5, "<strong>Dragon Crest Shield</strong> \u2014 eats fire."],
      [6, 6, "<strong>Frost-Ward Shield</strong> \u2014 stops cold cold."],
      [7, 7, "<strong>Black Knight Shield</strong> \u2014 high fire & physical."],
      [8, 8, "<strong>Silver Knight Shield</strong> \u2014 100% physical, strong lightning."]
    ]),

  table("Loot \u2014 Catalyst Find", "icons/weapons/staves/staff-simple-gold.webp",
    "<p>Which catalyst dropped/restocked?</p>",
    [
      [1, 1, "<strong>Sorcerer's Staff</strong> (sorceries / Intelligence)."],
      [2, 2, "<strong>Talisman</strong> (miracles / Faith)."],
      [3, 3, "<strong>Pyromancy Flame</strong> (pyromancies; Andre upgrades it)."]
    ]),

  table("Loot \u2014 Mini-boss (Outrider / Pus of Man)", "icons/creatures/abilities/mouth-teeth-rows-red.webp",
    "<p>Mini-boss kill. <strong>Souls: 1,000 (fixed)</strong> \u2014 plus a guaranteed drop. The Outrider always yields its armor; otherwise roll below.</p>",
    [
      [1, 1, "<strong>Outrider Knight Armor</strong> (unique, medium) \u2014 guaranteed off the Outrider; else Titanite Chunk \u00d72."],
      [2, 2, "<strong>Titanite Chunk</strong> \u00d71."],
      [3, 3, "<strong>Ember</strong> \u00d71."],
      [4, 4, "<strong>Estus Shard</strong> \u00d71."],
      [5, 5, "A catalyst \u2014 roll on <em>Loot \u2014 Catalyst Find</em>."],
      [6, 6, "<strong>Lothric Knight Greatshield</strong> (unique) \u2014 drops if a Lothric Knight elite was the kill."]
    ]),

  table("Loot \u2014 Major Boss (Gundyr / Vordt)", "icons/skills/melee/strike-weapon-polearm-ice-blue.webp",
    "<p>Major boss kill. The signature weapon is guaranteed; roll 1d4 for a bonus material.</p><p><strong>Iudex Gundyr:</strong> 2,500 souls + <strong>Halberd of the Champion</strong> (unique). <strong>Vordt:</strong> 3,000 souls + <strong>Vordt's Great Hammer</strong> (unique). Drag the named weapon from the gear compendium, then roll below.</p>",
    [
      [1, 2, "Bonus: <strong>Titanite Chunk</strong> \u00d72."],
      [3, 3, "Bonus: <strong>Ember</strong> \u00d72."],
      [4, 4, "Bonus: <strong>Twinkling Titanite</strong> \u00d71 (rare \u2014 ascend the unique drop here)."]
    ]),

  table("Loot \u2014 Dragon Hoard (secret, path C only)", "icons/creatures/reptiles/dragon-fire-breathing-orange.webp",
    "<p>Only if the party <em>hunts and kills</em> the bridge dragon. <strong>Souls: 3,000\u20134,000 (fixed)</strong> \u2014 plus the <strong>Drakeblood Greatsword</strong> (unique, guaranteed). Then roll for the rest of the hoard:</p>",
    [
      [1, 2, "<strong>Titanite Chunk</strong> \u00d73 \u2014 enough to push a weapon or the Pyromancy Flame up a tier."],
      [3, 4, "<strong>Ember</strong> \u00d72 and <strong>Twinkling Titanite</strong> \u00d71."],
      [5, 5, "<strong>Drake's Catalyst</strong> \u2014 a unique pre-upgraded catalyst (+1 spell attack & damage)."],
      [6, 6, "<strong>Jackpot:</strong> all of the above, plus a second <strong>Estus Shard</strong>."]
    ]),

  table("Loot \u2014 Titanite Find", "icons/commodities/metal/ingot-stamped-silver.webp",
    "<p>Generic upgrade-material roll (use for farm pockets or chests).</p>",
    [
      [1, 3, "<strong>Titanite Shard</strong> \u00d71."],
      [4, 5, "<strong>Titanite Chunk</strong> \u00d71."],
      [6, 6, "<strong>Twinkling Titanite</strong> \u00d71 (rare)."]
    ]),

  table("Shrine Handmaid \u2014 Restock", "icons/magic/holy/saint-glass-portrait-halo.webp",
    "<p>When the party returns to Firelink, roll to see what new stock the Handmaid offers (prices in the shop journal).</p>",
    [
      [1, 2, "<strong>Estus Shard</strong> now in stock (1,000 souls)."],
      [3, 3, "A <strong>catalyst</strong> in stock \u2014 roll <em>Catalyst Find</em> (1,500 souls)."],
      [4, 4, "<strong>Firebombs</strong> restocked, \u00d75 (50 souls each)."],
      [5, 5, "<strong>Titanite Shards</strong> \u00d73 (200 souls each)."],
      [6, 6, "<strong>Ember</strong> in stock (600 souls)."]
    ]),

  table("Farm Pocket \u2014 Hollow Courtyard", "icons/environment/settlement/wall-tower-gray.webp",
    "<p>The High Wall courtyard respawns on rest. Roll once per cleared wave to keep the grind interesting. <strong>Each wave \u2248 120\u2013240 souls (fixed).</strong></p>",
    [
      [1, 4, "Just souls \u2014 the grind pays out (120\u2013240)."],
      [5, 6, "A <strong>Hollow Manservant</strong> (elite) joins the next wave \u2014 roll <em>Loot \u2014 Elite</em> when it falls."],
      [7, 7, "<strong>Titanite Shard</strong> \u00d71 dropped in the muck."],
      [8, 8, "A <strong>bloodstain</strong> from a fallen Unkindled: <strong>+200 souls</strong> if reclaimed."]
    ])
];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const t of TABLES) {
    await writeFile(path.join(OUT, slug(t.name) + ".json"), JSON.stringify(t, null, 2));
  }
  console.log(`Generated ${TABLES.length} roll tables.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
