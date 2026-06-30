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

// Wall helpers: create walls by coordinates and type
function wall(c, move = 0, sight = 0, sound = 0) {
  return { c, move, sight, sound, type: "light", dir: 0, door: 0, ds: 0 };
}

// Light helpers: create ambient lights.
// NOTE: Foundry v13 AmbientLight documents store their light settings under `config`
// (a LightData object) — NOT a `light` key — and `animation` is an object
// { type, speed, intensity, reverse }, not a string. Using the old `light:{ animation:"torch" }`
// shape made Foundry silently drop the settings, so scene lights never actually glowed.
function light(x, y, dim, bright, angle = 360, color = "#ffffff", animation = "none", { speed = 5, intensity = 5, alpha = 0.5 } = {}) {
  const animType = (!animation || animation === "none") ? null : animation;
  return {
    x, y, rotation: 0, walls: false, vision: false, hidden: false,
    config: {
      negative: false, priority: 0, alpha, angle, bright, color,
      coloration: 1, dim, attenuation: 0.5, luminosity: 0.5,
      saturation: 0, contrast: 0, shadows: 0,
      animation: { type: animType, speed, intensity, reverse: false },
      darkness: { min: 0, max: 1 }
    }
  };
}

function scene({ name, navName, order, sqW, sqH, bg = "#0b0d10", gridType = 1, brief, walls = [], lights = [] }) {
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
    drawings: [], tokens: [], lights, notes: [], sounds: [], templates: [], tiles: [], walls, regions: []
  };
}

const SCENES = [
  scene({
    name: "1 · Cemetery of Ash — Gundyr's Arena", navName: "Cemetery", order: 1, sqW: 30, sqH: 24, bg: "#0c0a08",
    brief: "Open grave-strewn slope funnelling DOWN into a circular arena. Scatter ruined pillars (cover) on the approach; the arena floor is clear for Iudex Gundyr. Coiled-sword bonfire at the far edge (do NOT light until after the fight). Teaches W1/W2/W3 on the trash hollows, then the parry on Gundyr; remember the Pus of Man eruption at 0 HP.",
    walls: [
      // Perimeter
      wall([0, 0, 3000, 0], 1, 1), wall([3000, 0, 3000, 2400], 1, 1), wall([3000, 2400, 0, 2400], 1, 1), wall([0, 2400, 0, 0], 1, 1),
      // Pillar covers (scattered obstacles in approach zone)
      wall([800, 400, 900, 500], 1, 1), wall([900, 500, 800, 600], 1, 1), wall([800, 600, 700, 500], 1, 1), wall([700, 500, 800, 400], 1, 1),
      wall([1400, 600, 1500, 700], 1, 1), wall([1500, 700, 1400, 800], 1, 1), wall([1400, 800, 1300, 700], 1, 1), wall([1300, 700, 1400, 600], 1, 1),
      wall([1900, 800, 2000, 900], 1, 1), wall([2000, 900, 1900, 1000], 1, 1), wall([1900, 1000, 1800, 900], 1, 1), wall([1800, 900, 1900, 800], 1, 1),
    ],
    lights: [
      light(2750, 2250, 30, 20, 360, "#ff6600", "torch"), // Coiled-sword bonfire (warm, dimmer before fight)
      light(1500, 1400, 10, 5, 360, "#ffffff", "none"), // Ambient fill
    ]
  }),
  scene({
    name: "2 · Firelink Shrine — Hub", navName: "Firelink", order: 2, sqW: 28, sqH: 22, bg: "#0a0c10",
    brief: "Safe hub. Place the Fire Keeper (throne, leveling), Shrine Handmaid (alcove, shop), Andre (forge, upgrades), and the Sword Master (steps, optional duel / mercy-valve summon). Central bonfire = banking + long rest. No combat here. Drop the Bonfire Ledger token nearby for reference.",
    walls: [
      // Perimeter
      wall([0, 0, 2800, 0], 1, 1), wall([2800, 0, 2800, 2200], 1, 1), wall([2800, 2200, 0, 2200], 1, 1), wall([0, 2200, 0, 0], 1, 1),
      // Internal pillars/columns (decorative)
      wall([600, 500, 600, 700], 1, 1), wall([2200, 500, 2200, 700], 1, 1),
      wall([800, 1200, 1000, 1200], 1, 1), // Throne alcove
    ],
    lights: [
      light(1400, 1100, 40, 25, 360, "#ffaa44", "torch"), // Central bonfire (warm, bright, sanctuary)
      light(400, 800, 20, 10, 360, "#ffcc88", "none"), // Throne area ambient
      light(2400, 1800, 15, 8, 360, "#ffcc88", "none"), // Forge area ambient
    ]
  }),
  scene({
    name: "3 · High Wall — Entry & Hollow Courtyard", navName: "High Wall", order: 3, sqW: 36, sqH: 28, bg: "#10110f",
    brief: "Two-part map: a gated entry hall opening onto a courtyard farm. Place Hollows, a Hollow Soldier (the future Pus of Man), archers on the ramparts, and a Starving Hound pack. This is the soul-farming pocket (Farm Pocket roll table). A Hollow Soldier here can erupt into the Pus of Man (High Wall) if you want a scare before the Outrider.",
    walls: [
      // Perimeter
      wall([0, 0, 3600, 0], 1, 1), wall([3600, 0, 3600, 2800], 1, 1), wall([3600, 2800, 0, 2800], 1, 1), wall([0, 2800, 0, 0], 1, 1),
      // Entry gate / columns
      wall([800, 400, 900, 600], 1, 1), wall([1100, 400, 1200, 600], 1, 1),
      // Courtyard farm walls (scattered obstacles)
      wall([1200, 1200, 1400, 1200], 1, 1), wall([2000, 1000, 2200, 1100], 1, 1),
      wall([1600, 1600, 1800, 1700], 1, 1), wall([2400, 1400, 2600, 1500], 1, 1),
      // Rampart edges (cliffs)
      wall([200, 600, 800, 700], 1, 1), wall([1800, 500, 2400, 600], 1, 1),
    ],
    lights: [
      light(1800, 1400, 25, 15, 360, "#ffbb66", "torch"), // Torches on ramparts
      light(2800, 900, 20, 12, 360, "#ffbb66", "none"),
    ]
  }),
  scene({
    name: "4 · Dragon Bridge — Cover & Perches", navName: "Dragon Bridge", order: 4, sqW: 40, sqH: 20, bg: "#14110c",
    brief: "A long, exposed bridge raked by the Dragon's fire. Mark CLEAR fire lanes down the open span and CONCRETE cover (archways, fallen rubble, the dead zone beneath/behind the perch). Three solutions: bypass via cover, flank ~50 dmg to drive it to a new visible perch, or chase & kill (path C). Charging the open bridge = Teaching Death #2.",
    walls: [
      // Perimeter
      wall([0, 0, 4000, 0], 1, 1), wall([4000, 0, 4000, 2000], 1, 1), wall([4000, 2000, 0, 2000], 1, 1), wall([0, 2000, 0, 0], 1, 1),
      // Bridge railings
      wall([100, 200, 3900, 200], 1, 1), wall([100, 1800, 3900, 1800], 1, 1),
      // Archway covers (left side)
      wall([600, 400, 700, 700], 1, 1), wall([700, 700, 600, 800], 1, 1),
      wall([1200, 350, 1300, 650], 1, 1), wall([1300, 650, 1200, 750], 1, 1),
      // Fallen rubble (center)
      wall([2000, 600, 2200, 900], 1, 1), wall([2200, 900, 2000, 1200], 1, 1),
      // Archway covers (right side)
      wall([3000, 400, 3100, 750], 1, 1), wall([3100, 750, 3000, 850], 1, 1),
    ],
    lights: [
      light(2000, 1000, 15, 8, 360, "#ff8844", "none"), // Dragon fire glow (ambient)
    ]
  }),
  scene({
    name: "5 · Outrider Arena", navName: "Outrider", order: 5, sqW: 26, sqH: 26, bg: "#0b0e12",
    brief: "A tight, enclosed chamber for the Outrider Knight duel — nowhere to turtle. Keep it mostly open with one or two pillars to break charge lanes. The Outrider punishes passivity (extra action if undamaged last round); Frost claws build Frostbite. Teaching Death #3 for a party that plays too safe.",
    walls: [
      // Perimeter
      wall([0, 0, 2600, 0], 1, 1), wall([2600, 0, 2600, 2600], 1, 1), wall([2600, 2600, 0, 2600], 1, 1), wall([0, 2600, 0, 0], 1, 1),
      // Central pillars (2, to break charge lanes)
      wall([800, 900, 900, 1100], 1, 1), wall([900, 1100, 800, 1200], 1, 1), wall([800, 1200, 700, 1100], 1, 1), wall([700, 1100, 800, 900], 1, 1),
      wall([1700, 1400, 1800, 1600], 1, 1), wall([1800, 1600, 1700, 1700], 1, 1), wall([1700, 1700, 1600, 1600], 1, 1), wall([1600, 1600, 1700, 1400], 1, 1),
    ],
    lights: [
      light(1300, 1300, 20, 12, 360, "#bbddff", "none"), // Frost-touched ambient (cool blue)
    ]
  }),
  scene({
    name: "6 · Pus-of-Man Wall & Shortcut", navName: "Pus Wall", order: 6, sqW: 30, sqH: 22, bg: "#0d0b0e",
    brief: "A rampart walk where a 'corpse' hollow erupts into the Pus of Man as the party passes. Tight footing near ledges (grab + ground slam matter). A kicked-down ladder/lift opens the shortcut back toward Firelink. Fire roughly halves this fight — reward firebombs and pyromancy.",
    walls: [
      // Perimeter
      wall([0, 0, 3000, 0], 1, 1), wall([3000, 0, 3000, 2200], 1, 1), wall([3000, 2200, 0, 2200], 1, 1), wall([0, 2200, 0, 0], 1, 1),
      // Rampart edges (cliffs)
      wall([200, 400, 2800, 500], 1, 1), wall([200, 1700, 2800, 1800], 1, 1),
      // Ladder well area
      wall([400, 900, 600, 1100], 1, 1), wall([600, 1100, 400, 1300], 1, 1),
    ],
    lights: [
      light(1500, 1100, 15, 8, 360, "#cc9900", "torch"), // Torchlight on rampart
    ]
  }),
  scene({
    name: "7 · Vordt Arena — Fog Gate", navName: "Vordt", order: 7, sqW: 30, sqH: 30, bg: "#0a0f16",
    brief: "Pre-bonfire + fog gate, then a long frozen hall for Vordt of the Boreal Valley — the climax. Wide enough to run his Frost Charge lane. Phase 2 at 50% adds a cold aura (don't huddle), Frostbreath cone, and Grab-Leap (Teaching Death #4). Vulnerable to fire & lightning. Victory bonfire past the far gate.",
    walls: [
      // Perimeter
      wall([0, 0, 3000, 0], 1, 1), wall([3000, 0, 3000, 3000], 1, 1), wall([3000, 3000, 0, 3000], 1, 1), wall([0, 3000, 0, 0], 1, 1),
      // Fog gate area (pre-fight)
      wall([1200, 600, 1800, 750], 1, 1),
      // Frozen hall columns (sparse)
      wall([600, 1500, 700, 1700], 1, 1), wall([2300, 1500, 2400, 1700], 1, 1),
      wall([400, 2300, 500, 2500], 1, 1), wall([2500, 2300, 2600, 2500], 1, 1),
    ],
    lights: [
      light(1500, 800, 12, 6, 360, "#bbddff", "none"), // Fog gate ambient (cool, eerie)
      light(1500, 2700, 30, 20, 360, "#ff6600", "torch"), // Victory bonfire (warm, far end)
      light(600, 1600, 10, 5, 360, "#bbddff", "none"), // Frozen column glow
      light(2400, 1600, 10, 5, 360, "#bbddff", "none"),
    ]
  }),
  scene({
    name: "0 · Region Overview (Cemetery → Vordt)", navName: "Map", order: 0, sqW: 32, sqH: 24, bg: "#08090b", gridType: 0,
    brief: "Gridless overview the players can see between scenes: Cemetery of Ash → Firelink Shrine (hub) → High Wall (farm + Dragon Bridge fork) → Outrider → Pus Wall shortcut → Vordt. Use it to show the dragon perched in sight on the bridge and to orient backtracking to Firelink.",
    walls: [], lights: [] // No walls/lights on the overview map
  })
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
