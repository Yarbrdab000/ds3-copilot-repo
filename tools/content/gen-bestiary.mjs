#!/usr/bin/env node
/**
 * Generator for the Ashen bestiary pack (actors-bestiary). Editable SOURCE for
 * src/actors/bestiary/. Re-run `node tools/content/gen-bestiary.mjs`.
 *
 * Lean roster (per design): 6 regular enemies + 6 boss/mini actors. Numbers and movesets
 * mirror the DM Codex journal exactly. Each actor is a dnd5e v5 NPC with AC/HP/speed/CR,
 * vulnerabilities, legendary actions (bosses), and embedded weapon attacks so tokens can act.
 * The full 3x3 Defensive Profiles live in the Codex journal; the bio carries a compact summary.
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../src/actors/bestiary");
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function attack({ name, img, n, d, bonus, types, ability = "str", reach = 5, ranged = false, range = null }) {
  return {
    name, type: "weapon", img: img || "icons/skills/melee/strike-slashes-orange.webp", effects: [], flags: {},
    system: {
      description: { value: "", chat: "" },
      source: { book: "Ashen", page: "", custom: "Bestiary", license: "CC-BY-4.0", rules: "2014" },
      quantity: 1, weight: { value: 0, units: "lb" }, price: { value: 0, denomination: "gp" },
      equipped: true, identified: true, proficient: 1,
      range: ranged ? { value: String(range?.[0] ?? 60), long: String(range?.[1] ?? 120), units: "ft", reach: null }
                    : { value: null, long: null, units: "ft", reach: String(reach) },
      damage: {
        base: { number: n, denomination: d, bonus: String(bonus), types,
          custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } },
        versatile: { number: null, denomination: null, bonus: "", types: [], custom: { enabled: false, formula: "" }, scaling: { mode: "", number: null, formula: "" } }
      },
      properties: [], type: { value: ranged ? "natural" : "natural", baseItem: "" },
      uses: { max: "", recovery: [], spent: 0 },
      activities: {
        dnd5eactivity000: {
          _id: "dnd5eactivity000", type: "attack", name: "", img: "", sort: 0,
          activation: { type: "action", value: 1, condition: "", override: false },
          consumption: { targets: [], scaling: { allowed: false, max: "" }, spellSlot: false },
          description: { chatFlavor: "" },
          duration: { concentration: false, value: "", units: "inst", special: "", override: false },
          effects: [], range: { units: ranged ? "ft" : "", special: "", override: false },
          target: { template: { contiguous: false, units: "ft", type: "" }, affects: { choice: false }, override: false, prompt: true },
          uses: { spent: 0, max: "", recovery: [] },
          attack: { ability, bonus: "", critical: { threshold: null }, flat: false, type: { value: ranged ? "ranged" : "melee", classification: "weapon" } },
          damage: { critical: { bonus: "" }, includeBase: true, parts: [] }
        }
      },
      identifier: slug(name)
    }
  };
}

function npc({ name, img, ac, hp, hpFormula, walk = 30, fly = 0, reach = 5, cr, ctype = "humanoid",
  size = "med", str = 11, dex = 11, con = 11, int = 6, wis = 9, cha = 6,
  vuln = [], legact = 0, souls, role, bioHtml, attacks = [], disposition = -1 }) {
  const abilities = {};
  for (const [k, v] of Object.entries({ str, dex, con, int, wis, cha })) {
    abilities[k] = { value: v, proficient: 0, bonuses: { check: "", save: "" }, max: null };
  }
  return {
    name, type: "npc", img: img || null, effects: [], flags: { ashen: { souls, role } },
    system: {
      abilities,
      attributes: {
        ac: { flat: ac, calc: "flat", formula: "" },
        hp: { value: hp, max: hp, temp: null, tempmax: null, formula: hpFormula || "" },
        init: { ability: "", bonus: "0" },
        movement: { burrow: 0, climb: 0, fly, swim: 0, walk, units: "ft", hover: false },
        attunement: { max: 3 },
        senses: { darkvision: 30, blindsight: 0, tremorsense: 0, truesight: 0, units: "ft", special: "" },
        spellcasting: "", exhaustion: 0,
        concentration: { ability: "", bonuses: { save: "" }, limit: 1 }, hd: { spent: 0 }
      },
      details: {
        biography: { value: bioHtml, public: "" }, alignment: "Hollow", race: null,
        type: { value: ctype, subtype: "", swarm: "", custom: "" }, environment: "Lothric", cr, spellLevel: 0,
        source: { book: "Ashen", page: "", custom: "DS3", license: "CC-BY-4.0", rules: "2014" }
      },
      traits: {
        size,
        di: { value: [], bypasses: [], custom: "" }, dr: { value: [], bypasses: [], custom: "" },
        dv: { value: vuln, bypasses: [], custom: "" }, ci: { value: [], custom: "" },
        languages: { value: [], custom: "" }, dm: { amount: {}, bypasses: [] }
      },
      skills: {},
      bonuses: { mwak: { attack: "", damage: "" }, rwak: { attack: "", damage: "" }, msak: { attack: "", damage: "" }, rsak: { attack: "", damage: "" }, abilities: { check: "", save: "", skill: "" }, spell: { dc: "" } },
      resources: { legact: { value: legact, max: legact }, legres: { value: 0, max: 0 }, lair: { value: false, initiative: null } },
      spells: {}, currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 }, tools: {},
      source: { book: "Ashen", page: "", custom: "DS3", license: "CC-BY-4.0", rules: "2014" }
    },
    items: attacks,
    prototypeToken: {
      name, displayName: 20, actorLink: false, width: size === "huge" ? 3 : size === "lg" ? 2 : 1, height: size === "huge" ? 3 : size === "lg" ? 2 : 1,
      lockRotation: false, rotation: 0, disposition, displayBars: 20,
      bar1: { attribute: "attributes.hp" }, bar2: { attribute: null }, randomImg: false, alpha: 1, flags: {},
      texture: { src: img || "icons/svg/mystery-man.svg", tint: "#ffffff", scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0, anchorX: 0.5, anchorY: 0.5, fit: "contain", alphaThreshold: 0.75 },
      sight: { angle: 360, enabled: false, range: 0, brightness: 0, visionMode: "basic", color: null, attenuation: 0.1, saturation: 0, contrast: 0 },
      detectionModes: [], appendNumber: true, prependAdjective: false
    }
  };
}

const FIRE = "fire", COLD = "cold", PI = "piercing", SL = "slashing", BL = "bludgeoning";

// ── Boss HP model (spec §11) ─────────────────────────────────────────────────
// HP is NOT an attrition clock — a correct defense negates the hit, so HP measures
// "how many rounds of correct reading the party must sustain."
//   Boss HP = target_rounds × party_size × per-player damage/round (DPP)
// DPP is MEASURED from the real pregens (weapon dice + scaling grade + upgrade + invested
// Str/Dex + Extra Attack/milestone strike + Rage/Sneak), taken as the midpoint of a
// defensive vs aggressive party at each act's level band. Re-audit at the table with the
// round-1 rule (see DM Handbook "Damage & Boss HP"). HP here is tuned for PARTY_BASELINE
// players; the Level-Up/Assemble flow and Handbook tell the DM to scale ×(players / 4).
const PARTY_BASELINE = 4;
const DPP = { act1: 5.5, mini: 12, dragon: 9, vordt: 26 }; // per-player dmg/round by act band
function bossHP(targetRounds, band) {
  const v = Math.round((targetRounds * PARTY_BASELINE * DPP[band]) / 5) * 5; // round to nearest 5
  return { hp: v, hpFormula: String(v) };
}

function card(title, moves, tell) {
  let h = `<p><em>${title}</em></p><p><strong>Moveset (full Defensive Profiles in the DM Codex):</strong></p><ul>`;
  for (const m of moves) h += `<li>${m}</li>`;
  h += "</ul>";
  if (tell) h += `<p><strong>Tell Ladder:</strong> ${tell}</p>`;
  return h;
}

const ACTORS = [
  // ───── Regular roster (6) ─────
  npc({ name: "Hollow", img: "icons/creatures/skeletons/skeleton-worn-skull-tan.webp", ac: 10, hp: 7, hpFormula: "2d6", cr: 0.125, souls: 30, role: "fodder", str: 9, dex: 9, con: 10,
    bioHtml: card("Crawling fodder. Teaches the W1/W2/W3 rhythm in one exchange.", ["<strong>Desperate Lunge</strong> (1d6+1): dodge ADV on W2; parryable W2."]),
    attacks: [attack({ name: "Desperate Lunge", n: 1, d: 6, bonus: 1, types: [SL] })] }),
  npc({ name: "Hollow Soldier", img: "icons/creatures/magical/spirit-undead-armored-grey.webp", ac: 14, hp: 16, hpFormula: "3d8+3", cr: 0.5, souls: 50, role: "backbone", str: 13, dex: 11, con: 12,
    bioHtml: card("Sword &amp; shield backbone. The baseline parry trainer. A Hollow Soldier is what erupts into the Pus of Man.", ["<strong>Shielded Chop</strong> (1d8+2): dodge ADV W2; parry ADV W3 (clean swing)."]),
    attacks: [attack({ name: "Shielded Chop", n: 1, d: 8, bonus: 2, types: [SL] })] }),
  npc({ name: "Hollow Assassin", img: "icons/creatures/magical/spirit-undead-ghost-purple.webp", ac: 13, hp: 12, hpFormula: "3d8-1", cr: 0.5, souls: 60, role: "ranged", str: 9, dex: 15, con: 10,
    bioHtml: card("Crossbow / throwing-knife harasser. Close the distance.", ["<strong>Snap Shot / Backstab</strong> (1d8+3, ADV if you're unaware): dodge ADV W2 if you see the tell; unparryable (ranged)."]),
    attacks: [attack({ name: "Snap Shot", n: 1, d: 8, bonus: 3, types: [PI], ability: "dex", ranged: true, range: [80, 320] })] }),
  npc({ name: "Hollow Manservant", img: "icons/creatures/magical/humanoid-silhouette-glowing-pink.webp", ac: 13, hp: 22, hpFormula: "4d8+4", cr: 1, souls: 100, role: "elite-farm", str: 15, dex: 10, con: 13,
    bioHtml: card("Elite cleaver-wielder; the reliable courtyard farm target.", ["<strong>Heavy Cleaver Overhead</strong> (2d6+3): dodge ADV W2; parry ADV W3; blockable but chips through (heavy)."]),
    attacks: [attack({ name: "Heavy Cleaver", n: 2, d: 6, bonus: 3, types: [SL] })] }),
  npc({ name: "Lothric Knight", img: "icons/equipment/chest/breastplate-helmet-metal.webp", ac: 17, hp: 30, hpFormula: "4d8+12", cr: 2, souls: 150, role: "elite-guard", str: 15, dex: 13, con: 14,
    bioHtml: card("Disciplined elite guard. A real threat in numbers; the wall's last line before Vordt.", ["<strong>Disciplined Thrust</strong> (1d10+4, reach): dodge ADV (sidestep) W2; parry ADV W2 (clean thrust)."]),
    attacks: [attack({ name: "Disciplined Thrust", n: 1, d: 10, bonus: 4, types: [PI], reach: 10 })] }),
  npc({ name: "Starving Hound", img: "icons/creatures/abilities/wolf-howl-moon-purple.webp", ac: 13, hp: 9, hpFormula: "2d6+2", cr: 0.25, souls: 40, role: "fast-pack", ctype: "beast", str: 12, dex: 15, con: 12,
    bioHtml: card("Fast pack hunter. Dangerous in numbers; swarms and knocks prone. Punishes a turtling party.", ["<strong>Pounce</strong> (1d6+2 + knockdown on a fail): dodge ADV W2; unparryable."]),
    attacks: [attack({ name: "Pounce", n: 1, d: 6, bonus: 2, types: [PI], ability: "dex" })] }),

  // ───── Bosses / minis (6) ─────
  npc({ name: "Iudex Gundyr", img: "icons/skills/melee/strike-weapon-polearm-blood-red.webp", ac: 16, ...bossHP(3.4, "act1"), cr: 5, souls: 2500, role: "major-boss", size: "lg", legact: 2,
    str: 18, dex: 12, con: 15, ctype: "undead",
    bioHtml: card("First major boss; the forgiving teacher. <strong>Be generous.</strong> At 0 HP he does NOT die \u2014 the Pus of Man erupts (deploy the <em>Pus of Man (Gundyr Eruption)</em> actor). 2 legendary actions: halberd jab 1d10+4; 5-ft reposition.",
      ["<strong>Overhead Chop</strong> (2d10+4): parry ADV W3 \u2014 the move that teaches parry.", "<strong>Wide Sweep</strong> (arc 2d10+4): dodge ADV W2; unparryable.", "<strong>Thrust Lunge</strong> (reach 2d10+4): dodge/parry ADV W2.", "<strong>Shield Kick</strong> (1d8+4, push): unparryable &amp; unblockable \u2014 it exists to punish turtling; dodge W2."],
      "(1) overhead hangs before it falls \u2192 parry it; (2) the sweep can only be slipped under; (3) his shield-bash can't be blocked or parried \u2014 don't raise your guard, just step out of it; (4) when he 'dies', he doesn't \u2014 keep a flask.") ,
    attacks: [attack({ name: "Halberd Chop", n: 2, d: 10, bonus: 4, types: [SL], reach: 10 })] }),
  npc({ name: "Pus of Man (Gundyr Eruption)", img: "icons/creatures/tentacles/tentacles-thorned-purple.webp", ac: 15, ...bossHP(3, "act1"), cr: 5, souls: 0, role: "major-boss-p2", size: "lg", reach: 15,
    str: 18, dex: 10, con: 16, ctype: "aberration", vuln: [FIRE],
    bioHtml: card("Phase 2 of Gundyr \u2014 the black tendril-mass. Souls roll into Gundyr's 2,500. <strong>Vulnerable to fire.</strong> This is Teaching Death #1 against a relieved, low-Estus party.",
      ["<strong>Tendril Multi-lash</strong> (up to 3 PCs, 2d8+4 each): dodge ADV W2; unparryable.", "<strong>Grab</strong> (1d10 + grappled 2d6/rd, escape DC 14): dodge EARLY on W1; un-block/parry.", "<strong>Ground Slam</strong> (10-ft burst 3d8 + prone): dodge out on W1; punishes clustering."]),
    attacks: [attack({ name: "Tendril Lash", n: 2, d: 8, bonus: 4, types: [BL], reach: 15 })] }),
  npc({ name: "Outrider Knight", img: "icons/creatures/magical/spirit-undead-armored-blue.webp", ac: 17, ...bossHP(4, "mini"), cr: 4, souls: 1000, role: "mini-boss", size: "med", walk: 40,
    str: 16, dex: 16, con: 14, ctype: "undead",
    bioHtml: card("Fast, relentless duel that PUNISHES passivity (Teaching Death #3). <strong>Anti-turtle:</strong> if no PC damaged it last round, it gains an extra action this round. Frost claws build Frostbite.",
      ["<strong>Triple Claw Combo</strong> (3 x 1d8+3 + Frostbite): dodge ADV W2; parry ADV only on W3.", "<strong>Frost Lunge</strong> (40-ft gap-closer, 2d8+3): sidestep the LINE on W1; undodgeable head-on; unblockable (a charge \u2014 don't try to wall it).", "<strong>Pounce</strong> (turtle punish, 2d10+3 + prone): only when the party went passive."],
      "(1) standing still feeds it; (2) the triple-swipe over-commits on the last claw; (3) cut sideways out of its charge lane.") ,
    attacks: [attack({ name: "Frost Claw", n: 1, d: 8, bonus: 3, types: [SL], ability: "dex" })] }),
  npc({ name: "Pus of Man (High Wall)", img: "icons/creatures/tentacles/tentacles-suctioncups-pink.webp", ac: 14, ...bossHP(4, "mini"), cr: 4, souls: 1000, role: "mini-boss", size: "lg", reach: 15,
    str: 17, dex: 10, con: 16, ctype: "aberration", vuln: [FIRE],
    bioHtml: card("A 'dead' hollow on the wall bursts into an abomination as the party passes. <strong>Vulnerable to fire (takes double)</strong> \u2014 a firebomb or pyromancer roughly halves the fight.",
      ["<strong>Whipping Tendrils</strong> (up to 2 PCs, 2d6+3): dodge ADV W2; unparryable.", "<strong>Lunge Bite</strong> (2d8+3): parry ADV W2 \u2014 a clean, committed lunge.", "<strong>Black Spew</strong> (15-ft cone 3d6 poison + reduced healing): dodge out on W1; unparryable."],
      "One rung is enough: fire makes it scream and shrivel.") ,
    attacks: [attack({ name: "Lunge Bite", n: 2, d: 8, bonus: 3, types: [PI], reach: 15 })] }),
  npc({ name: "The Dragon", img: "icons/creatures/reptiles/dragon-fire-breathing-orange.webp", ac: 18, ...bossHP(5.5, "dragon"), cr: 8, souls: 4000, role: "secret-boss", size: "huge", walk: 40, fly: 80,
    str: 23, dex: 12, con: 19, ctype: "dragon",
    bioHtml: card("Optional, killable secret boss on the rampart \u2014 visible the whole time. Teaching Death #2: charging the open bridge = incineration. <strong>Three paths:</strong> (A) bypass via cover; (B) flank ~50 dmg in the dead zone \u2192 it flies to a new visible perch; (C) chase &amp; kill for the full reward + unique drop. Souls 3,000\u20134,000 (path C only).",
      ["<strong>Fire Breath</strong> (bridge rake, 4d8 fire): unblock/parry/dodge in the open \u2014 the ONLY answer is COVER. The dead zone beneath/behind it is safe.", "<strong>Tail Sweep</strong> (dead-zone, arc 3d10 + prone): dodge ADV W2; unparryable.", "<strong>Claw &amp; Bite</strong> (3d8+5): the bite (W3) is parryable \u2014 staggers a dragon."],
      "(1) the open bridge is a killing field; (2) the fire comes in waves \u2014 advance in the lulls; (3) beneath/behind it the flame can't reach, but mind the tail.") ,
    attacks: [attack({ name: "Fire Breath (4d8, Dex save)", n: 4, d: 8, bonus: 0, types: [FIRE], ranged: true, range: [60, 60] }), attack({ name: "Claw", n: 3, d: 8, bonus: 5, types: [SL], reach: 10 })] }),
  npc({ name: "Vordt of the Boreal Valley", img: "icons/skills/melee/strike-weapon-polearm-ice-blue.webp", ac: 18, ...bossHP(6, "vordt"), cr: 6, souls: 3000, role: "major-boss", size: "lg", walk: 40, legact: 3,
    str: 20, dex: 11, con: 15, ctype: "monstrosity", vuln: [FIRE, "lightning"],
    bioHtml: card("The climax and final exam. <strong>Vulnerable to fire and thunder/lightning</strong> (frost-brittle joints). Builds Frostbite on frost hits. <strong>Phase 2 at 50% HP</strong> (Teaching Death #4): frenzy, cold aura (end turn within 10 ft = 1 Frostbite), adds Frostbreath Cone and Grab-Leap. 2\u20133 legendary actions.",
      ["<strong>Overhead Mace Smash</strong> (2d8+5): parry ADV W3; blockable but chips hard (heavy).", "<strong>Wide Sweep</strong> (arc 2d8+5 + Frostbite): dodge ADV W2; unparryable.", "<strong>Frost Charge</strong> (line 3d8+5 + heavy Frostbite + prone): sidestep the lane W1; undodgeable head-on; unblockable (charge).", "<strong>P2 Frostbreath Cone</strong> (20-ft 3d8 cold + 2 Frostbite): dodge out W1.", "<strong>P2 Grab-Leap</strong> (3d10 + prone + 2 Frostbite): dodge on the read W1."],
      "(1) the cold builds \u2014 don't huddle near him; (2) break sideways out of his charge, then punish the overhead; (3) fire and lightning crack his frozen joints.") ,
    attacks: [attack({ name: "Great Mace", n: 2, d: 8, bonus: 5, types: [BL], reach: 10 })] }),

  // ───── Firelink Shrine NPCs (friendly / service) ─────
  npc({ name: "Fire Keeper", img: "icons/magic/fire/flame-burning-women-blue.webp", ac: 12, hp: 22, hpFormula: "4d8+4", cr: 1, souls: 0, role: "service-npc", disposition: 1,
    str: 9, dex: 12, con: 12, int: 13, wis: 16, cha: 15, ctype: "humanoid",
    bioHtml: "<p><em>\"Welcome to Firelink Shrine, Unkindled One. I shall stay by your side until the day you become Cinder.\"</em></p><p><strong>Service \u2014 leveling.</strong> Blind, gentle, and bound to the flame, the Fire Keeper turns banked souls into strength. Run the <strong>Level Up</strong> macro and walk the player through the <em>Level-Up Menu Cards</em> journal. She also reinforces the Estus Flask with Estus Shards (add a charge, cap 6). Non-combatant \u2014 if she is ever threatened, the scene is already lost.</p>" }),
  npc({ name: "Shrine Handmaid", img: "icons/magic/death/hand-withered-gray.webp", ac: 11, hp: 18, hpFormula: "4d8", cr: 0.5, souls: 0, role: "service-npc", disposition: 1,
    str: 8, dex: 9, con: 10, int: 11, wis: 12, cha: 8, ctype: "humanoid",
    bioHtml: "<p><em>\"Ahh, hello. Have you come for goods? Or perhaps... to relieve yourself of souls?\"</em></p><p><strong>Service \u2014 shop.</strong> A hunched crone who trades in banked souls. Prices and stock are in the <em>Firelink Services</em> journal; the <em>Shrine Handmaid \u2014 Restock</em> roll table drifts her inventory between visits. Non-combatant.</p>" }),
  npc({ name: "Andre of Astora", img: "icons/skills/trades/smithing-anvil-silver-red.webp", ac: 14, hp: 38, hpFormula: "5d8+15", cr: 2, souls: 0, role: "service-npc", disposition: 1,
    str: 16, dex: 12, con: 16, int: 11, wis: 12, cha: 12, ctype: "humanoid",
    bioHtml: "<p><em>\"Need something reinforced? You've come to the right place. Titanite, and I'll see to the rest.\"</em></p><p><strong>Service \u2014 the forge.</strong> A tireless blacksmith who reinforces weapons and catalysts with titanite + souls (cap +3) and stokes the Pyromancy Flame. Upgrade tables are in the <em>Firelink Services</em> and <em>Weapon Scaling &amp; Upgrades</em> journals. Burly enough to defend himself, but not meant to fight.</p>",
    attacks: [attack({ name: "Smith's Hammer", n: 1, d: 8, bonus: 3, types: [BL] })] }),
  npc({ name: "Sword Master", img: "icons/skills/melee/sword-katana-gray.webp", ac: 16, hp: 60, hpFormula: "8d8+24", cr: 4, souls: 800, role: "duel-npc-and-mercy-valve", disposition: 0, walk: 35,
    str: 13, dex: 18, con: 16, int: 12, wis: 14, cha: 11, ctype: "humanoid",
    bioHtml: card("<strong>Two roles.</strong> (1) Optional <em>duel</em> by the shrine steps \u2014 a fast, parry-heavy katana master who teaches the defensive game and drops 800 souls + a fine blade if bested (disposition starts neutral; he turns hostile only if challenged). (2) The <strong>mercy valve</strong>: after repeated wipes, the DM may drop him as a <em>controllable ally token</em> (a summon sign answered) to steady a struggling party for one fight. Set his disposition to friendly when summoned.",
      ["<strong>Iaido Double-Slash</strong> (2 x 1d8+4): dodge ADV W2; parry ADV only on W3 (the second cut).", "<strong>Parry Stance</strong> (reaction): he parries the next melee attack you telegraph \u2014 feint or go unorthodox.", "<strong>Step Thrust</strong> (reach 1d10+4): sidestep the line W1; parry ADV W2."],
      "(1) he reads obvious swings \u2014 mix your timing; (2) his double-slash over-commits on the second cut; (3) he's a teacher, not a wall \u2014 patience wins.") ,
    attacks: [attack({ name: "Uchigatana", n: 1, d: 8, bonus: 4, types: [SL], ability: "dex" })] })
];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  let i = 0;
  for (const a of ACTORS) {
    await writeFile(path.join(OUT, `${String(++i).padStart(2, "0")}-${slug(a.name)}.json`), JSON.stringify(a, null, 2));
  }
  console.log(`Generated ${ACTORS.length} bestiary actors.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
