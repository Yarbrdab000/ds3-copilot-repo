# Authoring Guide — Editing & Rebuilding the Ashen Module

This is the **complete** guide to changing anything in this module: new bosses, attacks,
defense windows, spells, gear, pregens, loot, maps, scenes, journals, macros, and difficulty.
It is written so a person **or an AI (ChatGPT/Copilot)** can take the zipped repo and build a
brand-new campaign with zero prior context.

> **Golden rule:** edit the **source** under `tools/content/*.mjs` and `src/`, then run one
> command (`npm run rebuild`). Everything in `packs/`, `dist/`, `maps/` is **generated** — do
> not edit those by hand; they get overwritten.

---

## 0. The mental model

```
tools/content/gen-*.mjs   ──run──▶   src/**/*.json   ──pack──▶   packs/   ──zip──▶   dist/ash...zip
   (you edit these)                  (generated)                 (generated)         (install in Foundry)
scripts/ashen*.mjs        ───────────────────────────────────────────────────────▶  ships as-is (live code)
art/maps + tokens         ───────────────────────────────────────────────────────▶  ship as-is (your images)
module.json               (packs list, version, scripts) — edit by hand
```

Two kinds of content:
1. **Generated** (most of it): a `gen-*.mjs` script holds a JS table → writes `src/` JSON → packed.
   Edit the table, re-run, done.
2. **Hand-written JSON**: the **journals** in `src/journals/` are edited directly (no generator).

---

## 1. One-time setup

```bash
npm install              # installs the Foundry CLI + canvas (image) deps
node --version           # need Node 18+
```

Core commands (from package.json):

| Command | What it does |
|---|---|
| `npm run rebuild` | Regenerate ALL source from generators → pack → zip. **Use this 99% of the time.** |
| `npm run build`   | Pack `src/` → `packs/` only (skip generators) |
| `npm run build:world` | Pack + zip into `dist/` |
| `npm run validate` | Parse every source JSON, report errors |
| `npm run unpack`  | Reverse: `packs/` → `src/` (recover hand edits made in Foundry) |
| `npm run maps`    | Re-render battlemaps only |

Output to install: `dist/ashen-of-lothric.zip` and `dist/ashen-of-lothric/module.json`.

---

## 2. What each generator owns

All live in `tools/content/`. Edit the table at the top, then `npm run rebuild`.

| File | Makes | Edit it to… |
|---|---|---|
| `gen-bestiary.mjs` | enemies & bosses + their attacks/defense windows | add/retune monsters & moves |
| `gen-pregens.mjs` | 10 player pregens (level-3) | change classes, stats, gear, spells |
| `gen-spells.mjs` | sorceries/miracles/pyromancies | add/reskin spells |
| `gen-gear.mjs` | weapons, armor, shields, estus, consumables, embers | add items, set block %, damage |
| `gen-levels.mjs` | level-up / attribute cards | change leveling rewards |
| `gen-tables.mjs` | loot & soul roll tables | tune drops |
| `gen-macros.mjs` | bonfire/souls/teardown macros | automation buttons |
| `gen-scenes.mjs` | scene list + dimensions | add maps; **runs before gen-maps** |
| `gen-maps.mjs` | renders `maps/<slug>.webp` battlemaps | placeholder art (replace w/ your own) |
| `campaign-config.json` | difficulty/pacing dials | quick balance, no code |

---

## 3. Add or edit a boss / enemy — `gen-bestiary.mjs`

Each enemy is an `npc({...})` with `attacks:[ attack({...}) ]`. Copy a block, rename, tweak.

```js
npc({ name: "Vordt", img: "modules/ashen-of-lothric/tokens/vordt.png",
  ac: 16, ...bossHP(5, "vordt"), cr: 8, souls: 3000, role: "major-boss",
  size: "lg", legact: 2, str: 20, dex: 10, con: 18, ctype: "undead",
  vuln: ["fire"],                                   // damage vulnerabilities
  bioHtml: card("Boss blurb", ["Move list shown to DM"], "Tell-ladder hints"),
  attacks: [
    attack({ name: "Mace Smash", n: 2, d: 10, bonus: 5, types: [BL], reach: 10,
      def: { dc: 15, dw: "W2", pw: "W3" } }),
    attack({ name: "Frost Charge", n: 2, d: 8, bonus: 5, types: [COLD],
      def: { dc: 15, dw: "W1", nb: true, np: true } }),  // unblockable+unparryable
  ] }),
```

**`attack()` fields:** `name`, `n`+`d`+`bonus` = damage `Nd D + bonus`, `types` (`SL/PI/BL/FIRE/COLD`),
`ability` (`str`/`dex`), `reach`, `ranged:true`+`range:[short,long]`, and `def` (the windows).

**`def` = the defense profile (the whole windowed system):**
| key | meaning |
|---|---|
| `dc` | defense DC — d20 must meet/beat this to dodge or parry |
| `dw` | dodge ADV window (`W1` wind-up / `W2` commit / `W3` impact) |
| `pw` | parry ADV window |
| `nd` | `true` = undodgeable |
| `nb` | `true` = unblockable |
| `np` | `true` = unparryable |

If a move has **no `def`**, the DM gets a one-time popup to set the window. The damage applied
by the defense script is the move's `n d + bonus`, scaled by the player's reaction.

**HP** comes from `bossHP(targetRounds, band)` (`act1/mini/dragon/vordt` bands in the file) or
`ac/hp/hpFormula` directly. Tune the `DPP` table (~line 117) for global boss toughness.

---

## 4. Editing the live defense system — `scripts/ashen-defense.mjs`

This is shipped JS (not generated). Current rules: bosses auto-hit (AC ignored), the timing
window sets ADV/DIS on a flat d20 vs `dc`, armor = flat damage reduction, block needs a shield,
damage auto-rolls/applies. To change the **armor values** edit `guardBonus()`; **block %** comes
from gear `flags.ashen.block`; tweak text/multipliers in `resolve()`. Bump `version` in
`module.json` after script edits so Foundry pulls the update.

---

## 5. Spells, gear, pregens, tables, levels

- **Spells** (`gen-spells.mjs`): edit the `SPELLS` table; each DS3 spell maps to an SRD spell of
  the matching level; charge cost noted in the description.
- **Gear** (`gen-gear.mjs`): weapons/armor/shields. Shields carry `flags.ashen.block.{physical}`
  (the block fraction). Set armor type light/medium/heavy for DR.
- **Pregens** (`gen-pregens.mjs`): class, ability array, gear (copied from gear pack), 2 spells.
- **Tables** (`gen-tables.mjs`): loot tiers, souls per tier.
- **Levels** (`gen-levels.mjs`): attribute/skill cards players drag on.

---

## 6. Maps, scenes, tokens, art

- **Scenes:** add an entry in `gen-scenes.mjs` (name, dimensions). It runs **before** maps.
- **Maps:** `gen-maps.mjs` renders placeholder webp into `maps/<slug>.webp`. Drop your own art
  in `art/maps/<slug>.webp` to override (kept committed; overrides survive rebuild).
- **Tokens:** images in `tokens/`, referenced as `modules/ashen-of-lothric/tokens/<file>.png`.

---

## 7. Journals (hand-written, no generator)

Edit JSON directly in `src/journals/{rules,handbook,handouts}/*.json`, then `npm run build`.
Rules bible, DM handbook + codex, player primer, soapstone messages, etc.

---

## 8. Difficulty without code — `campaign-config.json`

A documented set of dials: `hp_multiplier`, `loot_multiplier`, `soul_base`, `turn_limit`,
`frostbite_threshold`, `kindle_bonus`, session minutes, encounter count — each with a `_comment`.
**Note:** this file is a reference sheet, **not yet auto-wired** into the generators, so today the
real numbers live in `bossHP`/`DPP` (bestiary) and the table tiers. To make it live, have your
generators read this JSON. It's the natural place to centralize balance.

---

## 9. Renaming for a brand-new campaign

To reskin away from Dark Souls: change `id`, `title`, `description` in `module.json` (the `id`
is the folder/token path prefix `ashen-of-lothric`), rewrite the generator tables, replace
`tokens/` + `art/maps/`, edit the journals. Rebuild. Bump `version` each release.

---

## 10. Release

```bash
npm run rebuild
gh release create v0.1.x dist/ashen-of-lothric.zip dist/ashen-of-lothric/module.json
```
Manifest installs from the GitHub `/releases/latest/download/module.json`. (`release.mjs` points
at the wrong repo — release manually as above.)

---

## 11. Quick reference

| Want to change | File | Then |
|---|---|---|
| Boss/enemy + windows | `tools/content/gen-bestiary.mjs` | `npm run rebuild` |
| Defense math | `scripts/ashen-defense.mjs` | bump version, rebuild |
| Spells | `tools/content/gen-spells.mjs` | rebuild |
| Gear/shields | `tools/content/gen-gear.mjs` | rebuild |
| Pregens | `tools/content/gen-pregens.mjs` | rebuild |
| Loot | `tools/content/gen-tables.mjs` | rebuild |
| Maps | `art/maps/*.webp` or `gen-maps.mjs` | rebuild |
| Journals | `src/journals/**/*.json` | `npm run build` |
| Difficulty | `tools/content/campaign-config.json` | rebuild |
| Packs/version | `module.json` | rebuild |
