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
    `The damage roll <em>automatically</em> adds this scaling bonus (it replaces the normal ability ` +
    `bonus to damage), based on your ${scaleStat} modifier &mdash; ` +
    `<strong>+2:</strong> ${v2} &nbsp; <strong>+3:</strong> ${v3} &nbsp; <strong>+4:</strong> ${v4} &nbsp; <strong>+5:</strong> ${v5}.</p>` +
    `<p><strong>Upgrade:</strong> +${upgrade}. Andre reinforces with titanite up to +3 ` +
    `(+1 / +2 / +3 costs 1 / 2 / 3 Titanite Shards); each level adds +1 to attack and damage (applied automatically).</p>`
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

function weapon({ name, img, wtype, baseItem, n, d, dtypes, props = [], versatile = null, range = null, scaleStat, scaleAbil, grade, upgrade = 0, flavor, rarity = "", perk = "" }) {
  const acts = attackActivity(range ? "ranged" : "melee");
  acts.dnd5eactivity000.attack.ability = scaleAbil;
  acts.dnd5eactivity000.attack.bonus = upgrade ? String(upgrade) : "";
  // Damage = dice + auto weapon scaling + upgrade. Scaling = floor(stat mod * grade factor),
  // evaluated live from the wielder's sheet. includeBase stays false so dnd5e does NOT also add
  // the raw ability mod on top (the scaling number replaces it — no double-count).
  const scaleFormula = `floor(@abilities.${scaleAbil}.mod * ${FACTOR[grade]})`;
  const dmgBonus = upgrade ? `${scaleFormula} + ${upgrade}` : scaleFormula;
  acts.dnd5eactivity000.damage = {
    critical: { bonus: "" }, includeBase: false,
    parts: [{ number: n, denomination: d, bonus: dmgBonus, types: dtypes,
      custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }]
  };
  const versNote = versatile ? `<p><strong>Two-handed:</strong> ${versatile[0]}d${versatile[1]} instead.</p>` : "";
  const perkNote = perk ? `<p><strong>Unique:</strong> ${perk}</p>` : "";
  return {
    name, type: "weapon", img, effects: [],
    flags: { ashen: { scaling: { stat: scaleStat, ability: scaleAbil, grade, factor: FACTOR[grade] }, upgrade, unique: !!perk } },
    system: {
      description: { value: `<p><em>${flavor}</em></p>${perkNote}${versNote}${scalingBlock({ scaleStat, grade, upgrade })}`, chat: "" },
      source: source("DS3 weapon"),
      quantity: 1, weight: { value: 3, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: false, rarity, identified: true, container: null, crewed: false,
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

function blockTable(block) {
  const rows = Object.entries(block)
    .map(([type, pct]) => `<tr><td>${type[0].toUpperCase() + type.slice(1)}</td><td>${Math.round(pct * 100)}%</td></tr>`)
    .join("");
  return (
    `<p><strong>Block reduction (no roll):</strong> when you spend your reaction to Block, ` +
    `incoming damage of each type is reduced by this much, then dealt. Some moves are ` +
    `<em>unblockable</em> (100% through). A shield never staggers an enemy — that is parry's job.</p>` +
    `<table><tr><td><strong>Damage type</strong></td><td><strong>Reduced by</strong></td></tr>${rows}</table>`
  );
}

function armor({ name, img, atype, ac, dex = null, props = [], strength = null, stealth = false, damageReduction = 0, flavor, block = null, rarity = "", perk = "" }) {
  const dmgNote = damageReduction > 0 ? `<p><strong>Armor reduction:</strong> incoming damage reduced by <strong>${damageReduction}</strong> (minimum 1 damage).</p>` : "";
  const perkNote = perk ? `<p><strong>Unique:</strong> ${perk}</p>` : "";
  return {
    name, type: "equipment", img, effects: [], flags: block || damageReduction > 0 ? { ashen: { block, damageReduction, unique: !!perk } } : {},
    system: {
      description: { value: `<p><em>${flavor}</em></p>${perkNote}${dmgNote}${block ? blockTable(block) : ""}`, chat: "" },
      source: source("DS3 armor"),
      quantity: 1, weight: { value: 20, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: false, rarity, identified: true, container: null, crewed: false,
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

function focus({ name, img, schoolText, scaleStat, grade, flavor, upgrade = 0, rarity = "", perk = "" }) {
  const [v2, v3, v4, v5] = scalingValues(grade);
  const scaleNote =
    `<hr><p><strong>Catalyst Scaling:</strong> ${scaleStat} &mdash; Grade ${grade}. ` +
    `Add this to each spell's damage/healing based on your ${scaleStat} modifier &mdash; ` +
    `<strong>+2:</strong> ${v2} &nbsp; <strong>+3:</strong> ${v3} &nbsp; <strong>+4:</strong> ${v4} &nbsp; <strong>+5:</strong> ${v5}.</p>`;
  const upNote = upgrade ? `<p><strong>Reinforced +${upgrade}:</strong> add +${upgrade} to spell attack and spell damage.</p>` : "";
  const perkNote = perk ? `<p><strong>Unique:</strong> ${perk}</p>` : "";
  return {
    name, type: "equipment", img, effects: [],
    flags: { ashen: { catalyst: true, scaling: { stat: scaleStat, grade, factor: FACTOR[grade] }, upgrade, unique: !!perk } },
    system: {
      description: { value: `<p><em>${flavor}</em></p><p><strong>Spellcasting focus:</strong> ${schoolText}</p>${perkNote}${upNote}${scaleNote}`, chat: "" },
      source: source("DS3 catalyst"),
      quantity: 1, weight: { value: 2, units: "lb" }, price: { value: 0, denomination: "gp" },
      attunement: "", equipped: false, rarity, identified: true, container: null, crewed: false,
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
      quantity: 1, weight: { value: 0, units: "lb" }, price: { value: 600, denomination: "gp" },
      attunement: "", equipped: false, rarity: "", identified: true, container: null, crewed: false,
      type: { value: "trinket", subtype: "" }, properties: [],
      uses: { max: "1", spent: 0, recovery: [], autoDestroy: true },
      activities: {}, identifier: "ember"
    }
  };
}

function twinkling() {
  return {
    name: "Twinkling Titanite",
    type: "loot",
    img: "icons/commodities/gems/gem-faceted-radiant-blue.webp",
    effects: [], flags: {},
    system: {
      description: {
        value: "<p><em>A rare, shimmering titanite. Reinforces what ordinary shards cannot &mdash; unique blades and the Pyromancy Flame.</em></p><p><strong>Andre&rsquo;s forge:</strong> spend one to ascend a unique weapon or the Pyromancy Flame one reinforcement step beyond the reach of common titanite.</p>",
        chat: ""
      },
      source: source("DS3 material"),
      quantity: 1, weight: { value: 0.1, units: "lb" }, price: { value: 2000, denomination: "gp" },
      rarity: "rare", identified: true, container: null,
      type: { value: "material" }, properties: [],
      identifier: "twinkling-titanite"
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
  armor({ name: "Knight's Plate", img: "icons/equipment/chest/breastplate-helmet-metal.webp", atype: "heavy", ac: 18, dex: 0, strength: 15, stealth: true, damageReduction: 3, flavor: "Full steel — the Lothric ideal of defense." }),
  armor({ name: "Chainmail", img: "icons/equipment/chest/shirt-collared-chain-steel.webp", atype: "heavy", ac: 16, dex: 0, strength: 13, stealth: true, damageReduction: 2, flavor: "Interlocked rings, heavy but trusted." }),
  armor({ name: "Hard Leather Armor", img: "icons/equipment/chest/breastplate-cuirass-leather-brown.webp", atype: "light", ac: 11, dex: null, damageReduction: 1, flavor: "Boiled leather for those who'd rather move." }),
  armor({ name: "Knight Shield", img: "icons/equipment/shield/heater-steel-segmented-grey.webp", atype: "shield", ac: 2, flavor: "A solid steel shield — the heart of the Block reaction. It chips, it does not zero — a hard charge still gets a little through.", block: { physical: 0.70, fire: 0.40, lightning: 0.30, cold: 0.40, poison: 0.20 } }),
  armor({ name: "Wooden Buckler", img: "icons/equipment/shield/buckler-wooden-boss-steel.webp", atype: "shield", ac: 2, flavor: "Light and quick; better for parrying than turtling. Weak as a wall — it is a parry tool first.", block: { physical: 0.50, fire: 0.25, lightning: 0.20, cold: 0.25, poison: 0.10 } })
];

const FOCI = [
  focus({ name: "Sorcerer's Staff", img: "icons/weapons/staves/staff-simple-gold.webp", schoolText: "channels Sorceries (Intelligence).", scaleStat: "Intelligence", grade: "A", flavor: "A staff that draws out the soul's hidden power." }),
  focus({ name: "Talisman", img: "icons/magic/holy/saint-glass-portrait-halo.webp", schoolText: "channels Miracles (Faith).", scaleStat: "Faith", grade: "A", flavor: "A sacred medium for prayers to the gods." }),
  focus({ name: "Pyromancy Flame", img: "icons/magic/fire/flame-burning-hand-orange.webp", schoolText: "channels Pyromancies (scales with the higher of Intelligence or Faith).", scaleStat: "Int/Faith", grade: "B", flavor: "A smoldering glove cradling living flame; Andre tempers it with titanite." })
];

// ── Unique drops: bosses and the secret dragon drop these. They are the "ooh, a new toy" rewards. ──
const UNIQUES = [
  weapon({ name: "Halberd of the Champion", img: "icons/weapons/polearms/halberd-crescent-engraved-steel.webp", wtype: "martialM", baseItem: "halberd", n: 1, d: 10, dtypes: [SL, PI], props: ["hvy", "rch", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "B", upgrade: 1, rarity: "rare",
    flavor: "Gundyr's coiled halberd, freed from the Pus that took him. Long, sweeping, merciless.", perk: "Sweep: on a hit, you may also strike one adjacent foe for half damage. Reach 10 ft." }),
  weapon({ name: "Vordt's Great Hammer", img: "icons/weapons/maces/mace-spiked-heavy-blue.webp", wtype: "martialM", baseItem: "maul", n: 2, d: 6, dtypes: [BL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "A", upgrade: 1, rarity: "rare",
    flavor: "A frost-wreathed mace forged from the soul of the Boreal hound-knight.", perk: "Frost: on a hit, target gains 1 Frostbite stack. On a crit, knock Large-or-smaller prone." }),
  weapon({ name: "Drakeblood Greatsword", img: "icons/weapons/swords/greatsword-blue.webp", wtype: "martialM", baseItem: "greatsword", n: 2, d: 6, dtypes: [SL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "B", upgrade: 1, rarity: "rare",
    flavor: "A blade slick with dragon blood, taken from the rampart wyrm. Path C only.", perk: "Lightning bite: +1d8 lightning damage on a hit. Vordt is vulnerable to it." }),
  weapon({ name: "Uchigatana", img: "icons/weapons/swords/sword-katana-gray.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["fin", "ver"], versatile: [1, 10], scaleStat: "Dexterity", scaleAbil: "dex", grade: "A", rarity: "uncommon",
    flavor: "The Sword Master's keen katana. Rewards a clean, patient hand.", perk: "Bleed: third consecutive hit on the same target deals +1d6. Crit on 19-20." }),
  armor({ name: "Outrider Knight Armor", img: "icons/equipment/chest/breastplate-banded-steel-grey.webp", atype: "medium", ac: 15, dex: 2, damageReduction: 2, rarity: "rare",
    flavor: "Frost-rimed plate from the maddened Outrider. Light enough to keep moving.", perk: "Cold ward: you take no extra Frostbite from environmental cold auras." }),
  armor({ name: "Lothric Knight Greatshield", img: "icons/equipment/shield/oval-engraved-gold-grey.webp", atype: "shield", ac: 2, rarity: "rare",
    flavor: "A tall wall of steel — the wall's last guard carried it. Heavy, but it does not chip.", perk: "Greatshield: blocks one extra reaction-cost attack per round, unblockable still excepted.", block: { physical: 0.85, fire: 0.55, lightning: 0.45, cold: 0.55, poison: 0.30 } }),
  focus({ name: "Drake's Catalyst", img: "icons/weapons/staves/staff-ornate-eye.webp", schoolText: "channels Sorceries or Miracles (caster's choice).", scaleStat: "Int/Faith", grade: "A", upgrade: 1, rarity: "rare", flavor: "A horn catalyst pried from the bridge dragon's hoard, humming with power. Path C only.", perk: "Pre-tempered: already +1 to spell attack and damage; Andre may push it further." })
];

// ── Expanded findable arsenal: real DS3 weapons so each class has 3-4 things worth picking up. ──
// Plain props, no perks (those are the uniques); rarity scales the pickup excitement. Pulled from the DS3 wiki.
const EXTRA_WEAPONS = [
  // Straight swords (STR/DEX C, 1d8 ver) — Knight / quality
  weapon({ name: "Broadsword", img: "icons/weapons/swords/sword-guard-brass.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["ver"], versatile: [1, 10], scaleStat: "Strength", scaleAbil: "str", grade: "C", flavor: "A wide straight blade; wider arc, same reliable cut." }),
  weapon({ name: "Lothric Knight Sword", img: "icons/weapons/swords/sword-guard-blue.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["ver", "fin"], versatile: [1, 10], scaleStat: "Dexterity", scaleAbil: "dex", grade: "B", rarity: "uncommon", flavor: "The wall guards' standard sword; balanced and refined." }),
  weapon({ name: "Sunlight Straight Sword", img: "icons/weapons/swords/sword-guard-gold.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["ver"], versatile: [1, 10], scaleStat: "Strength", scaleAbil: "str", grade: "C", rarity: "uncommon", flavor: "Praise the sun. A warm, dependable blade of cooperation." }),
  weapon({ name: "Dark Sword", img: "icons/weapons/swords/greatsword-crossguard-steel.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["ver"], versatile: [1, 10], scaleStat: "Strength", scaleAbil: "str", grade: "B", rarity: "uncommon", flavor: "Heavy straight sword of the Darkwraiths; brutal for its class." }),
  // Greatswords (STR B, 2d6 hvy two)
  weapon({ name: "Claymore", img: "icons/weapons/swords/greatsword-blue.webp", wtype: "martialM", baseItem: "greatsword", n: 2, d: 6, dtypes: [SL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "B", flavor: "The classic knight's greatsword; reach and a wide sweep." }),
  weapon({ name: "Bastard Sword", img: "icons/weapons/swords/greatsword-crossguard.webp", wtype: "martialM", baseItem: "greatsword", n: 2, d: 6, dtypes: [SL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "B", flavor: "A blunt, brutal greatsword for raw strength." }),
  weapon({ name: "Wolnir's Holy Sword", img: "icons/weapons/swords/greatsword-blue-glow.webp", wtype: "martialM", baseItem: "greatsword", n: 2, d: 6, dtypes: [SL], props: ["hvy", "two"], scaleStat: "Faith", scaleAbil: "wis", grade: "B", rarity: "uncommon", flavor: "A holy greatsword that drinks the dark; scales with faith." }),
  // Ultra greatswords (STR A, 2d8 hvy two)
  weapon({ name: "Zweihander", img: "icons/weapons/swords/greatsword-twohanded.webp", wtype: "martialM", baseItem: "greatsword", n: 2, d: 8, dtypes: [SL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "A", rarity: "uncommon", flavor: "A massive flat blade; commit or be crushed." }),
  weapon({ name: "Astora Greatsword", img: "icons/weapons/swords/greatsword-flamberge.webp", wtype: "martialM", baseItem: "greatsword", n: 2, d: 8, dtypes: [SL], props: ["hvy", "two", "fin"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "B", rarity: "uncommon", flavor: "A lightweight ultra greatsword; surprisingly nimble." }),
  // Curved swords (DEX B, 1d6 fin lgt)
  weapon({ name: "Falchion", img: "icons/weapons/swords/scimitar-worn-blue.webp", wtype: "martialM", baseItem: "scimitar", n: 1, d: 6, dtypes: [SL], props: ["fin", "lgt"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "B", flavor: "A short curved blade; fast bleeding cuts." }),
  weapon({ name: "Pontiff Knight Curved Sword", img: "icons/weapons/swords/scimitar-guard-gold.webp", wtype: "martialM", baseItem: "scimitar", n: 1, d: 6, dtypes: [SL], props: ["fin", "lgt"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "A", rarity: "uncommon", flavor: "Frost-touched curved sword of the Pontiff's guard." }),
  // Katanas (DEX A, 1d8 fin)
  weapon({ name: "Washing Pole", img: "icons/weapons/swords/sword-katana.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["fin", "rch"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "A", rarity: "uncommon", flavor: "An absurdly long katana; reach for days." }),
  weapon({ name: "Black Blade", img: "icons/weapons/swords/sword-katana-blue.webp", wtype: "martialM", baseItem: "longsword", n: 1, d: 8, dtypes: [SL], props: ["fin", "ver"], versatile: [1, 10], scaleStat: "Dexterity", scaleAbil: "dex", grade: "A", rarity: "uncommon", flavor: "A shortened soul-blade; quick and deadly." }),
  // Thrusting swords (DEX C, 1d8 pi fin)
  weapon({ name: "Rapier", img: "icons/weapons/swords/sword-guard-purple.webp", wtype: "martialM", baseItem: "rapier", n: 1, d: 8, dtypes: [PI], props: ["fin"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "B", flavor: "Light thrusting sword; pokes from behind a shield." }),
  weapon({ name: "Ricard's Rapier", img: "icons/weapons/swords/sword-guard-gold.webp", wtype: "martialM", baseItem: "rapier", n: 1, d: 8, dtypes: [PI], props: ["fin"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "A", rarity: "uncommon", flavor: "An ornate rapier; flurries of precise thrusts." }),
  // Axes (STR C 1d8) / Greataxes (STR A 1d12)
  weapon({ name: "Hand Axe", img: "icons/weapons/axes/axe-broad-brown.webp", wtype: "martialM", baseItem: "handaxe", n: 1, d: 8, dtypes: [SL], props: ["lgt", "thr"], scaleStat: "Strength", scaleAbil: "str", grade: "C", flavor: "A plain woodsman's axe; cheap and dependable." }),
  weapon({ name: "Battle Axe", img: "icons/weapons/axes/axe-broad-black.webp", wtype: "martialM", baseItem: "battleaxe", n: 1, d: 8, dtypes: [SL], props: ["ver"], versatile: [1, 10], scaleStat: "Strength", scaleAbil: "str", grade: "C", flavor: "A bearded war-axe; solid in any hand." }),
  weapon({ name: "Dragonslayer Greataxe", img: "icons/weapons/axes/axe-double-engraved-red.webp", wtype: "martialM", baseItem: "greataxe", n: 1, d: 12, dtypes: [SL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "A", rarity: "uncommon", flavor: "A storm-charged greataxe; crushes guards." }),
  weapon({ name: "Yhorm's Machete", img: "icons/weapons/axes/axe-battle-worn.webp", wtype: "martialM", baseItem: "greataxe", n: 1, d: 12, dtypes: [SL], props: ["two"], scaleStat: "Strength", scaleAbil: "str", grade: "B", flavor: "A giant's crude machete; pure heft." }),
  // Hammers (STR C) / Great hammers (STR A 2d6)
  weapon({ name: "Reinforced Club", img: "icons/weapons/clubs/club-banded.webp", wtype: "simpleM", baseItem: "club", n: 1, d: 6, dtypes: [BL], props: ["lgt"], scaleStat: "Strength", scaleAbil: "str", grade: "C", flavor: "A club studded with iron; the Deprived's upgrade." }),
  weapon({ name: "Morning Star", img: "icons/weapons/maces/mace-spiked-steel.webp", wtype: "martialM", baseItem: "morningstar", n: 1, d: 8, dtypes: [PI], scaleStat: "Strength", scaleAbil: "str", grade: "C", flavor: "Spiked head; bleeds and bludgeons." }),
  weapon({ name: "Great Mace", img: "icons/weapons/maces/mace-round-spiked-black.webp", wtype: "martialM", baseItem: "maul", n: 2, d: 6, dtypes: [BL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "A", flavor: "A two-handed crushing maul; armor means nothing." }),
  weapon({ name: "Large Club", img: "icons/weapons/clubs/club-heavy-barbed.webp", wtype: "martialM", baseItem: "maul", n: 2, d: 6, dtypes: [BL], props: ["hvy", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "A", flavor: "A massive tree-trunk club; slow, devastating." }),
  // Spears (DEX/STR C 1d6 rch) / Halberds (B 1d10 rch)
  weapon({ name: "Partizan", img: "icons/weapons/polearms/spear-flared-steel.webp", wtype: "martialM", baseItem: "spear", n: 1, d: 8, dtypes: [PI], props: ["thr", "rch"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "C", flavor: "A winged spear; thrusts with a wide guard." }),
  weapon({ name: "Winged Spear", img: "icons/weapons/polearms/spear-simple-white.webp", wtype: "martialM", baseItem: "spear", n: 1, d: 6, dtypes: [PI], props: ["thr", "rch", "ver"], versatile: [1, 8], scaleStat: "Dexterity", scaleAbil: "dex", grade: "C", flavor: "A long reach spear; keep them at bay." }),
  weapon({ name: "Halberd", img: "icons/weapons/polearms/halberd-crescent-steel.webp", wtype: "martialM", baseItem: "halberd", n: 1, d: 10, dtypes: [SL, PI], props: ["hvy", "rch", "two"], scaleStat: "Strength", scaleAbil: "str", grade: "B", flavor: "Axe-head on a pole; sweep or thrust." }),
  weapon({ name: "Glaive", img: "icons/weapons/polearms/glaive-simple.webp", wtype: "martialM", baseItem: "glaive", n: 1, d: 10, dtypes: [SL], props: ["hvy", "rch", "two"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "B", flavor: "A sweeping blade-on-pole; favors dexterity." }),
  // Daggers / fists
  weapon({ name: "Bandit's Knife", img: "icons/weapons/daggers/dagger-curved-poison-green.webp", wtype: "simpleM", baseItem: "dagger", n: 1, d: 4, dtypes: [SL], props: ["fin", "lgt", "thr"], scaleStat: "Dexterity", scaleAbil: "dex", grade: "A", flavor: "A bleeding gut-hook knife for backstabs." }),
  weapon({ name: "Caestus", img: "icons/weapons/fist/fist-knuckle-spiked.webp", wtype: "simpleM", baseItem: "club", n: 1, d: 4, dtypes: [BL], props: ["lgt"], scaleStat: "Strength", scaleAbil: "str", grade: "D", flavor: "Iron knuckles; a parry tool in a pinch." }),
  // Bows / crossbows
  weapon({ name: "Long Bow", img: "icons/weapons/bows/longbow-recurve-brown.webp", wtype: "martialR", baseItem: "longbow", n: 1, d: 8, dtypes: [PI], props: ["amm", "two"], range: [150, 600], scaleStat: "Dexterity", scaleAbil: "dex", grade: "C", flavor: "Tall hunting bow; reach across the arena." }),
  weapon({ name: "Composite Bow", img: "icons/weapons/bows/shortbow-leather.webp", wtype: "martialR", baseItem: "shortbow", n: 1, d: 6, dtypes: [PI], props: ["amm", "two"], range: [100, 400], scaleStat: "Dexterity", scaleAbil: "dex", grade: "B", flavor: "Short bow that fires while moving." }),
  weapon({ name: "Heavy Crossbow", img: "icons/weapons/crossbows/crossbow-heavy-brown.webp", wtype: "martialR", baseItem: "heavycrossbow", n: 1, d: 10, dtypes: [PI], props: ["amm", "lod", "two", "hvy"], range: [100, 400], scaleStat: "Strength", scaleAbil: "str", grade: "D", flavor: "Punishing bolts; slow to crank." }),
  weapon({ name: "Arbalest", img: "icons/weapons/crossbows/crossbow-purple.webp", wtype: "martialR", baseItem: "heavycrossbow", n: 1, d: 12, dtypes: [PI], props: ["amm", "lod", "two", "hvy"], range: [120, 480], scaleStat: "Strength", scaleAbil: "str", grade: "D", rarity: "uncommon", flavor: "Siege-grade crossbow; one heavy shot." })
];

const EXTRA_FOCI = [
  focus({ name: "Heretic's Staff", img: "icons/weapons/staves/staff-skull-purple.webp", schoolText: "channels Sorceries (Intelligence).", scaleStat: "Intelligence", grade: "S", rarity: "uncommon", flavor: "A fragile staff of pure raw power; high scaling, no upgrades." }),
  focus({ name: "Cleric's Sacred Chime", img: "icons/magic/holy/chalice-glowing-gold.webp", schoolText: "channels Miracles (Faith).", scaleStat: "Faith", grade: "B", flavor: "A simple chime; sound it to invoke miracles." }),
  focus({ name: "Sunlight Talisman", img: "icons/magic/holy/yin-yang-balance-symbol.webp", schoolText: "channels Miracles (Faith).", scaleStat: "Faith", grade: "A", rarity: "uncommon", flavor: "A warrior's talisman; faster casting under pressure." }),
  focus({ name: "Great Swamp Pyromancy Flame", img: "icons/magic/fire/flame-burning-fist-orange.webp", schoolText: "channels Pyromancies (Int/Faith).", scaleStat: "Int/Faith", grade: "A", rarity: "uncommon", flavor: "A fiercer flame from the Great Swamp; burns hotter." })
];

// ── Shields with distinct guard profiles. Block %s are the per-type reduction. ──
const EXTRA_SHIELDS = [
  armor({ name: "Kite Shield", img: "icons/equipment/shield/heater-steel-worn.webp", atype: "shield", ac: 2, flavor: "Balanced steel kite shield; a dependable all-rounder.", block: { physical: 0.80, fire: 0.40, lightning: 0.30, cold: 0.45, poison: 0.30 } }),
  armor({ name: "Black Knight Shield", img: "icons/equipment/shield/heater-crystal-black.webp", atype: "shield", ac: 2, rarity: "uncommon", flavor: "Charred shield of the Black Knights; eats fire for breakfast.", block: { physical: 0.90, fire: 0.95, lightning: 0.30, cold: 0.50, poison: 0.30 } }),
  armor({ name: "Dragon Crest Shield", img: "icons/equipment/shield/round-dragon-gold.webp", atype: "shield", ac: 2, rarity: "uncommon", flavor: "A dragon-marked shield; flame washes off it.", block: { physical: 0.75, fire: 1.00, lightning: 0.50, cold: 0.45, poison: 0.30 } }),
  armor({ name: "Silver Knight Shield", img: "icons/equipment/shield/round-segmented-silver.webp", atype: "shield", ac: 2, rarity: "uncommon", flavor: "Anor Londo silver; turns aside lightning and steel.", block: { physical: 1.00, fire: 0.50, lightning: 0.70, cold: 0.50, poison: 0.30 } }),
  armor({ name: "Spider Shield", img: "icons/equipment/shield/round-wooden-boss-green.webp", atype: "shield", ac: 2, flavor: "A crude shield warded against venom.", block: { physical: 0.70, fire: 0.30, lightning: 0.30, cold: 0.30, poison: 0.95 } }),
  armor({ name: "Grass Crest Shield", img: "icons/equipment/shield/heater-crest-green.webp", atype: "shield", ac: 2, flavor: "Light shield famed for stamina — a parry-leaning small shield.", block: { physical: 0.65, fire: 0.30, lightning: 0.40, cold: 0.30, poison: 0.20 } }),
  armor({ name: "Frost-Ward Shield", img: "icons/equipment/shield/kite-steel-blue.webp", atype: "shield", ac: 2, rarity: "uncommon", flavor: "Boreal-forged; the cold cannot pass it.", block: { physical: 0.80, fire: 0.40, lightning: 0.40, cold: 1.00, poison: 0.30 } })
];


async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const all = [
    ...WEAPONS, ...ARMOR, ...FOCI, ...UNIQUES, ...EXTRA_WEAPONS, ...EXTRA_FOCI, ...EXTRA_SHIELDS,
    estus(), firebomb(), ember(),
    loot({ name: "Estus Shard", img: "icons/commodities/gems/gem-faceted-radiant-orange.webp", subtype: "material", price: 1000, flavor: "A shard of an Estus Flask; the Fire Keeper can use it to add a charge." }),
    loot({ name: "Titanite Shard", img: "icons/commodities/metal/ingot-stamped-silver.webp", subtype: "material", price: 200, flavor: "Reinforces equipment. Andre needs these to upgrade weapons." }),
    loot({ name: "Titanite Chunk", img: "icons/commodities/metal/ingot-stamped-gold.webp", subtype: "material", price: 800, flavor: "Heavier titanite for greater reinforcement." }),
    twinkling()
  ];
  for (const d of all) {
    await writeFile(path.join(OUT, slug(d.name) + ".json"), JSON.stringify(d, null, 2));
  }
  console.log("Generated " + all.length + " gear items.");
}

main().catch((e) => { console.error(e); process.exit(1); });
