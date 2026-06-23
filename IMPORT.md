# Importing & running *Ashen* on The Forge (or local Foundry)

This guide is written for a **first-time DM**. You have two ways in — pick one.

---

## Option A — The easy way: drag-and-drop the World (recommended for your first run)

The build produces a ready-to-play **world export** (everything pre-placed: scenes, NPCs on the
maps, journals in folders). On The Forge this is the fastest path.

1. Run `npm run build:world` to produce `dist/ashen-world.zip` (see `tools/`).
2. Log in to **[The Forge](https://forge-vtt.com/)** → open the **Import Wizard** (the "Import
   from Foundry" / drag-drop panel).
3. Drag `ashen-world.zip` onto the wizard. It uploads the world, installs the **dnd5e** system if
   needed, and drops all assets into your Assets Library automatically.
4. Launch the world. You're in. Everything below "How to run it" applies.

> No Forge account yet? You can do the exact same thing in a **local Foundry** install: unzip the
> world into `Data/worlds/ashen/` and it appears on your Worlds list.

---

## Option B — Install as a Module (portable, non-destructive)

Use this if you want to drop the content into an **existing** world.

1. Run `npm run build` to produce the compendium `packs/`.
2. Zip the module folder (everything with `module.json` at the root), or host the `module.json`
   URL, and install it via **Add-on Modules → Install Module** in Foundry / the Forge **Bazaar**.
3. Enable **"Ashen — A Dark Souls III One-Shot"** in your world's module settings.
4. Open the compendiums (right sidebar → **Compendium Packs** → the *Ashen* folder) and **import**
   what you need: drag the Pregens, Bestiary, Scenes, and Journals into your world.
5. Run the **"Assemble Adventure"** macro (in the *Ashen: Macros* pack) to auto-create the folder
   structure and place tokens/journals for you.

---

## How to run it (start here once it's imported)

Open these in order — they're written to be read in ~20 minutes total:

1. **Rules Bible** (journal) — the Soulslike layer + the windowed defense system. Read this first.
2. **DM Handbook** (journal) — the act-by-act run-of-show with read-aloud boxes, pacing, secrets,
   and the boss **Tell Ladders**. This is your script.
3. **Player Primer** (handout) — one page; hand to players. Explains how this differs from normal 5e.
4. **Pregens** — let each player pick a class actor; drag it to their player.

### The trackers (set up once)
- **Souls pool:** open the **Party** actor; its "Souls" is the shared pool. Use the
  **Award/Spend/Bloodstain** macros during play.
- **Frostbite & boss phases:** the **Frostbite** and **Boss Phase** macros handle the counters and
  apply effects automatically — you just click.

### Bring your own art & audio
To respect copyright, the module ships **placeholder maps/tokens** and a **curated link list** of
free/CC art & music (in the *Handouts → Asset Sources* journal). Swap in your own DS3 art/music via
the Forge Assets Library and the scene's **Configure → Background** picker.

---

## Version notes
Targets **Foundry VTT v13 + dnd5e v5.x** (the current Forge stable). The manifest declares
compatibility for Foundry v12–v14 and dnd5e 4.4+, but the content is authored against the
dnd5e v5 schema. If your Forge instance runs an older version, install matching versions or
adjust `module.json` compatibility and re-run the build.
