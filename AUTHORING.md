# Authoring Guide — Editing & Rebuilding the Ashen Module

This is the **complete** guide to changing anything in this module: new bosses, attacks,
defense windows, spells, gear, pregens, loot, maps, scenes, journals, macros, and difficulty.
It is written so a person **or a standard AI (ChatGPT/Claude, no repo access)** can take this file
plus one exported JSON and build or edit a brand-new campaign with zero prior context — even with
no code tools at all (see §0.6).

> **Golden rule:** two ways to edit. (a) **No-code:** edit a `src/**/*.json` file, run
> `npm run build`. (b) **Permanent:** edit the `gen-*.mjs` table, run `npm run rebuild`. `packs/`,
> `dist/`, `maps/` are generated — never edit by hand. `rebuild` overwrites `src/`; `build` keeps it.

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

## 0.5 The ChatGPT / no-code workflow (read this first)

The fast path if you don't want to touch code:

1. **Drop this file** (`AUTHORING.md`) into ChatGPT and say what you want to change
   (e.g. "make Vordt hit harder", "add a new boss", "give the Cleric a new spell").
2. ChatGPT tells you **which file(s)** to paste in — usually one `src/**/*.json` (a single boss,
   item, spell, pregen, journal). Paste that file's contents.
3. ChatGPT hands back the rewritten JSON. **Replace** that file in `src/` (same path/name).
4. Build packs **without regenerating** so your hand edits aren't overwritten:
   ```bash
   npm run build      # ✅ packs src/ as-is — KEEPS your edits
   ```
   **Do NOT run `npm run rebuild`** — that re-runs the generators and clobbers hand edits.
5. Zip + release (or just `npm run build:world`) and install the new module.

⚠️ **build vs rebuild:** `build` = "use my JSON as-is." `rebuild` = "throw away src/ and regenerate
from the gen-*.mjs scripts." Hand-editing JSON? Use **build**. Editing a generator table? Use
**rebuild**. The two files that are *never* regenerated and always safe to hand-edit:
`scripts/ashen-defense.mjs` and everything in `src/journals/`.

For a permanent change that survives `rebuild`, make the edit in the matching `gen-*.mjs` instead
(see §2). For one-off tweaks via ChatGPT, editing `src/` JSON + `npm run build` is the simplest.

---

## 0.6 Zero tools — just ChatGPT/Claude + Foundry (no Node, no GitHub)

If you don't want to install anything, never touch the build at all — use Foundry's own
import/export and let a standard AI rewrite the JSON:

1. In Foundry, open the compendium (e.g. **Ashen: Bestiary**), right-click an actor →
   **Export Data** → saves a `.json`. (Items, spells, pregens, scenes all export the same way.)
2. Upload that `.json` (and this `AUTHORING.md`) to ChatGPT/Claude. Say what you want changed.
3. Paste the rewritten `.json` into a file. In Foundry, right-click the compendium →
   **Import Data** → pick the file. New/edited content appears immediately.

This needs **no repo, no npm, no rebuild** — the AI only edits a single exported JSON and Foundry
imports it. Use the `flags.ashen.def` and damage rules in §3 so the defense system still works.
The repo route (§0.5) is just for keeping a clean editable master; this route is enough to play.

---

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

**Where the JSON lives (give ChatGPT the file at this path):**

| Content | src/ folder | generator |
|---|---|---|
| pregens | `src/actors/pcs/` | gen-pregens.mjs |
| bosses/enemies | `src/actors/bestiary/` | gen-bestiary.mjs |
| weapons/armor/items | `src/items/gear/` | gen-gear.mjs |
| spells | `src/items/spells/` | gen-spells.mjs |
| level-up cards | `src/items/levels/` | gen-levels.mjs |
| loot tables | `src/tables/` | gen-tables.mjs |
| macros | `src/macros/` | gen-macros.mjs |
| scenes | `src/scenes/` | gen-scenes.mjs |
| rules/handbook/handouts | `src/journals/**/` | hand-written |

One JSON file = one boss/item/spell, so ChatGPT only needs the one file you want to change.

All generators live in `tools/content/`. Edit the table at the top, then `npm run rebuild`.

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
  - **Arts of War** (non-caster pregens): the `ARTS` map gives Knight/Warrior/Mercenary/Deprived
    one clickable signature feat (`artItem()`). Its attack re-uses the wielder's weapon dice plus the
    *same* live scaling formula the weapon uses — `floor(@abilities.<abil>.mod * <factor>)` (`includeBase:false`,
    so no double ability mod) — so the move scales with the character automatically. `uses.max:"3"` with
    `lr` recovery = 3 charges per bonfire; the attack activity consumes one use per click.
  - **Sneak Attack** (Thief + Assassin): the `SNEAK` map reuses `artItem()` with `atWill:true` — no
    charges, no use consumption, `flags.ashen.sneakAttack` — a clickable attack that bakes in the +2d6
    once-per-turn dice. Kept separate from Backstab (a Rogue class feature, not a positional move).
  - **Backstab** (EVERY pregen): `backstabFeat(weaponItem, id)` derives a clickable, **DM-gated**,
    auto-hit `damage`-type feat from the pregen's primary weapon — reads its dice / damage type /
    scaling bonus and multiplies: **×3 if `system.type.baseItem === "dagger"`, else ×1.5**, via a
    `custom.enabled` damage part `floor((<dice> + <scaling>) * <mult>)`. Picks the first equipped
    `type:"weapon"` (fallback: any carried weapon — covers casters' stowed dagger). No attack roll
    (auto-hit); the DM adjudicates positioning.
  - **Favorites / "action bar":** each pregen sets `system.favorites` (front-panel quick buttons) to
    its weapon (Strike), Art of War / Sneak Attack, Backstab, signature spells, and Estus. This is
    how the default dnd5e v5 sheet surfaces combat actions — **there is no "Actions" tab** on that
    sheet (tabs: Details/Inventory/Features/Spells/Effects/Biography); active feats live under
    Features → Active. Favorites need stable item `_id`s, so `mkId(seed)` makes deterministic 16-char
    ids (build.mjs only auto-generates an `_id` when absent) and favorites reference `.Item.<id>`.
- **Tables** (`gen-tables.mjs`): loot tiers, souls per tier.
- **Levels** (`gen-levels.mjs`): attribute/skill cards players drag on.

---

## 6. Maps, scenes, tokens, art

- **Scenes:** add an entry in `gen-scenes.mjs` (name, dimensions). It runs **before** maps.
- **Maps:** `gen-maps.mjs` renders placeholder webp into `maps/<slug>.webp`. Drop your own art
  in `art/maps/<slug>.webp` to override (kept committed; overrides survive rebuild).
- **Tokens:** images in `tokens/`, referenced as `modules/ashen-of-lothric/tokens/<file>.png`.
- **Rounded tokens:** every actor's `prototypeToken` enables Foundry's **dynamic token ring**
  (`ring: { enabled: true, effects: 1, subject: { scale: 1, … } }`) in `gen-bestiary.mjs` /
  `gen-pregens.mjs`, which masks the art into a circle. Set `enabled: false` for a square token.
- **Core icon paths must be exact:** when pointing an actor/token at a built-in Foundry icon
  (`icons/…`), the path must exist in core or the token shows blank. Color/variant names are easy to
  get wrong (e.g. `…-grey` vs `…-gray`, or the wrong folder). Verify by searching a known-good repo
  (e.g. `foundryvtt/pf2e`) for the exact filename before using it, or bundle your own art in `tokens/`.
- **Bonfire object:** the coiled-sword bonfire art lives at `tokens/bonfire.webp` (source PNG kept in
  `art/tokens/`). The **"Ashen: Place Bonfire"** macro drops that art + a warm flickering `torch`
  light anywhere (on a selected token, or the view centre); **"Ashen: Clear Bonfires (this scene)"**
  removes ones it placed. To swap the art, replace `tokens/bonfire.webp` (square, transparent PNG/webp)
  and `npm run build:world`.

### Scene lighting schema (important)

Foundry v13 stores each scene light's settings under **`config`** (a `LightData` object), and
`animation` is an **object** `{ type, speed, intensity, reverse }` — *not* a `light:{}` key with an
`animation:"torch"` string (that older shape is silently ignored and the light won't glow). The
`light()` helper in `gen-scenes.mjs` already emits the correct shape; keep new lights going through it.

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
