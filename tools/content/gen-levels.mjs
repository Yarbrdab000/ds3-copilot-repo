#!/usr/bin/env node
/**
 * Generator for the Ashen "Levels" pack: attribute-point cards + Weapon Arts / Skills.
 *
 * Editable SOURCE for src/items/levels/. Re-run `node tools/content/gen-levels.mjs`.
 *
 * Attribute points with a clean dnd5e key carry a real ActiveEffect (apply automatically
 * when the item is on the sheet). Homebrew attributes (Poise, spell charges, sorcery/miracle
 * power) carry an `ashen` flag + plain-language text and are tracked on the sheet/Rules bible.
 * Drag a card onto a sheet each time that attribute is chosen; copies stack.
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../src/items/levels");

function ae(name, img, changes) {
  return {
    name, img, type: "base", system: {}, changes,
    transfer: true, disabled: false, description: "", origin: null,
    tint: "#ffffff", statuses: [], flags: {},
    duration: { startTime: null, seconds: null, combat: null, rounds: null, turns: null, startRound: null, startTurn: null }
  };
}
const ADD = 2;

// ───────────────────────── Attribute point cards ─────────────────────────
const ATTRS = [
  { key: "vigor", name: "Attribute: Vigor +1", img: "icons/magic/life/heart-glowing-red.webp",
    grant: "+3 maximum HP.", note: "The tank pick. Each point is a flat, permanent +3 to your HP maximum.",
    effects: [ae("Vigor", "icons/magic/life/heart-glowing-red.webp", [
      { key: "system.attributes.hp.bonuses.overall", mode: ADD, value: "3", priority: null }
    ])] },
  { key: "strength", name: "Attribute: Strength +1", img: "icons/skills/melee/hand-grip-sword-red.webp",
    grant: "+1 to melee attack & damage rolls.", note: "Every 2 points invested, the DM unlocks a heavier weapon die for you.",
    effects: [ae("Strength", "icons/skills/melee/hand-grip-sword-red.webp", [
      { key: "system.bonuses.mwak.attack", mode: ADD, value: "1", priority: null },
      { key: "system.bonuses.mwak.damage", mode: ADD, value: "1", priority: null }
    ])] },
  { key: "dexterity", name: "Attribute: Dexterity +1", img: "icons/skills/movement/feet-winged-boots-glowing-yellow.webp",
    grant: "+1 to finesse/ranged attack & damage rolls.", note: "At 3 points invested you also gain +1 AC (apply the 'Dexterity: AC Milestone' card once).",
    effects: [ae("Dexterity", "icons/skills/movement/feet-winged-boots-glowing-yellow.webp", [
      { key: "system.bonuses.rwak.attack", mode: ADD, value: "1", priority: null },
      { key: "system.bonuses.rwak.damage", mode: ADD, value: "1", priority: null }
    ])] },
  { key: "endurance", name: "Attribute: Endurance +1", img: "icons/equipment/shield/heater-steel-grey.webp",
    grant: "+1 Poise.", note: "POISE is a homebrew counter tracked on your sheet. At Poise 3 you ignore stagger/forced movement from minor hits; at Poise 5 you gain +1 Defensive Reaction per round. No ActiveEffect — the DM tracks it.",
    flag: { poise: 1 }, effects: [] },
  { key: "intelligence", name: "Attribute: Intelligence +1", img: "icons/magic/light/projectile-bolts-salvo-white.webp",
    grant: "+1 sorcery damage.", note: "Invested points also GATE sorcery tiers: 1 -> T1, 3 -> T2, 5 -> T3. Homebrew bonus added to each sorcery's damage by the caster; the DM verifies the gate.",
    flag: { sorceryPower: 1 }, effects: [] },
  { key: "faith", name: "Attribute: Faith +1", img: "icons/magic/holy/prayer-hands-glowing-yellow.webp",
    grant: "+1 miracle healing & damage.", note: "Invested points also GATE miracle tiers: 1 -> T1, 3 -> T2, 5 -> T3. Homebrew bonus added to each miracle by the caster; the DM verifies the gate.",
    flag: { miraclePower: 1 }, effects: [] },
  { key: "attunement", name: "Attribute: Attunement +1", img: "icons/magic/symbols/runes-star-orange.webp",
    grant: "+1 spell charge.", note: "Grows your casting pool (base 3 + Attunement). Track on a sheet resource named 'Charges'; refills at a bonfire. No ActiveEffect.",
    flag: { charges: 1 }, effects: [] }
];

const MILESTONES = [
  { key: "dex-ac", name: "Dexterity: AC Milestone (+1 AC)", img: "icons/equipment/shield/buckler-wooden-boss-steel.webp",
    grant: "+1 AC.", note: "Apply ONCE when your invested Dexterity reaches 3 points.",
    effects: [ae("Dexterity AC", "icons/equipment/shield/buckler-wooden-boss-steel.webp", [
      { key: "system.attributes.ac.bonus", mode: ADD, value: "1", priority: null }
    ])] },
  { key: "extra-attack", name: "Auto-Backbone: Extra Attack (L5 martials)", img: "icons/skills/melee/spear-tips-triple-orange.webp",
    grant: "Attack twice when you take the Attack action.", note: "Reminder card. If your chassis is martial, gaining 5th class level grants this automatically; drop this card on if your sheet didn't add it.",
    effects: [] }
];

// ───────────────────────── Weapon Arts / Skills (S6) ─────────────────────────
const ARTS = [
  // Martial
  { name: "Weapon Art: Stomp", img: "icons/skills/melee/strike-hammer-destructive-orange.webp", cat: "Martial",
    text: "Bonus action: shove a creature within reach (Athletics vs Athletics/Acrobatics). On a success, your next attack against it this turn has advantage." },
  { name: "Weapon Art: Perseverance", img: "icons/magic/defensive/shield-barrier-glowing-blue.webp", cat: "Martial",
    text: "Reaction: gain temporary HP equal to your level and become immune to stagger/forced movement until the end of your next turn.", once: true },
  { name: "Weapon Art: Spin Slash", img: "icons/skills/melee/sword-twirl-orange.webp", cat: "Martial",
    text: "Replace one Strike: make a single attack roll against every creature adjacent to you; apply it separately to each." },
  { name: "Weapon Art: Charge", img: "icons/skills/movement/arrow-upward-yellow.webp", cat: "Martial",
    text: "Move up to your speed in a straight line and make one attack; on a hit the target is knocked prone." },
  { name: "Weapon Art: Quickstep", img: "icons/skills/movement/feet-winged-sandals-tan.webp", cat: "Martial",
    text: "Bonus action: teleport up to 15 ft to a space you can see. This movement never provokes opportunity attacks." },
  { name: "Weapon Art: Leo Riposte", img: "icons/skills/melee/strike-sword-blood-red.webp", cat: "Martial",
    text: "Your ripostes (after a successful Parry) deal +2 weapon dice of damage." },
  // Caster
  { name: "Weapon Art: Steady Chant", img: "icons/magic/control/buff-flight-wings-blue.webp", cat: "Caster",
    text: "Bonus action: your next spell this turn cannot be interrupted (no broken concentration from damage) and its save DC increases by 2." },
  { name: "Weapon Art: Crystallize", img: "icons/magic/light/explosion-star-glow-blue.webp", cat: "Caster",
    text: "Once per bonfire: when a spell you cast misses every target or is fully resisted, refund its charge cost.", once: true },
  { name: "Weapon Art: Pyromancer's Fervor", img: "icons/magic/fire/flame-burning-hand-orange.webp", cat: "Caster",
    text: "Your fire spells score a critical hit / maximize a die on a roll of 19-20 (where they can crit)." },
  { name: "Weapon Art: Sage's Focus", img: "icons/magic/light/projectile-flare-blue.webp", cat: "Caster",
    text: "Once per bonfire: cast a Tier-1 spell as a bonus action.", once: true },
  // Universal
  { name: "Weapon Art: Estus Mastery", img: "icons/consumables/potions/bottle-round-corked-orange.webp", cat: "Universal",
    text: "Gain +1 Estus charge (raise your Estus Flask's max uses by 1), and you may quaff Estus as a bonus action." }
];

function feat(name, img, descHtml, { once = false, flag = null, effects = [], requirements = "" } = {}) {
  return {
    name, type: "feat", img, effects,
    flags: flag ? { ashen: flag } : {},
    system: {
      description: { value: descHtml, chat: "" },
      source: { book: "Ashen", page: "", custom: "Leveling", license: "CC-BY-4.0", rules: "2014" },
      uses: once ? { max: "1", spent: 0, recovery: [{ period: "lr", type: "recoverAll" }] } : { max: "", spent: 0, recovery: [] },
      activities: {},
      type: { value: "feat", subtype: "" },
      requirements,
      properties: [],
      enchant: {},
      prerequisites: { level: null },
      identifier: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    }
  };
}

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  let n = 0;

  for (const a of [...ATTRS, ...MILESTONES]) {
    const desc = `<p><strong>Grants:</strong> ${a.grant}</p><p>${a.note}</p>` +
      (a.effects.length ? "<p><em>This card applies its bonus automatically while on your sheet.</em></p>"
        : "<p><em>Homebrew bonus — tracked by the DM / on a sheet resource (see the Rules bible).</em></p>");
    const doc = feat(a.name, a.img, desc, { flag: a.flag || null, effects: a.effects });
    await writeFile(path.join(OUT, `attr-${a.key}.json`), JSON.stringify(doc, null, 2));
    n++;
  }

  for (const art of ARTS) {
    const desc = `<p><em>${art.cat} Weapon Art.</em></p><p><strong>${art.text}</strong></p>` +
      (art.once ? "<p>Recharges at a bonfire (long rest).</p>" : "");
    const doc = feat(art.name, art.img, desc, { once: !!art.once, requirements: "Skill pick (L6 or L9)" });
    await writeFile(path.join(OUT, `art-${slug(art.name.replace("Weapon Art: ", ""))}.json`), JSON.stringify(doc, null, 2));
    n++;
  }

  console.log(`Generated ${n} level/art items.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
