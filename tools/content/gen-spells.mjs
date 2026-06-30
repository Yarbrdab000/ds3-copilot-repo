#!/usr/bin/env node
/**
 * Generator for the Ashen spell catalog (Sorceries, Miracles, Pyromancies).
 *
 * DS3 spells are reskins of SRD spells. This script is the editable SOURCE for the
 * items-spells pack: edit the SPELLS table and re-run `node tools/content/gen-spells.mjs`
 * to regenerate src/items/spells/*.json. The build then compiles those into the pack.
 *
 * Casting in Ashen uses PER-SPELL casts (each spell has its own uses, refilled at a
 * bonfire / long rest): Tier 1 = 2 casts, Tier 2 = 1, Tier 3 = 0. There are no spell
 * slots — spell.level is set to the SRD-equivalent only so dnd5e renders damage/scaling
 * correctly. The 15-stat caster milestone adds +1 cast to every spell of that school,
 * so a milestone caster gets T1 = 3, T2 = 2, T3 = 1; a caster WITHOUT the milestone
 * cannot cast Tier-3 spells at all (they stay at 0 casts).
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../src/items/spells");

const TIER_CHARGES = { 1: 1, 2: 2, 3: 3 };
// Per-spell casts (uses) by tier — each spell refills these at a bonfire (long rest).
// T3 is 0 at base: only a caster with their school's 15 milestone (+1) can cast a
// Tier-3 spell, and even then just once per bonfire.
const TIER_USES = { 1: 2, 2: 1, 3: 0 };
const SCHOOL_GROUP = {
  sorcery: { stat: "Intelligence", catalyst: "Staff / Catalyst", img: "icons/magic/light/projectile-bolts-salvo-white.webp" },
  miracle: { stat: "Faith", catalyst: "Talisman / Chime", img: "icons/magic/holy/prayer-hands-glowing-yellow.webp" },
  pyromancy: { stat: "the Pyromancy Flame", catalyst: "Pyromancy Flame", img: "icons/magic/fire/projectile-fireball-orange.webp" }
};

/**
 * Spell data. activity: "damage" (auto-hit), "attack" (spell attack), "save", "heal", "utility".
 * parts: [number, denomination, bonus, type].
 */
const SPELLS = [
  // ───────────────────────── SORCERIES (Int, Staff) ─────────────────────────
  { group: "sorcery", tier: 1, level: 1, school: "evo", name: "Soul Arrow", srd: "Magic Missile",
    flavor: "A bolt of distilled soul-stuff that never misses its mark.",
    activity: "damage", range: { value: "120", units: "ft" }, target: { affects: { type: "creature", count: "3" } },
    parts: [[3, 4, "3", "force"]], properties: ["vocal", "somatic"],
    rules: "Three darts of soul energy strike unerringly (3 x 1d4+1 force, auto-hit). Split among up to three targets." },
  { group: "sorcery", tier: 1, level: 1, school: "evo", name: "Heavy Soul Arrow", srd: "Witch Bolt",
    flavor: "A heavier, slower lance of soul that arcs to its target and clings.",
    activity: "attack", attackType: "ranged", range: { value: "30", units: "ft" }, target: { affects: { type: "creature", count: "1" } },
    parts: [[1, 12, "", "force"]], properties: ["vocal", "somatic", "concentration"],
    rules: "Spell attack; on hit 1d12 force, and each later turn you may use an action to deal 1d12 again (concentration)." },
  { group: "sorcery", tier: 1, level: 2, school: "ill", name: "Hidden Body", srd: "Invisibility (self)",
    flavor: "You veil yourself in shadow, slipping from sight.",
    activity: "utility", range: { units: "self" }, target: { affects: { type: "self" } }, properties: ["vocal", "somatic", "concentration"],
    rules: "You become invisible until you attack or cast (concentration, up to 1 hour). Great for repositioning into a backstab." },
  // T2
  { group: "sorcery", tier: 2, level: 3, school: "evo", name: "Crystal Soul Spear", srd: "Lightning Bolt",
    flavor: "A crystalline lance of soul punches through everything in a line.",
    activity: "save", saveAbility: "dex", range: { units: "self" }, template: { type: "line", size: "100", width: "5" },
    parts: [[8, 6, "", "force"]], onSave: "half", properties: ["vocal", "somatic"],
    rules: "100-ft line; Dex save, 8d6 force (half on save)." },
  { group: "sorcery", tier: 2, level: 2, school: "evo", name: "Homing Crystal Soulmass", srd: "Scorching Ray",
    flavor: "Shards of soul orbit you, then streak out to seek your foes.",
    activity: "attack", attackType: "ranged", range: { value: "120", units: "ft" }, target: { affects: { type: "creature", count: "3" } },
    parts: [[2, 6, "", "force"]], properties: ["vocal", "somatic"],
    rules: "Loose three shards; make a separate spell attack for each, 2d6 force per hit." },
  { group: "sorcery", tier: 2, level: 3, school: "trs", name: "Frozen Weapon", srd: "Elemental Weapon",
    flavor: "Rime sheaths a blade, biting with cold.",
    activity: "utility", range: { units: "touch" }, target: { affects: { type: "creature", count: "1" } }, properties: ["vocal", "somatic", "concentration"],
    rules: "A weapon gains +1 to attack and deals +1d4 cold for the scene (concentration, up to 1 hour)." },
  // T3
  { group: "sorcery", tier: 3, level: 5, school: "evo", name: "White Dragon Breath", srd: "Cone of Cold",
    flavor: "You exhale the breath of an Archdragon — a roaring cone of frost.",
    activity: "save", saveAbility: "con", range: { units: "self" }, template: { type: "cone", size: "60" },
    parts: [[8, 8, "", "cold"]], onSave: "half", properties: ["vocal", "somatic", "material"],
    rules: "60-ft cone; Con save, 8d8 cold (half on save)." },
  { group: "sorcery", tier: 3, level: 5, school: "abj", name: "Soul Stream", srd: "Wall of Force",
    flavor: "A torrent of souls hardens into an impassable veil.",
    activity: "utility", range: { value: "120", units: "ft" }, properties: ["vocal", "somatic"],
    rules: "Raise a wall of solid soul-force (as Wall of Force) for up to 10 minutes (concentration). Control the arena." },

  // ───────────────────────── MIRACLES (Faith, Talisman) ─────────────────────────
  { group: "miracle", tier: 1, level: 1, school: "evo", name: "Heal Aid", srd: "Cure Wounds",
    flavor: "A small mercy of the gods knits flesh and bone.",
    activity: "heal", range: { units: "touch" }, target: { affects: { type: "creature", count: "1" } }, heal: [1, 8, "@mod"], properties: ["vocal", "somatic"],
    rules: "Touch; restore 1d8 + your Faith modifier HP." },
  { group: "miracle", tier: 1, level: 1, school: "evo", name: "Lightning Spear", srd: "Guiding Bolt",
    flavor: "Hurl a spear of sunlight forged from faith.",
    activity: "attack", attackType: "ranged", range: { value: "120", units: "ft" }, target: { affects: { type: "creature", count: "1" } },
    parts: [[4, 6, "", "radiant"]], properties: ["vocal", "somatic"],
    rules: "Spell attack; 4d6 radiant, and the next attack against the target has advantage." },
  { group: "miracle", tier: 1, level: 1, school: "evo", name: "Force", srd: "Thunderwave",
    flavor: "A pulse of divine will throws back all who crowd you.",
    activity: "save", saveAbility: "con", range: { units: "self" }, template: { type: "cube", size: "15" },
    parts: [[2, 8, "", "thunder"]], onSave: "half", properties: ["vocal", "somatic"],
    rules: "15-ft cube; Con save, 2d8 thunder and pushed 10 ft (half and no push on save). A panic button." },
  // T2
  { group: "miracle", tier: 2, level: 2, school: "evo", name: "Great Heal", srd: "Prayer of Healing",
    flavor: "A broader benediction mends the whole party.",
    activity: "heal", range: { value: "30", units: "ft" }, target: { affects: { type: "creature", count: "6" } }, heal: [2, 8, "@mod"], properties: ["vocal"],
    rules: "Up to 6 creatures within 30 ft each regain 2d8 + your Faith modifier HP (10-minute cast — between fights)." },
  { group: "miracle", tier: 2, level: 3, school: "con", name: "Wrath of the Gods", srd: "Spirit Guardians",
    flavor: "Vengeful spirits wheel about you, smiting the wicked.",
    activity: "save", saveAbility: "wis", range: { units: "self" }, template: { type: "sphere", size: "15" },
    parts: [[3, 8, "", "radiant"]], onSave: "half", properties: ["vocal", "somatic", "material", "concentration"],
    rules: "15-ft aura for the scene (concentration); enemies entering take 3d8 radiant (Wis save halves) and are slowed." },
  { group: "miracle", tier: 2, level: 4, school: "abj", name: "Tears of Denial", srd: "Death Ward",
    flavor: "The gods deny death its due — once.",
    activity: "utility", range: { units: "touch" }, target: { affects: { type: "creature", count: "1" } }, properties: ["vocal", "somatic"],
    rules: "For the next hour, the first time the target would drop to 0 HP it instead drops to 1. The ultimate clutch save." },
  // T3
  { group: "miracle", tier: 3, level: 5, school: "evo", name: "Great Lightning Spear", srd: "Flame Strike (lightning)",
    flavor: "Call down a pillar of the gods' own lightning.",
    activity: "save", saveAbility: "dex", range: { value: "60", units: "ft" }, template: { type: "cylinder", size: "10" },
    parts: [[4, 6, "", "radiant"], [4, 6, "", "lightning"]], onSave: "half", properties: ["vocal", "somatic"],
    rules: "10-ft radius column; Dex save, 4d6 radiant + 4d6 lightning (half on save)." },
  { group: "miracle", tier: 3, level: 5, school: "evo", name: "Bountiful Sunlight", srd: "Mass Cure Wounds",
    flavor: "Warm sunlight floods the field, closing every wound it touches.",
    activity: "heal", range: { value: "60", units: "ft" }, target: { affects: { type: "creature", count: "6" } }, heal: [3, 8, "@mod"], properties: ["vocal", "somatic"],
    rules: "Up to 6 creatures within a 30-ft sphere each regain 3d8 + your Faith modifier HP." },

  // ───────────────────────── PYROMANCIES (Pyromancy Flame) ─────────────────────────
  { group: "pyromancy", tier: 1, level: 1, school: "evo", name: "Fire Orb", srd: "Burning Hands",
    flavor: "A gout of flame erupts from the pyromancy flame in your palm.",
    activity: "save", saveAbility: "dex", range: { units: "self" }, template: { type: "cone", size: "15" },
    parts: [[3, 6, "", "fire"]], onSave: "half", properties: ["vocal", "somatic"],
    rules: "15-ft cone; Dex save, 3d6 fire (half on save)." },
  { group: "pyromancy", tier: 1, level: 1, school: "nec", name: "Poison Mist", srd: "Ray of Sickness",
    flavor: "A clinging cloud of toxic haze, a hexer's gift.",
    activity: "attack", attackType: "ranged", range: { value: "60", units: "ft" }, target: { affects: { type: "creature", count: "1" } },
    parts: [[2, 8, "", "poison"]], properties: ["vocal", "somatic"],
    rules: "Spell attack; 2d8 poison and the target must save or be poisoned until its next turn." },
  { group: "pyromancy", tier: 1, level: 1, school: "abj", name: "Flash Sweat", srd: "Absorb Elements",
    flavor: "A sheen of warding sweat blunts the next searing blow.",
    activity: "utility", range: { units: "self" }, target: { affects: { type: "self" } }, properties: ["somatic"],
    rules: "Reaction when you take acid/cold/fire/lightning/thunder damage: resistance to that damage this turn, and +1d6 of that type on your next melee hit." },
  // T2
  { group: "pyromancy", tier: 2, level: 3, school: "evo", name: "Fireball", srd: "Fireball",
    flavor: "The signature pyromancy: a roaring blossom of flame.",
    activity: "save", saveAbility: "dex", range: { value: "150", units: "ft" }, template: { type: "sphere", size: "20" },
    parts: [[8, 6, "", "fire"]], onSave: "half", properties: ["vocal", "somatic", "material"],
    rules: "20-ft sphere; Dex save, 8d6 fire (half on save). The bread and butter of any pyromancer." },
  { group: "pyromancy", tier: 2, level: 3, school: "nec", name: "Black Flame", srd: "Vampiric Touch",
    flavor: "Dark fire that burns body and soul, feeding the caster.",
    activity: "attack", attackType: "melee", range: { units: "self" }, target: { affects: { type: "creature", count: "1" } },
    parts: [[3, 6, "", "necrotic"]], properties: ["vocal", "somatic", "concentration"],
    rules: "Melee spell attack; 3d6 necrotic and you regain half the damage dealt. Repeatable each turn (concentration)." },
  // T3
  { group: "pyromancy", tier: 3, level: 5, school: "evo", name: "Great Chaos Fire Orb", srd: "Flame Strike (fire)",
    flavor: "A churning orb of chaos fire that leaves molten ruin.",
    activity: "save", saveAbility: "dex", range: { value: "60", units: "ft" }, template: { type: "cylinder", size: "10" },
    parts: [[5, 6, "", "fire"]], onSave: "half", properties: ["vocal", "somatic"],
    rules: "10-ft radius column; Dex save, 5d6 fire (half on save), and the ground burns (difficult, 1d6 fire to enter) for 1 minute." },
  { group: "pyromancy", tier: 3, level: 5, school: "con", name: "Firestorm", srd: "Flame Strike (wide)",
    flavor: "Chaos vestiges rain fire across the battlefield.",
    activity: "save", saveAbility: "dex", range: { value: "120", units: "ft" }, template: { type: "sphere", size: "20" },
    parts: [[6, 6, "", "fire"]], onSave: "half", properties: ["vocal", "somatic", "material"],
    rules: "20-ft sphere; Dex save, 6d6 fire (half on save). A wide-area finisher for clustered foes." }
];

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function buildActivity(s) {
  const base = {
    _id: "dnd5eactivity000",
    activation: { type: "action", value: 1, condition: "", override: false },
    consumption: { targets: [{ type: "itemUses", target: "", value: "1", scaling: { mode: "", formula: "" } }], scaling: { allowed: false, max: "" }, spellSlot: false },
    description: { chatFlavor: "" },
    duration: { concentration: !!(s.properties || []).includes("concentration"), value: "", units: "inst", special: "", override: false },
    effects: [],
    range: { override: false },
    target: { template: { contiguous: false, units: "ft" }, affects: { choice: false }, override: false, prompt: true },
    uses: { spent: 0, recovery: [], max: "" },
    sort: 0,
    name: "Cast",
    img: ""
  };
  const parts = (s.parts || []).map(([number, denomination, bonus, type]) => ({
    number, denomination, bonus, types: [type],
    custom: { enabled: false, formula: "" },
    scaling: { mode: "", number: null, formula: "" }
  }));
  if (s.activity === "damage") {
    return { ...base, type: "damage", damage: { critical: { allow: false }, parts } };
  }
  if (s.activity === "attack") {
    return {
      ...base, type: "attack",
      attack: { ability: "", bonus: "", critical: { threshold: null }, flat: false, type: { value: s.attackType || "ranged", classification: "spell" } },
      damage: { critical: { bonus: "" }, includeBase: false, parts }
    };
  }
  if (s.activity === "save") {
    return {
      ...base, type: "save",
      save: { ability: s.saveAbility || "dex", dc: { calculation: "spellcasting", formula: "" } },
      damage: { onSave: s.onSave || "half", parts }
    };
  }
  if (s.activity === "heal") {
    const [number, denomination, bonus] = s.heal;
    return {
      ...base, type: "heal",
      healing: { number, denomination, bonus, types: ["healing"], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }
    };
  }
  return { ...base, type: "utility" };
}

function buildSpell(s) {
  const g = SCHOOL_GROUP[s.group];
  const casts = TIER_USES[s.tier];
  const castNote = s.tier === 3
    ? `<strong>Tier 3 ${s.group}</strong> — 1 cast per bonfire, and <strong>only</strong> once you've unlocked your school's 15 milestone (without it this spell sits at <strong>0 casts</strong> and cannot be cast)`
    : `<strong>Tier ${s.tier} ${s.group}</strong> — <strong>${casts} cast${casts === 1 ? "" : "s"} per bonfire</strong> (refills on a long rest); your school's 15 milestone adds +1`;
  const valve = (s.activity === "attack" && s.parts && s.parts.length)
    ? `<p><strong>Mercy valve:</strong> on a miss this still deals your spellcasting modifier in ${s.parts[0][3]} damage (minimum 1) — a caster always chips.</p>`
    : "";
  const desc =
    `<p><em>${s.flavor}</em></p>` +
    `<p><strong>${s.rules}</strong></p>` +
    valve +
    `<hr/><p><strong>Ashen:</strong> ${castNote}. ` +
    `Gated by ${g.stat}; requires a <strong>${g.catalyst}</strong> in hand. Based on SRD <em>${s.srd}</em>.</p>`;
  const template = s.template
    ? { type: s.template.type, size: String(s.template.size), units: "ft", width: s.template.width ? String(s.template.width) : "", contiguous: false }
    : { type: "", size: "", units: "", contiguous: false };
  const affects = s.target?.affects
    ? { type: s.target.affects.type || "", count: String(s.target.affects.count ?? ""), choice: false, special: "" }
    : { type: "", count: "", choice: false, special: "" };
  return {
    name: s.name,
    type: "spell",
    img: g.img,
    effects: [],
    flags: { ashen: { tier: s.tier, group: s.group, casts } },
    system: {
      description: { value: desc, chat: "" },
      source: { book: "Ashen", page: "", custom: `DS3 ${s.group}`, license: "CC-BY-4.0", rules: "2014" },
      level: s.level,
      school: s.school,
      materials: { value: "", consumed: false, cost: 0, supply: 0 },
      preparation: { mode: "prepared", prepared: true },
      properties: s.properties || ["vocal", "somatic"],
      activation: { type: "action", value: 1, condition: "" },
      duration: { value: "", units: (s.properties || []).includes("concentration") ? "minute" : "inst" },
      range: { value: s.range?.value ?? "", units: s.range?.units ?? "self", special: "" },
      target: { affects, template },
      uses: { max: String(TIER_USES[s.tier]), recovery: [{ period: "lr", type: "recoverAll" }], spent: 0 },
      activities: { dnd5eactivity000: buildActivity(s) },
      identifier: slug(s.name)
    }
  };
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  let n = 0;
  const counts = {};
  for (const s of SPELLS) {
    const doc = buildSpell(s);
    await writeFile(path.join(OUT, `${s.group}-t${s.tier}-${slug(s.name)}.json`), JSON.stringify(doc, null, 2));
    counts[s.group] = (counts[s.group] || 0) + 1;
    n++;
  }
  console.log(`Generated ${n} spells:`, counts);
}

main().catch((e) => { console.error(e); process.exit(1); });
