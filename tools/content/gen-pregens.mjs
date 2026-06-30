#!/usr/bin/env node
/**
 * Generator for the Ashen pregens pack (actors-pcs): 10 DS3 starting-class characters
 * at level 3. Editable SOURCE for src/actors/pcs/. Re-run `node tools/content/gen-pregens.mjs`.
 *
 * Each pregen is a dnd5e v5 character actor with an embedded class item (drives level /
 * proficiency), embedded equipment copied from the gear pack, a catalyst + two starting
 * spells (casters), and pre-invested Attribute cards. HP max is set explicitly (dnd5e uses a
 * non-null hp.max directly), so the sheet is correct on import without rebuilding advancement.
 */

import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "src/actors/pcs");

async function loadDir(dir) {
  const map = new Map();
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(path.join(dir, f), "utf8"));
    map.set(doc.name, doc);
  }
  return map;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

function classItem({ name, identifier, hitDice, saves, ability }) {
  return {
    name, type: "class", img: "icons/sundries/books/book-embossed-jewel-gold.webp",
    effects: [], flags: {},
    system: {
      identifier, levels: 3, hitDice, hitDiceUsed: 0,
      primaryAbility: { value: [ability].filter(Boolean), all: false },
      saves, skills: { number: 2, choices: [], value: [] },
      spellcasting: { progression: "none", ability: "" },
      description: { value: `<p>DS3 ${name} chassis. Level it up one step each time the party rests at the Fire Keeper.</p>` },
      source: { book: "Ashen", page: "", custom: "Pregen", license: "CC-BY-4.0", rules: "2014" },
      advancement: []
    }
  };
}

function baseActionsFeat() {
  return {
    name: "Base Actions (Strike / Dodge / Block / Parry)", type: "feat",
    img: "icons/skills/melee/blade-tips-triple-bronze.webp", effects: [], flags: {},
    system: {
      description: { value: "<p><strong>Strike</strong> \u2014 a weapon Attack. You get a 2nd strike at L5 (Extra Attack) and a 3rd once you've invested 3 points in your attack stat (Dex for finesse/ranged, Str for melee); cap 3. Dual-wielders add an off-hand strike as a bonus action.</p><p><strong>Dodge</strong> \u2014 always available, unlimited: flat d20 vs the move's Dodge DC, quality set by the window you call. Success negates damage and repositions 5 ft (end behind the foe \u2192 advantage next attack).</p><p><strong>Block</strong> \u2014 costs your reaction, <strong>no roll</strong>: deterministic per-damage-type reduction from your shield (see its card). It chips at low tiers and <strong>never staggers</strong>. Charges, shield-kicks and grabs are <em>unblockable</em> \u2014 sidestep the lane instead.</p><p><strong>Parry</strong> \u2014 costs your reaction: flat d20 vs the move's Parry DC; only the ideal window gives advantage, all others disadvantage. Success negates AND staggers (party riposte window); failure takes full damage. Only clean weapon swings are parryable.</p><p><em>Reaction economy:</em> Block &amp; Parry share your one reaction/round; Endurance/Poise 5 grants a second. Casters with Int/Faith 5 may fire one Tier-1 spell as a bonus action. See the Rules bible.</p>", chat: "" },
      source: { book: "Ashen", page: "", custom: "Core", license: "CC-BY-4.0", rules: "2014" },
      uses: { max: "", spent: 0, recovery: [] }, activities: {},
      type: { value: "feat", subtype: "" }, requirements: "Everyone",
      properties: [], enchant: {}, prerequisites: { level: null }, identifier: "base-actions"
    }
  };
}

const SK = (skills) => {
  const all = ["acr","ani","arc","ath","dec","his","ins","itm","inv","med","nat","prc","prf","per","rel","slt","ste","sur"];
  const abilityOf = { acr:"dex",ani:"wis",arc:"int",ath:"str",dec:"cha",his:"int",ins:"wis",itm:"cha",inv:"int",med:"wis",nat:"int",prc:"wis",prf:"cha",per:"cha",rel:"int",slt:"dex",ste:"dex",sur:"wis" };
  const out = {};
  for (const s of all) out[s] = { value: skills.includes(s) ? 1 : 0, ability: abilityOf[s], bonuses: { check: "", passive: "" } };
  return out;
};

// className labels for the class item come from DS3 flavor; identifier maps to a dnd5e class.
const PREGENS = [
  { n: "Knight", cls: "Fighter", id: "fighter", hd: "d10", saves: ["str","con"], save: "str",
    abil: { str: 15, dex: 10, con: 14, int: 10, wis: 11, cha: 9 }, hp: 30, spellAbility: "",
    gear: [["Longsword", true], ["Knight Shield", true], ["Knight's Plate", true]], skills: ["ath","prc"],
    attrs: ["Attribute: Vigor +1", "Attribute: Vigor +1"], spells: [], catalyst: null,
    role: "Tank", blurb: "A Lothric knight clad in steel. Holds the line, blocks for the party, and never breaks." },
  { n: "Warrior", cls: "Barbarian", id: "barbarian", hd: "d12", saves: ["str","con"], save: "str",
    abil: { str: 16, dex: 13, con: 15, int: 8, wis: 10, cha: 9 }, hp: 33, spellAbility: "",
    gear: [["Greataxe", true], ["Hard Leather Armor", true]], skills: ["ath","sur"],
    attrs: ["Attribute: Strength +1", "Attribute: Strength +1"], spells: [], catalyst: null,
    role: "Bruiser", blurb: "Raw strength and a heavy axe. Trades defense for terrifying damage on the commit." },
  { n: "Mercenary", cls: "Fighter", id: "fighter", hd: "d10", saves: ["str","con"], save: "dex",
    abil: { str: 10, dex: 16, con: 13, int: 11, wis: 10, cha: 9 }, hp: 26, spellAbility: "",
    gear: [["Scimitar", true], ["Scimitar", true], ["Hard Leather Armor", true]], skills: ["acr","prc"],
    attrs: ["Attribute: Dexterity +1"], spells: [], catalyst: null,
    role: "Skirmisher", blurb: "Twin curved blades and constant motion. Dances around foes, punishing every opening." },
  { n: "Herald", cls: "Paladin", id: "paladin", hd: "d10", saves: ["wis","cha"], save: "wis",
    abil: { str: 14, dex: 10, con: 14, int: 9, wis: 13, cha: 12 }, hp: 28, spellAbility: "wis",
    gear: [["Spear", true], ["Knight Shield", true], ["Chainmail", true]], skills: ["ath","rel"],
    attrs: ["Attribute: Faith +1"], spells: ["Heal Aid", "Lightning Spear"], catalyst: "Talisman",
    role: "Battle-healer", blurb: "Spear, shield, and faith. Fights in the front rank and keeps the party standing." },
  { n: "Thief", cls: "Rogue", id: "rogue", hd: "d8", saves: ["dex","int"], save: "dex",
    abil: { str: 9, dex: 16, con: 12, int: 12, wis: 11, cha: 10 }, hp: 21, spellAbility: "",
    gear: [["Dagger", true], ["Dagger", true], ["Hard Leather Armor", true], ["Shortbow", false]], skills: ["ste","acr","slt","prc"],
    attrs: ["Attribute: Dexterity +1"], spells: [], catalyst: null,
    role: "Striker", blurb: "Daggers from the dark. Lives for the backstab \u2014 Sneak Attack rewards good positioning." },
  { n: "Assassin", cls: "Rogue", id: "rogue", hd: "d8", saves: ["dex","int"], save: "dex",
    abil: { str: 9, dex: 15, con: 12, int: 14, wis: 10, cha: 11 }, hp: 21, spellAbility: "int",
    gear: [["Estoc", true], ["Hard Leather Armor", true]], skills: ["ste","arc","acr","dec"],
    attrs: ["Attribute: Dexterity +1"], spells: ["Soul Arrow", "Hidden Body"], catalyst: "Sorcerer's Staff",
    role: "Trickster", blurb: "Blade and a touch of sorcery. Slips out of sight, then strikes from nowhere." },
  { n: "Sorcerer", cls: "Wizard", id: "wizard", hd: "d6", saves: ["int","wis"], save: "int",
    abil: { str: 8, dex: 13, con: 12, int: 16, wis: 11, cha: 10 }, hp: 18, spellAbility: "int",
    gear: [["Sorcerer's Staff", true], ["Dagger", false]], skills: ["arc","his","inv"],
    attrs: ["Attribute: Intelligence +1"], spells: ["Soul Arrow", "Heavy Soul Arrow"], catalyst: "Sorcerer's Staff",
    role: "Arcane DPS", blurb: "A glass cannon of soul magic. Devastating at range, desperately fragile up close." },
  { n: "Pyromancer", cls: "Sorcerer", id: "sorcerer", hd: "d6", saves: ["con","cha"], save: "cha",
    abil: { str: 9, dex: 13, con: 13, int: 11, wis: 10, cha: 15 }, hp: 20, spellAbility: "cha",
    gear: [["Pyromancy Flame", true], ["Dagger", true], ["Hard Leather Armor", true]], skills: ["arc","nat"],
    attrs: ["Attribute: Attunement +1"], spells: ["Fire Orb", "Poison Mist"], catalyst: "Pyromancy Flame",
    role: "Blaster", blurb: "Living flame in the palm. Throws fire by the fistful \u2014 Andre can stoke it stronger." },
  { n: "Cleric", cls: "Cleric", id: "cleric", hd: "d8", saves: ["wis","cha"], save: "wis",
    abil: { str: 13, dex: 10, con: 14, int: 9, wis: 16, cha: 11 }, hp: 24, spellAbility: "wis",
    gear: [["Mace", true], ["Knight Shield", true], ["Chainmail", true]], skills: ["rel","ins","med"],
    attrs: ["Attribute: Faith +1"], spells: ["Heal Aid", "Force"], catalyst: "Talisman",
    role: "Healer", blurb: "The party's lifeline. Miracles mend wounds and smite the hollow alike." },
  { n: "Deprived", cls: "Fighter", id: "fighter", hd: "d10", saves: ["str","con"], save: "con",
    abil: { str: 13, dex: 13, con: 13, int: 11, wis: 11, cha: 11 }, hp: 24, spellAbility: "",
    gear: [["Club", true]], skills: ["ath","sur"],
    attrs: ["Attribute: Vigor +1", "Attribute: Strength +1", "Attribute: Dexterity +1"], spells: [], catalyst: null,
    role: "Wildcard", blurb: "Naked but for a club \u2014 and three free attribute points. Build anything; swap these cards freely." }
];

function buildActor(p, gear, spells, levels) {
  const items = [];
  items.push(classItem({ name: p.cls, identifier: p.id, hitDice: p.hd, saves: p.saves, ability: p.spellAbility }));
  items.push(baseActionsFeat());

  for (const [gname, equipped] of p.gear) {
    const g = gear.get(gname);
    if (!g) { console.warn("  missing gear:", gname); continue; }
    const c = clone(g);
    c.system.equipped = !!equipped;
    items.push(c);
  }
  // Estus for everyone
  items.push((() => { const e = clone(gear.get("Estus Flask")); e.system.equipped = true; return e; })());

  if (p.catalyst && !p.gear.some(([g]) => g === p.catalyst)) {
    const c = clone(gear.get(p.catalyst)); c.system.equipped = true; items.push(c);
  }
  for (const sp of p.spells) {
    const s = spells.get(sp);
    if (!s) { console.warn("  missing spell:", sp); continue; }
    items.push(clone(s));
  }
  for (const a of p.attrs) {
    const card = levels.get(a);
    if (!card) { console.warn("  missing attr card:", a); continue; }
    items.push(clone(card));
  }

  const abilities = {};
  for (const ab of ["str","dex","con","int","wis","cha"]) {
    abilities[ab] = { value: p.abil[ab], proficient: p.saves.includes(ab) ? 1 : 0, max: null, bonuses: { check: "", save: "" } };
  }

  return {
    name: `${p.n} (${p.role})`, type: "character",
    img: "icons/sundries/gaming/chess-pawn-white.webp",
    effects: [], flags: { ashen: { pregen: true, dsClass: p.n } },
    system: {
      abilities,
      attributes: {
        ac: { flat: null, calc: "default", formula: "" },
        hp: { value: p.hp, max: p.hp, temp: null, tempmax: null, bonuses: { level: "", overall: "" } },
        init: { ability: "", bonus: "0", roll: { min: null, max: null, mode: 0 } },
        movement: { burrow: null, climb: null, fly: null, swim: null, walk: 30, units: "ft", hover: false },
        attunement: { max: 3 },
        senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0, units: "ft", special: "" },
        spellcasting: p.spellAbility || "",
        death: { success: 0, failure: 0, ability: "", roll: { min: null, max: null, mode: 0 } },
        exhaustion: 0, inspiration: false,
        concentration: { ability: "", bonuses: { save: "" }, limit: 1, roll: { min: null, max: null, mode: 0 } }
      },
      details: {
        biography: { value: `<p>${p.blurb}</p>`, public: "" },
        alignment: "Unkindled", race: null, background: null, originalClass: "",
        xp: { value: 0 }, level: 3,
        appearance: "", trait: "", ideal: "", bond: "", flaw: ""
      },
      traits: {
        size: "med",
        di: { value: [], bypasses: [], custom: "" }, dr: { value: [], bypasses: [], custom: "" },
        dv: { value: [], bypasses: [], custom: "" }, ci: { value: [], custom: "" },
        languages: { value: ["common"], custom: "" },
        weaponProf: { value: ["sim", "mar"], custom: "", mastery: { value: [], bonus: [] } },
        armorProf: { value: ["lgt", "med", "hvy", "shl"], custom: "" },
        dm: { amount: {}, bypasses: [] }
      },
      skills: SK(p.skills),
      bonuses: {
        mwak: { attack: "", damage: "" }, rwak: { attack: "", damage: "" },
        msak: { attack: "", damage: "" }, rsak: { attack: "", damage: "" },
        abilities: { check: "", save: "", skill: "" }, spell: { dc: "" }
      },
      spells: Object.fromEntries(["spell1","spell2","spell3","spell4","spell5","spell6","spell7","spell8","spell9","pact","spell0"].map(k => [k, { value: 0, override: null }])),
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      tools: {},
      resources: {
        primary: { value: p.spellAbility ? 3 : null, max: p.spellAbility ? 3 : null, sr: false, lr: true, label: p.spellAbility ? "Spell Charges" : "" },
        secondary: { value: null, max: null, sr: false, lr: false, label: "" },
        tertiary: { value: null, max: null, sr: false, lr: false, label: "" }
      },
      favorites: [], bastion: { name: "", description: "" }
    },
    items,
    prototypeToken: {
      name: p.n, displayName: 30, actorLink: true, width: 1, height: 1, lockRotation: false, rotation: 0,
      disposition: 1, displayBars: 30, bar1: { attribute: "attributes.hp" }, bar2: { attribute: "" },
      randomImg: false, alpha: 1, flags: {},
      texture: { src: "icons/sundries/gaming/chess-pawn-white.webp", tint: "#ffffff", scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0, anchorX: 0.5, anchorY: 0.5, fit: "contain", alphaThreshold: 0.75 },
      sight: { angle: 360, enabled: true, range: 0, brightness: 0, visionMode: "basic", color: null, attenuation: 0.1, saturation: 0, contrast: 0 },
      detectionModes: [], appendNumber: false, prependAdjective: false,
      ring: { enabled: true, colors: { ring: null, background: null }, effects: 1, subject: { scale: 1, texture: null } }
    }
  };
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

// The shared souls pool the economy macros read/write (flag ashen.role === "souls").
// A flagged, item-free character so it imports cleanly and is trivial to reset between runs.
function bonfireLedger() {
  const abilities = {};
  for (const ab of ["str", "dex", "con", "int", "wis", "cha"]) {
    abilities[ab] = { value: 10, proficient: 0, max: null, bonuses: { check: "", save: "" } };
  }
  return {
    name: "Bonfire Ledger", type: "character",
    img: "icons/magic/fire/flame-burning-embers-orange.webp",
    effects: [], flags: { ashen: { role: "souls", ledger: true, carried: 0, banked: 0, bloodstain: 0 } },
    system: {
      abilities,
      attributes: {
        ac: { flat: 10, calc: "flat", formula: "" },
        hp: { value: 1, max: 1, temp: null, tempmax: null, bonuses: { level: "", overall: "" } },
        init: { ability: "", bonus: "0", roll: { min: null, max: null, mode: 0 } },
        movement: { burrow: null, climb: null, fly: null, swim: null, walk: 0, units: "ft", hover: false },
        attunement: { max: 3 },
        senses: { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0, units: "ft", special: "" },
        spellcasting: "",
        death: { success: 0, failure: 0, ability: "", roll: { min: null, max: null, mode: 0 } },
        exhaustion: 0, inspiration: false,
        concentration: { ability: "", bonuses: { save: "" }, limit: 1, roll: { min: null, max: null, mode: 0 } }
      },
      details: {
        biography: { value: "<p><strong>The shared souls pool.</strong> This isn't a character &mdash; it's the party's bonfire ledger. The Ashen economy macros (Award / Bank / Spend Souls, Drop &amp; Reclaim Bloodstain, Level Up) read and write three flags on this actor:</p><ul><li><strong>carried</strong> &mdash; souls held on the body, lost as a bloodstain on a wipe.</li><li><strong>banked</strong> &mdash; souls safely spent-able for levels &amp; shopping (banked at a bonfire).</li><li><strong>bloodstain</strong> &mdash; the souls dropped at the last place of death, reclaimable once.</li></ul><p>To reset for a new run, set all three flags to 0 (or re-import this actor).</p>", public: "" },
        alignment: "", race: null, background: null, originalClass: "",
        xp: { value: 0 }, level: 1,
        appearance: "", trait: "", ideal: "", bond: "", flaw: ""
      },
      traits: {
        size: "med",
        di: { value: [], bypasses: [], custom: "" }, dr: { value: [], bypasses: [], custom: "" },
        dv: { value: [], bypasses: [], custom: "" }, ci: { value: [], custom: "" },
        languages: { value: [], custom: "" },
        weaponProf: { value: [], custom: "", mastery: { value: [], bonus: [] } },
        armorProf: { value: [], custom: "" }, dm: { amount: {}, bypasses: [] }
      },
      skills: SK([]),
      bonuses: {
        mwak: { attack: "", damage: "" }, rwak: { attack: "", damage: "" },
        msak: { attack: "", damage: "" }, rsak: { attack: "", damage: "" },
        abilities: { check: "", save: "", skill: "" }, spell: { dc: "" }
      },
      spells: Object.fromEntries(["spell1","spell2","spell3","spell4","spell5","spell6","spell7","spell8","spell9","pact","spell0"].map(k => [k, { value: 0, override: null }])),
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      tools: {},
      resources: {
        primary: { value: null, max: null, sr: false, lr: false, label: "Cinders (Lives)" },
        secondary: { value: 0, max: 3, sr: false, lr: false, label: "Shop Tier (0-3)" },
        tertiary: { value: null, max: null, sr: false, lr: false, label: "" }
      },
      favorites: [], bastion: { name: "", description: "" }
    },
    items: [],
    prototypeToken: {
      name: "Bonfire Ledger", displayName: 0, actorLink: true, width: 1, height: 1, lockRotation: false, rotation: 0,
      disposition: 0, displayBars: 0, bar1: { attribute: "" }, bar2: { attribute: "" },
      randomImg: false, alpha: 1, flags: {},
      texture: { src: "icons/magic/fire/flame-burning-embers-orange.webp", tint: "#ffffff", scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0, anchorX: 0.5, anchorY: 0.5, fit: "contain", alphaThreshold: 0.75 },
      sight: { angle: 360, enabled: false, range: 0, brightness: 0, visionMode: "basic", color: null, attenuation: 0.1, saturation: 0, contrast: 0 },
      detectionModes: [], appendNumber: false, prependAdjective: false
    }
  };
}

async function main() {
  const gear = await loadDir(path.join(ROOT, "src/items/gear"));
  const spells = await loadDir(path.join(ROOT, "src/items/spells"));
  const levels = await loadDir(path.join(ROOT, "src/items/levels"));
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "00-bonfire-ledger.json"), JSON.stringify(bonfireLedger(), null, 2));
  let i = 0;
  for (const p of PREGENS) {
    const actor = buildActor(p, gear, spells, levels);
    await writeFile(path.join(OUT, `${String(++i).padStart(2, "0")}-${slug(p.n)}.json`), JSON.stringify(actor, null, 2));
  }
  console.log(`Generated ${PREGENS.length} pregens + Bonfire Ledger.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
