#!/usr/bin/env node
/**
 * Generator for the Ashen gear pack (items-gear): weapons, armor, shields, catalysts,
 * Estus, consumables, embers, upgrade materials. Editable SOURCE for src/items/gear/.
 * Re-run `node tools/content/gen-gear.mjs`.
 *
 * These standalone items double as the source the pregens copy/embed, and as the
 * Shrine Handmaid's stock. dnd5e v5 schema (weapon/equipment/consumable/loot).
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../src/items/gear");

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function source(custom) { return { book: "Ashen", page: "", custom, license: "CC-BY-4.0", rules: "2014" }; }

// ── Weapon scaling & upgrade math (single source of truth) ──
// Scaling grade -> factor. Per-hit scaling damage = floor(governing modifier * factor).
// This REPLACES 5e's normal "add ability mod to damage" step (no double-count): the Foundry
// weapon rolls dice + upgrade only, and the player adds the one grid number for their stat.
const FACTOR = { S: 2, A: 1.5, B: 1, C: 0.75, D: 0.5, E: 0.25 };
function scalingValues(grade) { return [2, 3, 4, 5].map((m) => Math.floor(m * FACTOR[grade])); }
function scalingBlock({ scaleStat, grade, upgrade }) {
  const [v2, v3, v4, v5] = scalingValues(grade);
  return (
    `<hr><p><strong>Scaling:</strong> ${scaleStat} &mdash; Grade ${grade}. ` +
    `Add this scaling bonus to each hit (it replaces the normal ability bonus to damage) ` +
    `based on your ${scaleStat} modifier &mdash; ` +
    `<strong>+2:</strong> ${v2} &nbsp; <strong>+3:</strong> ${v3} &nbsp; <strong>+4:</strong> ${v4} &nbsp; <strong>+5:</strong> ${v5}.</p>` +
    `<p><strong>Upgrade:</strong> +${upgrade}. Andre reinforces with titanite up to +3 ` +
    `(+1 / +2 / +3 costs 1 / 2 / 3 Titanite Shards); each level adds +1 to attack and damage.</p>`
  );
}

function attackActivity(kind) {
  return {
    dnd5eactivity000: {
      _id: "dnd5eactivity000", type: "attack", name: "", img: "", sort: 0,
      activation: { type: "action", value: 1, condition: "", override: false },
      consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: false },
      description: { chatFlavor: "" },
      duration: { concentration: false, value: "", units: "inst", special: "", override: false },
      effects: [],
      range: { value: "", units: "", special: "", override: false },
      target: { template: { contiguous: false, units: "ft", type: "" }, affects: { choice: false }, override: false, prompt: true },
      uses: { spent: 0, max: "", recovery: [] },
      attack: { ability: "", bonus: "", critical: { threshold: null }, flat: false, type: { value: kind, classification: "weapon" } },
      damage: { critical: { bonus: "" }, includeBase: true, parts: [] }
    }
  };
}

function weapon({ name, img, wtype, baseItem, n, d, dtypes, props = [], versatile = null, range = null, scaleStat, scaleAbil, grade, upgrade = 0, flavor }) {
  const acts = attackActivity(range ? "ranged" : "melee");
  acts.dnd5eactivity000.attack.ability = scaleAbil;
  acts.dnd5eactivity000.attack.bonus = upgrade ? String(upgrade) : "";
  // Damage = dice + upgrade only (no auto ability mod); scaling is added by hand from the grid.
  acts.dnd5eactivity000.damage = {
    critical: { bonus: "" }, includeBase: false,
    parts: [{ number: n, denomination: d, bonus: upgrade ? String(upgrade) : "", types: dtypes,
      custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }]
  };
  const versNote = versatile ? `<p><strong>Two-handed:</strong> ${versatile[0]}d${versatile[1]} instead.</p>` : "";
  return {
    name, type: "weapon", img, effects: [],
    flags: { ashen: { scaling: { stat: scaleStat, ability: scaleAbil, grade, factor: FACTOR[grade] }, upgrade } },
    system: {
      description: { value: `<p><em>${flavor}</em></p>${versNote}${scalingBlock({ scaleStat, grade, upgrade })}`, chat: "" },
      source: source("DS3 weapon"),
      quantity: 1, weight: { value: 3, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: false, rarity: "", identified: true, container: null, crewed: false,
      range: range ? { value: String(range[0]), long: String(range[1]), units: "ft", reach: null }
                    : { value: null, long: null, units: "ft", reach: null },
      uses: { max: "", recovery: [], spent: 0 },
      damage: {
        base: { number: n, denomination: d, bonus: "", types: dtypes,
          custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } },
        versatile: versatile
          ? { number: versatile[0], denomination: versatile[1], bonus: "", types: dtypes, custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }
          : { number: null, denomination: null, bonus: "", types: [], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }
      },
      properties: props,
      proficient: null,
      type: { value: wtype, baseItem },
      activities: acts,
      identifier: slug(name)
    }
  };
}

function armor({ name, img, atype, ac, dex = null, props = [], strength = null, stealth = false, flavor }) {
  return {
    name, type: "equipment", img, effects: [], flags: {},
    system: {
      description: { value: `<p><em>${flavor}</em></p>`, chat: "" },
      source: source("DS3 armor"),
      quantity: 1, weight: { value: 20, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: false, rarity: "", identified: true, container: null, crewed: false,
      armor: { value: ac, dex, magicalBonus: null },
      type: { value: atype, baseItem: "" },
      properties: stealth ? ["stealthDisadvantage", ...props] : props,
      proficient: null,
      strength: strength,
      uses: { max: "", recovery: [], spent: 0 },
      activities: {},
      identifier: slug(name)
    }
  };
}

function focus({ name, img, schoolText, scaleStat, grade, flavor }) {
  const [v2, v3, v4, v5] = scalingValues(grade);
  const scaleNote =
    `<hr><p><strong>Catalyst Scaling:</strong> ${scaleStat} &mdash; Grade ${grade}. ` +
    `Add this to each spell's damage/healing based on your ${scaleStat} modifier &mdash; ` +
    `<strong>+2:</strong> ${v2} &nbsp; <strong>+3:</strong> ${v3} &nbsp; <strong>+4:</strong> ${v4} &nbsp; <strong>+5:</strong> ${v5}.</p>`;
  return {
    name, type: "equipment", img, effects: [],
    flags: { ashen: { catalyst: true, scaling: { stat: scaleStat, grade, factor: FACTOR[grade] } } },
    system: {
      description: { value: `<p><em>${flavor}</em></p><p><strong>Spellcasting focus:</strong> ${schoolText}</p>${scaleNote}`, chat: "" },
      source: source("DS3 catalyst"),
      quantity: 1, weight: { value: 2, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: false, rarity: "", identified: true, container: null, crewed: false,
      armor: { value: null, dex: null, magicalBonus: null },
      type: { value: "trinket", baseItem: "" },
      properties: ["foc"],
      proficient: null, strength: null,
      uses: { max: "", recovery: [], spent: 0 },
      activities: {},
      identifier: slug(name)
    }
  };
}

function estus() {
  return {
    name: "Estus Flask", type: "consumable", img: "icons/consumables/potions/bottle-bulb-corked-glowing-orange.webp",
    effects: [], flags: { ashen: { estus: true } },
    system: {
      description: { value: "<p><em>An emerald flask, ever full of warm Estus. The Unkindled's lifeline.</em></p><p><strong>Quaff (action, or bonus action with Estus Mastery):</strong> regain 2d4+2 HP and spend 1 charge. Refills at a bonfire.</p>", chat: "" },
      source: source("DS3 Estus"),
      quantity: 1, weight: { value: 1, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: true, rarity: "", identified: true, container: null, crewed: false,
      type: { value: "potion", subtype: "" },
      properties: [],
      uses: { max: "3", spent: 0, recovery: [{ period: "lr", type: "recoverAll" }], autoDestroy: false },
      activities: {
        dnd5eactivity000: {
          _id: "dnd5eactivity000", type: "heal", name: "Quaff", img: "", sort: 0,
          activation: { type: "action", value: 1, condition: "", override: false },
          consumption: { targets: [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }], scaling: { allowed: false, max: "" }, spellSlot: false },
          description: { chatFlavor: "" },
          duration: { concentration: false, value: "", units: "inst", special: "", override: false },
          effects: [], range: { units: "self", special: "", override: false },
          target: { template: { contiguous: false, units: "ft", type: "" }, affects: { type: "self", choice: false }, override: false, prompt: true },
          healing: { number: 2, denomination: 4, bonus: "2", types: ["healing"], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } },
          uses: { spent: 0, recovery: [], max: "" }
        }
      },
      identifier: "estus-flask"
    }
  };
}

function firebomb() {
  return {
    name: "Firebomb", type: "consumable", img: "icons/weapons/thrown/bomb-fuse-blue.webp", effects: [], flags: {},
    system: {
      description: { value: "<p><em>A clay urn of black powder and pitch.</em></p><p><strong>Throw (range 30/60):</strong> Dex save in a 5-ft burst, 2d6 fire (half on save). Consumed on use.</p>", chat: "" },
      source: source("DS3 throwable"),
      quantity: 1, weight: { value: 1, units: "lb" }, price: { value: 50, denomination: "gp" },
      attunement: "", equipped: false, rarity: "", identified: true, container: null, crewed: false,
      type: { value: "trinket", subtype: "" }, properties: [],
      uses: { max: "1", spent: 0, recovery: [], autoDestroy: true },
      activities: {
        dnd5eactivity000: {
          _id: "dnd5eactivity000", type: "save", name: "Throw", img: "", sort: 0,
          activation: { type: "action", value: 1, condition: "", override: false },
          consumption: { targets: [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }], scaling: { allowed: false, max: "" }, spellSlot: false },
          description: { chatFlavor: "" },
          duration: { concentration: false, value: "", units: "inst", special: "", override: false },
          effects: [], range: { value: "30", long: "60", units: "ft", special: "", override: false },
          target: { template: { contiguous: false, units: "ft", type: "radius", size: "5" }, affects: { choice: false }, override: false, prompt: true },
          save: { ability: "dex", dc: { calculation: "", formula: "13" } },
          damage: { onSave: "half", parts: [{ number: 2, denomination: 6, bonus: "", types: ["fire"], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }] },
          uses: { spent: 0, recovery: [], max: "" }
        }
      },
      identifier: "firebomb"
    }
  };
}

function loot({ name, img, subtype, price, flavor }) {
  return {
    name, type: "loot", img, effects: [], flags: {},
    system: {
      description: { value: `<p><em>${flavor}</em></p>`, chat: "" },
      source: source("DS3 material"),
      quantity: 1, weight: { value: 0.1, units: "lb" }, price: { value: price, denomination: "gp" },
      rarity: "", identified: true, container: null,
      type: { value: subtype }, properties: [],
      identifier: slug(name)
    }
  };
}

function ember() {
  return {
    name: "Ember", type: "consumable", img: "icons/magic/fire/flame-burning-embers-orange.webp", effects: [], flags: { ashen: { ember: true } },
    system: {
      description: { value: "<p><em>A warm cinder, the last of someone's fire.</em></p><p><strong>Use at a bonfire (Kindle macro):</strong> gain +10 maximum HP until you die. Lost on death.</p>", chat: "" },
      source: source("DS3 ember"),
      quantity: 1, weight: { value: 0, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: false, rarity: "", identified: true, container: null, crewed: false,
      type: { value: "trinket", subtype: "" }, properties: [],
      uses: { max: "1", spent: 0, recovery: [], autoDestroy: true },
      activities: {}, identifier: "ember"
    }
  };
}

const SL = "slashing", PI = "piercing", BL = "bludgeoning";
const WEAPONS = [
  weapon({ name: "Longsword", img: "icons/weapons/swords/sword-guard-purple.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["ver"], versatile: [1, 10], scaleStat: "Strength", scaleAbil: "str", grade: "C", flavor: "A straight knight's sword, reliable in any hand." }),
  weapon({ name: "Greataxe", img: "icons/weapons/axes/axe-double-engraved-red.webp", wtype: "martialM", baseItem: "greataxe", n: 1, d: 12, dtypes: [SL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "A", flavor: "A brutal cleaver that rewards commitment \u2014 and raw strength." }),
  weapon({ name: "Scimitar", img: "icons/weapons/swords/scimitar-worn-blue.webp", wtype: "martialM", baseItem: "scimitar", n: 1, d: 6, dtypes: [SL], props: ["fin", "lgt"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "B", flavor: "A curved blade for the swift; pairs with another." }),
  weapon({ name: "Spear", img: "icons/weapons/polearms/spear-hooked-grey.webp", wtype: "martialM", baseItem: "spear", n: 1, d: 6, dtypes: [PI], props: ["thr", "ver"], versatile: [1, 8], scaleStat: "Dexterity", scaleAbil: "dex", grade: "C", flavor: "Reach and a shield \u2014 the herald's discipline." }),
  weapon({ name: "Dagger", img: "icons/weapons/daggers/dagger-curved-poison-green.webp", wtype: "simpleM", baseItem: "dagger", n: 1, d: 4, dtypes: [PI], props: ["fin", "lgt", "thr"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "A", flavor: "Quick, quiet, and lethal from the shadows \u2014 scales sharply with skill." }),
  weapon({ name: "Estoc", img: "icons/weapons/swords/sword-flanged-ler.webp", wtype: "martialM", baseItem: "rapier", n: 1, d: 8, dtypes: [PI], props: ["fin"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "C", flavor: "A stiff thrusting sword that finds the gaps in armor." }),
  weapon({ name: "Mace", img: "icons/weapons/maces/mace-round-steel.webp", wtype: "simpleM", baseItem: "mace", n: 1, d: 6, dtypes: [BL], scaleStat: "Strength", scaleAbil: "str", grade: "C", flavor: "Faith made heavy; it cares nothing for armor." }),
  weapon({ name: "Club", img: "icons/weapons/clubs/club-simple-barbed.webp", wtype: "simpleM", baseItem: "club", n: 1, d: 4, dtypes: [BL], props: ["lgt"], scaleStat: "Strength", scaleAbil: "str", grade: "E", flavor: "A length of wood. The Deprived's whole arsenal \u2014 it barely cares who swings it." }),
  weapon({ name: "Light Crossbow", img: "icons/weapons/crossbows/crossbow-simple-brown.webp", wtype: "simpleR", baseItem: "lightcrossbow", n: 1, d: 8, dtypes: [PI], props: ["amm", "lod", "two"], range: [80, 320], scaleStat: "Dexterity", scaleAbil: "dex", grade: "D", flavor: "Mechanical reach for the careful; the bolt does the work, not the arm." }),
  weapon({ name: "Shortbow", img: "icons/weapons/bows/shortbow-recurve-brown.webp", wtype: "simpleR", baseItem: "shortbow", n: 1, d: 6, dtypes: [PI], props: ["amm", "two"], range: [80, 320], scaleStat: "Dexterity", scaleAbil: "dex", grade: "C", flavor: "A hunter's bow for keeping distance." })
];

const ARMOR = [
  armor({ name: "Knight's Plate", img: "icons/equipment/chest/breastplate-helmet-metal.webp", atype: "heavy", ac: 18, dex: 0, strength: 15, stealth: true, flavor: "Full steel \u2014 the Lothric ideal of defense." }),
  armor({ name: "Chainmail", img: "icons/equipment/chest/shirt-collared-chain-steel.webp", atype: "heavy", ac: 16, dex: 0, strength: 13, stealth: true, flavor: "Interlocked rings, heavy but trusted." }),
  armor({ name: "Hard Leather Armor", img: "icons/equipment/chest/breastplate-cuirass-leather-brown.webp", atype: "light", ac: 11, dex: null, flavor: "Boiled leather for those who'd rather move." }),
  armor({ name: "Knight Shield", img: "icons/equipment/shield/heater-steel-segmented-grey.webp", atype: "shield", ac: 2, flavor: "A solid steel shield \u2014 the heart of the Block reaction." }),
  armor({ name: "Wooden Buckler", img: "icons/equipment/shield/buckler-wooden-boss-steel.webp", atype: "shield", ac: 2, flavor: "Light and quick; better for parrying than turtling." })
];

const FOCI = [
  focus({ name: "Sorcerer's Staff", img: "icons/weapons/staves/staff-simple-gold.webp", schoolText: "channels Sorceries (Intelligence).", scaleStat: "Intelligence", grade: "A", flavor: "A staff that draws out the soul's hidden power." }),
  focus({ name: "Talisman", img: "icons/magic/holy/saint-glass-portrait-halo.webp", schoolText: "channels Miracles (Faith).", scaleStat: "Faith", grade: "A", flavor: "A sacred medium for prayers to the gods." }),
  focus({ name: "Pyromancy Flame", img: "icons/magic/fire/flame-burning-hand-orange.webp", schoolText: "channels Pyromancies (scales with the higher of Intelligence or Faith).", scaleStat: "Int/Faith", grade: "B", flavor: "A smoldering glove cradling living flame; Andre tempers it with titanite." })
];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const all = [
    ...WEAPONS, ...ARMOR, ...FOCI,
    estus(), firebomb(), ember(),
    loot({ name: "Estus Shard", img: "icons/commodities/gems/gem-faceted-radiant-orange.webp", subtype: "material", price: 1000, flavor: "A shard of an Estus Flask; the Fire Keeper can use it to add a charge." }),
    loot({ name: "Titanite Shard", img: "icons/commodities/metal/ingot-stamped-silver.webp", subtype: "material", price: 200, flavor: "Reinforces equipment. Andre needs these to upgrade weapons." }),
    loot({ name: "Titanite Chunk", img: "icons/commodities/metal/ingot-stamped-gold.webp", subtype: "material", price: 800, flavor: "Heavier titanite for greater reinforcement." })
  ];
  for (const d of all) {
    await writeFile(path.join(OUT, slug(d.name) + ".json"), JSON.stringify(d, null, 2));
  }
  console.log("Generated " + all.length + " gear items.");
}

main().catch((e) => { console.error(e); process.exit(1); });
