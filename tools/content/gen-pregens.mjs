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
    name, type: "class", img: "icons/sundries/books/book-embossed-jewel-gold-green.webp",
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
    img: "icons/skills/melee/blade-tips-triple-steel.webp", effects: [], flags: {},
    system: {
      description: { value: "<p><strong>Strike</strong> \u2014 a weapon Attack. You get a 2nd strike at L5 (Extra Attack) and a 3rd once you've invested 3 points in your attack stat (Dex for finesse/ranged, Str for melee); cap 3. Dual-wielders add an off-hand strike as a bonus action.</p><p><strong>Dodge</strong> \u2014 always available, unlimited: flat d20 vs the move's Dodge DC, quality set by the window you call. Success negates damage and repositions 5 ft (end behind the foe \u2192 advantage next attack).</p><p><strong>Block</strong> \u2014 costs your reaction, <strong>no roll</strong>: deterministic per-damage-type reduction from your shield (see its card). It chips at low tiers and <strong>never staggers</strong>. Charges, shield-kicks and grabs are <em>unblockable</em> \u2014 sidestep the lane instead.</p><p><strong>Parry</strong> \u2014 costs your reaction: flat d20 vs the move's Parry DC; only the ideal window gives advantage, all others disadvantage. Success negates AND staggers (party riposte window); failure takes full damage. Only clean weapon swings are parryable.</p><p><strong>Backstab (any class)</strong> \u2014 a positional finisher. When the DM rules you're striking from <em>directly behind</em> a foe (e.g. you dodged, repositioned behind it, and it didn't turn to face you), you may use the <strong>Backstab</strong> action on your sheet (it's favourited on your front panel) instead of a Strike. It <strong>auto-hits</strong> off your equipped weapon and deals <strong>\u00d71.5 weapon damage</strong> (<strong>\u00d73 with a dagger</strong>), and cannot be Blocked or Parried. The DM tells you when you qualify.</p><p><em>Reaction economy:</em> Block &amp; Parry share your one reaction/round; Endurance/Poise 5 grants a second. Casters with Int/Faith 5 may fire one Tier-1 spell as a bonus action. See the Rules bible.</p>", chat: "" },
      source: { book: "Ashen", page: "", custom: "Core", license: "CC-BY-4.0", rules: "2014" },
      uses: { max: "", spent: 0, recovery: [] }, activities: {},
      type: { value: "feat", subtype: "" }, requirements: "Everyone",
      properties: [], enchant: {}, prerequisites: { level: null }, identifier: "base-actions"
    }
  };
}

function dpart(number, denomination, types, bonus = "") {
  return { number, denomination, bonus, types,
    custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } };
}

// Deterministic 16-char document id (so we can reference an embedded item from system.favorites).
// build.mjs only auto-generates an _id when one is absent, so a fixed id here survives packing.
function mkId(seed) {
  let s = ("Ash" + seed).replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  while (s.length < 16) s += "0";
  return s;
}

// Universal Backstab: a clickable, on-sheet positional finisher available to EVERY pregen.
// It is DM-gated (the DM tells the player when they're behind a foe) and auto-hits. Damage is
// derived live from the wielder's own weapon (dice + the weapon's scaling bonus) and multiplied:
// daggers x3 (a knife in the gap is deadlier than a greatsword), everything else x1.5. Built from
// the actual weapon item so dice / damage type / scaling never drift from the gear pack.
function backstabFeat(weaponItem, id) {
  const act = weaponItem.system?.activities?.dnd5eactivity000;
  const part = act?.damage?.parts?.[0];
  const n = part?.number ?? weaponItem.system?.damage?.base?.number ?? 1;
  const d = part?.denomination ?? weaponItem.system?.damage?.base?.denomination ?? 4;
  const dtype = (part?.types?.[0]) || (weaponItem.system?.damage?.base?.types?.[0]) || "piercing";
  const scaleBonus = part?.bonus || "";
  const dice = `${n}d${d}`;
  const inner = scaleBonus ? `(${dice} + ${scaleBonus})` : dice;
  const isDagger = weaponItem.system?.type?.baseItem === "dagger";
  const mult = isDagger ? 3 : 1.5;
  const formula = `floor(${inner} * ${mult})`;
  const multLabel = isDagger ? "&times;3 (dagger critical)" : "&times;1.5";
  const desc =
    `<p><em>Positional finisher &mdash; any class.</em> When the DM rules you're striking from ` +
    `<strong>directly behind</strong> a foe (e.g. you dodged, slipped behind it, and it didn't turn ` +
    `to face you), use this instead of a Strike.</p>` +
    `<p>It <strong>auto-hits</strong> (no attack roll) and <strong>cannot be Blocked or Parried</strong>. ` +
    `Damage = your <strong>${weaponItem.name}</strong> hit &times; the backstab multiplier: <strong>${multLabel}</strong>. ` +
    `Your weapon scaling is already baked into the roll.</p>` +
    `<p><strong>Daggers backstab for &times;3</strong> &mdash; in the gap of a guard, a knife is deadlier than ` +
    `any greatsword. The DM tells you when you qualify.</p>`;
  return {
    _id: id,
    name: "Backstab", type: "feat", img: "icons/weapons/daggers/dagger-poisoned-curved-green.webp",
    effects: [], flags: { ashen: { backstab: true } },
    system: {
      description: { value: desc, chat: "" },
      source: { book: "Ashen", page: "", custom: "Backstab", license: "CC-BY-4.0", rules: "2014" },
      uses: { max: "", spent: 0, recovery: [] },
      activities: {
        dnd5eactivity000: {
          _id: "dnd5eactivity000", type: "damage", name: "Backstab", img: "", sort: 0,
          activation: { type: "action", value: 1, condition: "", override: false },
          consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: false },
          description: { chatFlavor: "" },
          duration: { concentration: false, value: "", units: "inst", special: "", override: false },
          effects: [],
          range: { value: "", units: "", special: "", override: false },
          target: { template: { contiguous: false, units: "ft", type: "" }, affects: { choice: false }, override: false, prompt: true },
          uses: { spent: 0, max: "", recovery: [] },
          damage: {
            critical: { allow: false },
            parts: [{ number: null, denomination: null, bonus: "", types: [dtype],
              custom: { enabled: true, formula }, scaling: { mode: "", number: null, formula: "" } }]
          }
        }
      },
      type: { value: "feat", subtype: "" }, requirements: "Everyone",
      properties: [], enchant: {}, prerequisites: { level: null }, identifier: "backstab"
    }
  };
}

// Signature "Art of War" moves for the non-caster pregens. Each is a real, clickable feat
// whose attack rolls the wielder's weapon dice PLUS the same live scaling formula the weapon
// uses (floor(stat mod * grade factor)) — so the move tracks weapon scaling automatically —
// plus a signature flourish die and a tactical rider. 3 charges, refilled at any bonfire.
function artItem(def) {
  const scale = `floor(@abilities.${def.abil}.mod * ${def.factor})`;
  const parts = def.dmg.map((d, i) => dpart(d.n, d.d, d.types, i === 0 ? scale : ""));
  const atWill = !!def.atWill;
  const intro = atWill
    ? `<p><em>${def.kindLabel || "Class feature"}.</em> At-will, but only <strong>once per turn</strong>.</p>`
    : `<p><em>Signature Art of War.</em> <strong>3 charges</strong> &mdash; refill at any bonfire (a long rest).</p>`;
  const desc =
    intro +
    `<p>${def.blurb}</p>` +
    `<p>Its damage roll already bakes in your <strong>${def.statName} scaling</strong> and your weapon dice, ` +
    `so it grows exactly as your weapon does &mdash; just point and click.</p>` +
    `<p><strong>Effect:</strong> ${def.rider}</p>`;
  const uses = atWill
    ? { max: "", spent: 0, recovery: [] }
    : { max: "3", spent: 0, recovery: [{ period: "lr", type: "recoverAll" }] };
  const consumeTargets = atWill
    ? []
    : [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }];
  return {
    name: def.name, type: "feat", img: def.img, effects: [],
    flags: { ashen: atWill ? { sneakAttack: true } : { artOfWar: true } },
    system: {
      description: { value: desc, chat: "" },
      source: { book: "Ashen", page: "", custom: atWill ? "Rogue" : "Art of War", license: "CC-BY-4.0", rules: "2014" },
      uses,
      activities: {
        dnd5eactivity000: {
          _id: "dnd5eactivity000", type: "attack", name: def.actName, img: "", sort: 0,
          activation: { type: "action", value: 1, condition: "", override: false },
          consumption: {
            targets: consumeTargets,
            scaling: { allowed: false, max: "" }, spellSlot: false
          },
          description: { chatFlavor: "" },
          duration: { concentration: false, value: "", units: "inst", special: "", override: false },
          effects: [],
          range: { value: "", units: "", special: "", override: false },
          target: { template: { contiguous: false, units: "ft", type: "" }, affects: { choice: false }, override: false, prompt: true },
          uses: { spent: 0, max: "", recovery: [] },
          attack: { ability: def.abil, bonus: "", critical: { threshold: null }, flat: false, type: { value: "melee", classification: "weapon" } },
          damage: { critical: { bonus: "" }, includeBase: false, parts }
        }
      },
      type: { value: "feat", subtype: "" }, requirements: atWill ? "Rogue" : "Signature Art",
      properties: [], enchant: {}, prerequisites: { level: null }, identifier: slug(def.name)
    }
  };
}

// One signature Art per non-caster pregen, keyed by pregen name. Damage parts: part[0] carries
// the live weapon-scaling bonus; any further parts are the move's flourish dice.
const ARTS = {
  "Knight": {
    name: "Art of War: Stomp", actName: "Stomp",
    img: "icons/skills/melee/strike-hammer-destructive-orange.webp",
    abil: "str", factor: 0.75, statName: "Strength",
    dmg: [{ n: 1, d: 8, types: ["slashing"] }, { n: 1, d: 8, types: ["bludgeoning"] }],
    blurb: "You raise your blade and bring your full weight down in a crushing overhead.",
    rider: "On a hit the target must succeed on a Strength save (DC 8 + your proficiency + your Strength modifier) or be knocked <strong>prone</strong>."
  },
  "Warrior": {
    name: "Art of War: Spin Slash", actName: "Spin Slash",
    img: "icons/skills/melee/sword-twirl-orange.webp",
    abil: "str", factor: 1.5, statName: "Strength",
    dmg: [{ n: 1, d: 12, types: ["slashing"] }],
    blurb: "You whirl the great axe in a full circle, carving everything in reach.",
    rider: "Make this one attack roll and apply it to <strong>every creature within 5 ft of you</strong>; roll the damage once and deal it to each that is hit."
  },
  "Mercenary": {
    name: "Art of War: Sellsword Flurry", actName: "Sellsword Flurry",
    img: "icons/skills/melee/strike-sword-blood-red.webp",
    abil: "dex", factor: 1.0, statName: "Dexterity",
    dmg: [{ n: 2, d: 6, types: ["slashing"] }],
    blurb: "A blinding two-blade flurry that ends with you already somewhere else.",
    rider: "After the strike you may move up to <strong>10 ft</strong> without provoking opportunity attacks."
  },
  "Deprived": {
    name: "Art of War: Perseverance", actName: "Perseverance",
    img: "icons/magic/defensive/shield-barrier-glowing-blue.webp",
    abil: "str", factor: 0.25, statName: "Strength",
    dmg: [{ n: 1, d: 4, types: ["bludgeoning"] }, { n: 1, d: 6, types: ["bludgeoning"] }],
    blurb: "You plant your feet and swing with stubborn, unkillable fury.",
    rider: "You gain <strong>temporary HP equal to your level</strong> and cannot be knocked prone or pushed until the end of your next turn."
  }
};

// Sneak Attack is the Rogue class feature, kept SEPARATE from the universal Backstab (the
// "Ashen: Backstab" macro any class can use from behind). It's a clickable strike that already
// includes the +2d6 sneak dice; at-will but usable once per turn when you qualify. Both Rogue
// pregens (Thief, Assassin) get it.
const SNEAK = {
  "Thief": {
    name: "Sneak Attack", actName: "Sneak Attack", atWill: true, kindLabel: "Rogue feature",
    img: "icons/weapons/daggers/dagger-poisoned-curved-green.webp",
    abil: "dex", factor: 1.5, statName: "Dexterity",
    dmg: [{ n: 1, d: 4, types: ["piercing"] }, { n: 2, d: 6, types: ["piercing"] }],
    blurb: "You wait for the opening, then bury the dagger where the armour gaps.",
    rider: "Use when you have <strong>advantage</strong>, or when an ally is within 5 ft of the target and you don't have disadvantage \u2014 with a finesse or ranged weapon. <strong>Once per turn.</strong> The +2d6 is already in the roll. This is your class feature; it's separate from a <em>Backstab</em>, which any class can do from directly behind a foe."
  },
  "Assassin": {
    name: "Sneak Attack", actName: "Sneak Attack", atWill: true, kindLabel: "Rogue feature",
    img: "icons/weapons/swords/sword-guard-flanged.webp",
    abil: "dex", factor: 0.75, statName: "Dexterity",
    dmg: [{ n: 1, d: 8, types: ["piercing"] }, { n: 2, d: 6, types: ["piercing"] }],
    blurb: "A single surgical thrust into the gap \u2014 over before they feel it.",
    rider: "Use when you have <strong>advantage</strong>, or when an ally is within 5 ft of the target and you don't have disadvantage \u2014 with a finesse or ranged weapon. <strong>Once per turn.</strong> The +2d6 is already in the roll. This is your class feature; it's separate from a <em>Backstab</em>, which any class can do from directly behind a foe."
  }
};

// Combined map: Arts of War (non-casters, 3/bonfire) + Sneak Attack (Rogues, at-will once/turn).
const MOVES = { ...ARTS, ...SNEAK };

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
    icon: "icons/equipment/shield/heater-steel-grey.webp",
    abil: { str: 15, dex: 10, con: 14, int: 10, wis: 11, cha: 9 }, hp: 30, spellAbility: "",
    gear: [["Longsword", true], ["Knight Shield", true], ["Knight's Plate", true]], skills: ["ath","prc"],
    attrs: ["Attribute: Vigor +1", "Attribute: Vigor +1"], spells: [], catalyst: null,
    role: "Tank", blurb: "A Lothric knight clad in steel. Holds the line, blocks for the party, and never breaks." },
  { n: "Warrior", cls: "Barbarian", id: "barbarian", hd: "d12", saves: ["str","con"], save: "str",
    icon: "icons/weapons/axes/axe-double-engraved.webp",
    abil: { str: 16, dex: 13, con: 15, int: 8, wis: 10, cha: 9 }, hp: 33, spellAbility: "",
    gear: [["Greataxe", true], ["Hard Leather Armor", true]], skills: ["ath","sur"],
    attrs: ["Attribute: Strength +1", "Attribute: Strength +1"], spells: [], catalyst: null,
    role: "Bruiser", blurb: "Raw strength and a heavy axe. Trades defense for terrifying damage on the commit." },
  { n: "Mercenary", cls: "Fighter", id: "fighter", hd: "d10", saves: ["str","con"], save: "dex",
    icon: "icons/weapons/swords/scimitar-worn-blue.webp",
    abil: { str: 10, dex: 16, con: 13, int: 11, wis: 10, cha: 9 }, hp: 26, spellAbility: "",
    gear: [["Scimitar", true], ["Scimitar", true], ["Hard Leather Armor", true]], skills: ["acr","prc"],
    attrs: ["Attribute: Dexterity +1"], spells: [], catalyst: null,
    role: "Skirmisher", blurb: "Twin curved blades and constant motion. Dances around foes, punishing every opening." },
  { n: "Herald", cls: "Paladin", id: "paladin", hd: "d10", saves: ["wis","cha"], save: "wis",
    icon: "icons/magic/holy/saint-glass-portrait-halo.webp",
    abil: { str: 14, dex: 10, con: 14, int: 9, wis: 13, cha: 12 }, hp: 28, spellAbility: "wis",
    gear: [["Spear", true], ["Knight Shield", true], ["Chainmail", true]], skills: ["ath","rel"],
    attrs: ["Attribute: Faith +1"], spells: ["Heal Aid", "Lightning Spear"], catalyst: "Talisman",
    role: "Battle-healer", blurb: "Spear, shield, and faith. Fights in the front rank and keeps the party standing." },
  { n: "Thief", cls: "Rogue", id: "rogue", hd: "d8", saves: ["dex","int"], save: "dex",
    icon: "icons/weapons/daggers/dagger-poisoned-curved-green.webp",
    abil: { str: 9, dex: 16, con: 12, int: 12, wis: 11, cha: 10 }, hp: 21, spellAbility: "",
    gear: [["Dagger", true], ["Dagger", true], ["Hard Leather Armor", true], ["Shortbow", false]], skills: ["ste","acr","slt","prc"],
    attrs: ["Attribute: Dexterity +1"], spells: [], catalyst: null,
    role: "Striker", blurb: "Daggers from the dark. Lives for the backstab \u2014 Sneak Attack rewards good positioning." },
  { n: "Assassin", cls: "Rogue", id: "rogue", hd: "d8", saves: ["dex","int"], save: "dex",
    icon: "icons/weapons/swords/sword-guard-flanged.webp",
    abil: { str: 9, dex: 15, con: 12, int: 14, wis: 10, cha: 11 }, hp: 21, spellAbility: "int",
    gear: [["Estoc", true], ["Hard Leather Armor", true]], skills: ["ste","arc","acr","dec"],
    attrs: ["Attribute: Dexterity +1"], spells: ["Soul Arrow", "Hidden Body"], catalyst: "Sorcerer's Staff",
    role: "Trickster", blurb: "Blade and a touch of sorcery. Slips out of sight, then strikes from nowhere." },
  { n: "Sorcerer", cls: "Wizard", id: "wizard", hd: "d6", saves: ["int","wis"], save: "int",
    icon: "icons/weapons/staves/staff-simple-gold.webp",
    abil: { str: 8, dex: 13, con: 12, int: 16, wis: 11, cha: 10 }, hp: 18, spellAbility: "int",
    gear: [["Sorcerer's Staff", true], ["Dagger", false]], skills: ["arc","his","inv"],
    attrs: ["Attribute: Intelligence +1"], spells: ["Soul Arrow", "Heavy Soul Arrow"], catalyst: "Sorcerer's Staff",
    role: "Arcane DPS", blurb: "A glass cannon of soul magic. Devastating at range, desperately fragile up close." },
  { n: "Pyromancer", cls: "Sorcerer", id: "sorcerer", hd: "d6", saves: ["con","cha"], save: "cha",
    icon: "icons/magic/fire/flame-burning-hand-orange.webp",
    abil: { str: 9, dex: 13, con: 13, int: 11, wis: 10, cha: 15 }, hp: 20, spellAbility: "cha",
    gear: [["Pyromancy Flame", true], ["Dagger", true], ["Hard Leather Armor", true]], skills: ["arc","nat"],
    attrs: ["Attribute: Attunement +1"], spells: ["Fire Orb", "Poison Mist"], catalyst: "Pyromancy Flame",
    role: "Blaster", blurb: "Living flame in the palm. Throws fire by the fistful \u2014 Andre can stoke it stronger." },
  { n: "Cleric", cls: "Cleric", id: "cleric", hd: "d8", saves: ["wis","cha"], save: "wis",
    icon: "icons/magic/holy/chalice-glowing-gold.webp",
    abil: { str: 13, dex: 10, con: 14, int: 9, wis: 16, cha: 11 }, hp: 24, spellAbility: "wis",
    gear: [["Mace", true], ["Knight Shield", true], ["Chainmail", true]], skills: ["rel","ins","med"],
    attrs: ["Attribute: Faith +1"], spells: ["Heal Aid", "Force"], catalyst: "Talisman",
    role: "Healer", blurb: "The party's lifeline. Miracles mend wounds and smite the hollow alike." },
  { n: "Deprived", cls: "Fighter", id: "fighter", hd: "d10", saves: ["str","con"], save: "con",
    icon: "icons/weapons/clubs/club-simple-barbed.webp",
    abil: { str: 13, dex: 13, con: 13, int: 11, wis: 11, cha: 11 }, hp: 24, spellAbility: "",
    gear: [["Club", true]], skills: ["ath","sur"],
    attrs: ["Attribute: Vigor +1", "Attribute: Strength +1", "Attribute: Dexterity +1"], spells: [], catalyst: null,
    role: "Wildcard", blurb: "Naked but for a club \u2014 and three free attribute points. Build anything; swap these cards freely." }
];

function buildActor(p, gear, spells, levels) {
  const items = [];
  const favorites = [];
  let fsort = 100000;
  const fav = (id) => { favorites.push({ type: "item", id: `.Item.${id}`, sort: fsort }); fsort += 100000; };

  items.push(classItem({ name: p.cls, identifier: p.id, hitDice: p.hd, saves: p.saves, ability: p.spellAbility }));
  items.push(baseActionsFeat());
  if (MOVES[p.n]) {
    const move = artItem(MOVES[p.n]);
    move._id = mkId(p.n + "Art");
    items.push(move);
  }

  // Equip + clone gear; remember the weapon clones so Backstab can derive its damage from the
  // wielder's real weapon (prefer an equipped weapon; fall back to any carried weapon).
  const weaponClones = [];
  for (const [gname, equipped] of p.gear) {
    const g = gear.get(gname);
    if (!g) { console.warn("  missing gear:", gname); continue; }
    const c = clone(g);
    c.system.equipped = !!equipped;
    if (c.type === "weapon") weaponClones.push(c);
    items.push(c);
  }
  // Estus for everyone
  const estus = (() => { const e = clone(gear.get("Estus Flask")); e.system.equipped = true; return e; })();
  estus._id = mkId(p.n + "Est");
  items.push(estus);

  if (p.catalyst && !p.gear.some(([g]) => g === p.catalyst)) {
    const c = clone(gear.get(p.catalyst)); c.system.equipped = true; items.push(c);
  }
  for (let i = 0; i < p.spells.length; i++) {
    const s = spells.get(p.spells[i]);
    if (!s) { console.warn("  missing spell:", p.spells[i]); continue; }
    const sc = clone(s); sc._id = mkId(p.n + "Sp" + i); items.push(sc);
  }
  for (const a of p.attrs) {
    const card = levels.get(a);
    if (!card) { console.warn("  missing attr card:", a); continue; }
    items.push(clone(card));
  }

  // Universal Backstab (every pregen) derived from the primary weapon.
  const primaryWeapon = weaponClones.find(w => w.system.equipped) || weaponClones[0];
  if (primaryWeapon) {
    primaryWeapon._id = primaryWeapon._id || mkId(p.n + "Wpn");
    const bks = backstabFeat(primaryWeapon, mkId(p.n + "Bks"));
    items.push(bks);
    // Favorites = the player's combat "action bar" on the sheet's front panel.
    if (primaryWeapon.system.equipped) fav(primaryWeapon._id);   // Strike
    if (MOVES[p.n]) fav(mkId(p.n + "Art"));                       // Art of War / Sneak Attack
    fav(bks._id);                                                 // Backstab
  } else if (MOVES[p.n]) {
    fav(mkId(p.n + "Art"));
  }
  for (let i = 0; i < p.spells.length; i++) fav(mkId(p.n + "Sp" + i)); // signature spells
  fav(estus._id);                                                       // Estus Flask

  const abilities = {};
  for (const ab of ["str","dex","con","int","wis","cha"]) {
    abilities[ab] = { value: p.abil[ab], proficient: p.saves.includes(ab) ? 1 : 0, max: null, bonuses: { check: "", save: "" } };
  }

  return {
    name: `${p.n} (${p.role})`, type: "character",
    img: p.icon,
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
        primary: { value: null, max: null, sr: false, lr: false, label: "" },
        secondary: { value: null, max: null, sr: false, lr: false, label: "" },
        tertiary: { value: null, max: null, sr: false, lr: false, label: "" }
      },
      favorites, bastion: { name: "", description: "" }
    },
    items,
    prototypeToken: {
      name: p.n, displayName: 30, actorLink: true, width: 1, height: 1, lockRotation: false, rotation: 0,
      disposition: 1, displayBars: 30, bar1: { attribute: "attributes.hp" }, bar2: { attribute: "" },
      randomImg: false, alpha: 1, flags: {},
      texture: { src: p.icon, tint: "#ffffff", scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0, anchorX: 0.5, anchorY: 0.5, fit: "contain", alphaThreshold: 0.75 },
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
    effects: [], flags: { "ashen-of-lothric": { role: "souls", ledger: true, carried: 0, banked: 0, bloodstain: 0 } },
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
