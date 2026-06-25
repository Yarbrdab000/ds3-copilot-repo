# Importing & running *Ashen* on The Forge (or local Foundry)

This guide is written for a **first-time DM**. You have two ways in — pick one.

---

## Option A — The easy way: install the module, then auto-assemble (recommended)

The build produces an **installable module zip** with all content as compendiums, plus an
**"Assemble Adventure"** macro that pours everything into a fresh world for you.

1. Run `npm run build:world` to produce **`dist/ashen-of-lothric.zip`**.
2. On **[The Forge](https://forge-vtt.com/)**: go to your **Bazaar / Content** → **Import** and
   upload `ashen-of-lothric.zip` as a **module** (local Foundry: **Add-on Modules → Install Module
   → Manifest URL or upload the zip**). It installs the **dnd5e** system if you don't have it.
3. Create a **new dnd5e world**, launch it, and enable **"Ashen — A Dark Souls III One-Shot"** in
   **Settings → Manage Modules**.
4. **The first time you enter the world, Ashen greets you and offers to set everything up — click
   _Yes_.** It imports every compendium into labelled folders, initialises the souls tracker, and
   pins your tracker macros to the hotbar. (Prefer to do it by hand, or need to re-run it later? Drag
   **"Ashen: Assemble Adventure"** from the *Macros & Trackers* compendium to your hotbar and click it
   — **safe to re-run**; it fills only what's missing instead of duplicating content.)
5. You're in. Read **"How to run it"** below.

---

## Option B — Manual import (full control)

Use this to drop content into an **existing** world a piece at a time.

1. Run `npm run build` to produce the compendium `packs/` (or install the zip from Option A).
2. Install + enable the module as above.
3. Open the compendiums (right sidebar → **Compendium Packs** → the *Ashen* folder) and **import**
   what you need: drag the Pregens, Bestiary, Scenes, Journals, Tables, and Macros into your world.
   (Importing the **Pregen Characters** actors pack also brings in the **Bonfire Ledger** actor the
   souls macros depend on — import it even if players bring their own sheets.)

---

## How to run it (start here once it's imported)

Open these in order — they're written to be read in ~20 minutes total:

1. **Rules Bible** (journal) — the Soulslike layer + the windowed defense system. Read this first.
2. **DM Handbook** (journal) — the act-by-act run-of-show with read-aloud boxes, pacing, secrets,
   and the boss **Tell Ladders**. This is your script.
3. **Player Primer** (handout) — one page; hand to players. Explains how this differs from normal 5e.
4. **Pregens** — let each player pick a class actor; drag it to their player.

### The trackers (set up once)
- **Souls pool:** the shared party souls live on the **Bonfire Ledger** actor (imported with the
  **Pregen Characters** pack) as *banked* / *carried* / *bloodstain* totals. You never edit it by
  hand — use the macros: **Award Souls**, **Bank Souls (at Bonfire)**, **Spend Banked Souls**, **Drop
  Bloodstain (on Wipe)**, and **Reclaim Bloodstain**. (The Assemble Adventure macro initialises these
  totals to 0 for you.)
- **Leveling:** the **Level Up** macro spends banked souls and tells each player which Level-Up Menu
  Card to apply. **Bonfire Rest** restores HP/Estus/charges and reminds you to respawn enemies.
- **Lives & shops:** **New Run / Reset Bonfire** sets the party's **Cinders** (4 × players), resets the
  Shop Tier, and clears souls — run it at the start of a game or between the two sessions of a two-shot.
  **Spend a Cinder** burns one shared life when a hero falls; **Boss Defeated** awards souls and grows
  the Firelink shop one tier.
- **Frostbite & embers:** **Add Frostbite Stack** advances the build-up bar (auto-applies Exhaustion
  when it fills); **Kindle (Ember)** grants the temporary max-HP bump. Boss phases are HP-threshold
  triggers spelled out in each **Bestiary** statblock and the **DM Handbook** Tell Ladders.

### Iterating between test runs
Use this loop whenever you tweak rules, prices, encounter math, or module content and want a clean
re-test without hand-cleaning the world.

1. On your dev machine, run `npm run release republish`. That bumps `module.json`, regenerates all
   generated content, repacks the module, zips it, and republishes the latest install artifact.
2. In Foundry, update the module (or reload the world) so the refreshed compendiums are available.
3. Run **Ashen: Teardown / Reset World**.
   - **Reset content (keep macros)** is the fast loop when you're just clearing imported docs and want
     to rerun **Assemble Adventure** immediately.
   - **Full wipe (everything)** is the safe choice after a module update; it removes the imported Ashen
     folders and macros so the next reload behaves like a fresh install.
4. Reload the world. If you chose **Full wipe**, accept the welcome prompt. Otherwise run
   **Ashen: Assemble Adventure** and choose **Fill gaps**.
5. Re-test the scene, fight, or system you changed.

If you only want a fresh zip locally and are not publishing an update yet, run `npm run rebuild`.

### Bring your own art & audio
To respect copyright, the module ships **placeholder maps/tokens** and a **curated link list** of
free/CC art (in the **DM Handbook → *Maps & Scenes*** journal) and music (in the **DM Handbook →
*Audio Cues*** journal). Swap in your own DS3 art/music via the Forge Assets Library and each
scene's **Configure → Background** picker.

---

## Version notes
Targets **Foundry VTT v13 + dnd5e v5.x** (the current Forge stable). The manifest declares
compatibility for Foundry v12–v14 and dnd5e 4.4+, but the content is authored against the
dnd5e v5 schema. If your Forge instance runs an older version, install matching versions or
adjust `module.json` compatibility and re-run the build.
