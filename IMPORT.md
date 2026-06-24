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
4. Open the **Macros** compendium (right sidebar → **Compendium Packs → Ashen** folder → *Macros &
   Trackers*), drag **"Ashen: Assemble Adventure"** to your hotbar, and click it. Confirm the prompt.
   It imports every Ashen compendium into the world in labelled folders.
5. You're in. Read **"How to run it"** below.

---

## Option B — Manual import (full control)

Use this to drop content into an **existing** world a piece at a time.

1. Run `npm run build` to produce the compendium `packs/` (or install the zip from Option A).
2. Install + enable the module as above.
3. Open the compendiums (right sidebar → **Compendium Packs** → the *Ashen* folder) and **import**
   what you need: drag the Pregens, Bestiary, Scenes, Journals, Tables, and Macros into your world.
   (Importing the **Bestiary** actors pack also brings in the **Bonfire Ledger** actor the souls
   macros depend on.)

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
  Bestiary pack) as *banked* / *carried* / *bloodstain* totals. You never edit it by hand — use the
  macros: **Award Souls**, **Bank Souls (at Bonfire)**, **Spend Banked Souls**, **Drop Bloodstain
  (on Wipe)**, and **Reclaim Bloodstain**.
- **Leveling:** the **Level Up** macro spends banked souls and tells each player which Level-Up Menu
  Card to apply. **Bonfire Rest** restores HP/Estus/charges and reminds you to respawn enemies.
- **Frostbite & embers:** **Add Frostbite Stack** advances the build-up bar (auto-applies Exhaustion
  when it fills); **Kindle (Ember)** grants the temporary max-HP bump. Boss phases are HP-threshold
  triggers spelled out in each **Bestiary** statblock and the **DM Handbook** Tell Ladders.

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
