# Ashen — A Dark Souls III One-Shot

A **4–6 hour Dark Souls III–themed D&D 5e one-shot** for **3–6 players**, packaged as a
[Foundry VTT](https://foundryvtt.com/) module (built to run on **[The Forge](https://forge-vtt.com/)**).

> *Awaken in the Cemetery of Ash. Fall to Iudex Gundyr. Rest at Firelink Shrine. Climb the
> High Wall of Lothric. Face Vordt of the Boreal Valley. Die. Learn. Overcome.*

This repo holds the **source** for the adventure (clean JSON/Markdown) plus tooling to **compile it
into a Foundry module** you can drag-and-drop. It's designed so a first-time DM can run a great
session without wrestling with mechanics or setup.

## What's inside

| Folder | Contents |
|---|---|
| `design/` | The full, locked design spec (rules, leveling, bosses, progression). |
| `src/actors/` | Pregen PCs (10 DS3 classes) + the bestiary (hollows + 5 bosses). |
| `src/items/` | Weapons, Estus, Embers, catalysts, the spell catalog, attribute/level effects. |
| `src/journals/` | Rules bible, DM handbook, codex, handouts, Tell-Ladder cards. |
| `src/scenes/` | The 8 scene/map definitions (7 encounter maps + a region overview). |
| `src/tables/` | Roll tables (soul rewards, loot, upgrade costs). |
| `src/macros/` | Souls/Cinders trackers, frostbite, level-up, boss-defeated & new-run/reset helpers. |
| `scripts/` | First-launch helper that offers one-click setup the first time the world opens. |
| `maps/`, `tokens/` | Placeholder battlemap & token art + sourcing guidance. |
| `tools/` | The Node build script (Foundry CLI pack/unpack). |
| `packs/` | Compiled compendium packs (build output). |

## The pitch (the design in one screen)

- **Soulslike layer over stock 5e.** Bonfires (the only rest), Estus flasks, a **shared party
  soul pool** (currency + XP), and a **death-loop**: wipe → respawn at the bonfire, drop your
  souls as a bloodstain, learn the boss's tell, try again.
- **A windowed defense system.** Every enemy attack unfolds across **3 windows** (wind-up →
  commit → impact). You choose **Dodge / Block / Parry** *and when* — and each move has a hidden
  "right answer" you learn by dying. **It's read-driven, not stat-driven: "get gud."**
- **DS3 leveling.** Start level 3, climb toward 10. Each level: **raise an attribute** (every
  point does something) **or learn a spell** (tiered sorceries / miracles / pyromancies), plus a
  Weapon-Art/Skill pick at 6 and 9.
- **The path:** Cemetery of Ash → **Iudex Gundyr** → Firelink Shrine (hub) → High Wall of Lothric
  (+ a killable **secret dragon** and two mini-bosses) → **Vordt of the Boreal Valley.**

## Build & import

See **[IMPORT.md](IMPORT.md)** for the dead-simple "drag it into The Forge and play" guide, and
**[AUTHORING.md](AUTHORING.md)** to edit/rebuild every piece (bosses, attacks, spells, gear,
pregens, maps) or fork it into a brand-new campaign. `tools/` compiles the source into a module.

```bash
npm install        # installs the Foundry CLI
npm run build      # compiles src/ JSON into packs/ compendia
```

### Printable table aids (no Foundry needed)

Want a paper backup at the table? Render the DM combat aids to standalone,
print-ready HTML — open in any browser and press Ctrl/Cmd&nbsp;+&nbsp;P:

```bash
npm run print              # builds all three into print-out/
node tools/print.mjs list  # see the targets
```

| Target | File | What it is |
| --- | --- | --- |
| `cheat-card` | `combat-cheat-card.html` | The one-page combat loop + block legend + reaction economy |
| `boss-grids` | `boss-quick-grids.html` | Every boss moveset grid on one sheet |
| `battle-kit` | `battle-kit.html` | The cheat card followed by all the boss grids |

The HTML is pulled from the same source JSON the module ships, so a printout can
never drift from what's in Foundry. Output lands in `print-out/` (gitignored).

## Legal / copyright

This is a **personal, non-commercial fan work**. All D&D mechanics use **SRD 5.1** open content only.
All Dark Souls III references are original homebrew **inspired by** the game — no FromSoftware
copyrighted text, art, or assets are reproduced or shipped. Bring your own (owned/licensed) art and
music; the repo ships only original or placeholder media plus links to free/CC sources.
