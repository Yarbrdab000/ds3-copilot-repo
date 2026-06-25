#!/usr/bin/env node
/**
 * Generator for the Ashen scenes pack. Editable SOURCE for src/scenes/.
 * Re-run `node tools/content/gen-scenes.mjs`.
 *
 * Copyright-safe approach: each scene ships with an ORIGINAL, grid-aligned tactical battlemap
 * rendered by tools/content/gen-maps.mjs into maps/<slug>.webp (square 5-ft grid, NO FromSoftware
 * art, no baked gridlines — Foundry draws the grid). The map is wired in as background.src below,
 * so backgrounds appear with zero setup. A DM who prefers painted art can swap the file or use the
 * AI-prompt / free-CC sources in the "Maps & Scenes" journal. Each scene also carries a short layout
 * brief on flags.ashen so it is self-documenting on import.
 *
 * NOTE: scene filename slug and map filename slug both derive from slug(navName||name) — keep them
 * in lockstep with gen-maps.mjs (which reads these scene files for dimensions).
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const OUT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../../src/scenes");
function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function scene({ name, navName, order, sqW, sqH, bg = "#0b0d10", gridType = 1, brief }) {
  const fileSlug = slug(navName || name);
  return {
    name, active: false, navigation: true, navName: navName || "", navOrder: order, sort: order * 100,
    folder: null, ownership: { default: 0 },
    flags: { ashen: { brief } },
    background: { src: `modules/ashen-of-lothric/maps/${fileSlug}.webp`, offsetX: 0, offsetY: 0, fit: "fill", tint: "#ffffff" },
    foreground: null, foregroundElevation: 20, thumb: null,
    width: sqW * 100, height: sqH * 100, padding: 0.25,
    initial: { x: null, y: null, scale: null },
    backgroundColor: bg,
    grid: { type: gridType, size: 100, style: "solidLines", thickness: 1, color: "#000000", alpha: gridType === 0 ? 0 : 0.2, distance: 5, units: "ft" },
    tokenVision: true, fogExploration: gridType !== 0, fogReset: null, fogOverlay: null,
    fogUnexploredColor: "#000000", fogExploredColor: "#000000",
    drawings: [], tokens: [], lights: [], notes: [], sounds: [], templates: [], tiles: [], walls: [], regions: []
  };
}

const SCENES = [
  scene({ name: "1 · Cemetery of Ash — Gundyr's Arena", navName: "Cemetery", order: 1, sqW: 30, sqH: 24, bg: "#0c0a08",
    brief: "Open grave-strewn slope funnelling DOWN into a circular arena. Scatter ruined pillars (cover) on the approach; the arena floor is clear for Iudex Gundyr. Coiled-sword bonfire at the far edge (do NOT light until after the fight). Teaches W1/W2/W3 on the trash hollows, then the parry on Gundyr; remember the Pus of Man eruption at 0 HP." }),
  scene({ name: "2 · Firelink Shrine — Hub", navName: "Firelink", order: 2, sqW: 28, sqH: 22, bg: "#0a0c10",
    brief: "Safe hub. Place the Fire Keeper (throne, leveling), Shrine Handmaid (alcove, shop), Andre (forge, upgrades), and the Sword Master (steps, optional duel / mercy-valve summon). Central bonfire = banking + long rest. No combat here. Drop the Bonfire Ledger token nearby for reference." }),
  scene({ name: "3 · High Wall — Entry & Hollow Courtyard", navName: "High Wall", order: 3, sqW: 36, sqH: 28, bg: "#10110f",
    brief: "Two-part map: a gated entry hall opening onto a courtyard farm. Place Hollows, a Hollow Soldier (the future Pus of Man), archers on the ramparts, and a Starving Hound pack. This is the soul-farming pocket (Farm Pocket roll table). A Hollow Soldier here can erupt into the Pus of Man (High Wall) if you want a scare before the Outrider." }),
  scene({ name: "4 · Dragon Bridge — Cover & Perches", navName: "Dragon Bridge", order: 4, sqW: 40, sqH: 20, bg: "#14110c",
    brief: "A long, exposed bridge raked by the Dragon's fire. Mark CLEAR fire lanes down the open span and CONCRETE cover (archways, fallen rubble, the dead zone beneath/behind the perch). Three solutions: bypass via cover, flank ~50 dmg to drive it to a new visible perch, or chase & kill (path C). Charging the open bridge = Teaching Death #2." }),
  scene({ name: "5 · Outrider Arena", navName: "Outrider", order: 5, sqW: 26, sqH: 26, bg: "#0b0e12",
    brief: "A tight, enclosed chamber for the Outrider Knight duel — nowhere to turtle. Keep it mostly open with one or two pillars to break charge lanes. The Outrider punishes passivity (extra action if undamaged last round); Frost claws build Frostbite. Teaching Death #3 for a party that plays too safe." }),
  scene({ name: "6 · Pus-of-Man Wall & Shortcut", navName: "Pus Wall", order: 6, sqW: 30, sqH: 22, bg: "#0d0b0e",
    brief: "A rampart walk where a 'corpse' hollow erupts into the Pus of Man as the party passes. Tight footing near ledges (grab + ground slam matter). A kicked-down ladder/lift opens the shortcut back toward Firelink. Fire roughly halves this fight — reward firebombs and pyromancy." }),
  scene({ name: "7 · Vordt Arena — Fog Gate", navName: "Vordt", order: 7, sqW: 30, sqH: 30, bg: "#0a0f16",
    brief: "Pre-bonfire + fog gate, then a long frozen hall for Vordt of the Boreal Valley — the climax. Wide enough to run his Frost Charge lane. Phase 2 at 50% adds a cold aura (don't huddle), Frostbreath cone, and Grab-Leap (Teaching Death #4). Vulnerable to fire & lightning. Victory bonfire past the far gate." }),
  scene({ name: "0 · Region Overview (Cemetery → Vordt)", navName: "Map", order: 0, sqW: 32, sqH: 24, bg: "#08090b", gridType: 0,
    brief: "Gridless overview the players can see between scenes: Cemetery of Ash → Firelink Shrine (hub) → High Wall (farm + Dragon Bridge fork) → Outrider → Pus Wall shortcut → Vordt. Use it to show the dragon perched in sight on the bridge and to orient backtracking to Firelink." })
];

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const s of SCENES) {
    await writeFile(path.join(OUT, `${slug(s.navName || s.name)}.json`), JSON.stringify(s, null, 2));
  }
  console.log(`Generated ${SCENES.length} scenes.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
