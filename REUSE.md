# Campaign Reusability Guide

> **Ashen of Lothric** is designed to be a **drop-in template** for multi-week D&D 5e campaigns. Most systems are already reusable; this guide shows what stays, what to reskin, and what to extend over time.

---

## What's Already Reusable (Zero Rework)

- **Macro system** (Ashen: Award Souls, Level Up, Bonfire Rest, etc.)
  - All generic dnd5e — just swap HP/loot values in the creatures.
  - No hardcoded DS3 mechanics; works for any campaign.

- **Action economy** (Turn Limit macro)
  - Teaches players decisive play without TPK. Theme-agnostic.

- **Automation** (Active Effects for Exhaustion, Embered status)
  - Exhaustion = generic dnd5e status (use for poison, curses, hunger, anything stackable).
  - Embered = template for any "bonus resource" (mana, inspiration, temp HP pool).

- **Teardown/iteration protocol** (Ashen: Teardown / Reset World macro + rebuild command)
  - Works on ANY Foundry module. Just swap compendiumSource matching rules if needed.

- **Build pipeline** (`npm run rebuild`, `npm run release republish`)
  - Generic Foundry packing. No DS3 logic.

---

## What Needs Lightweight Reskin (Edit JSON + Generator)

### 1. Scenes (tools/content/gen-scenes.mjs)
**Reuse pattern:** Copy the generator, edit scene names + briefs, keep wall/light structure.

```javascript
// Current: 8 scenes (Cemetery → Vordt)
// To adapt: Swap "Cemetery of Ash" for "Cavern of Whispers", keep sqW/sqH, edit brief + wall coordinates

scene({
  name: "1 · Cavern of Whispers — Goblin Lair", // <- swap
  navName: "Cavern", // <- swap
  order: 1,
  sqW: 30, sqH: 24, // <- keep grid size
  bg: "#0c0a08", // <- consider new theme color from campaign-config.json
  brief: "Goblin warren with 3-way fork. Echoes matter here.",
  walls: [ /* keep structure, swap coordinates */ ],
  lights: [ /* keep structure, swap colors from config */ ]
})
```

**Cost:** ~15 min per new campaign (copy generator, bulk-find-replace names, tweak coordinates).

### 2. Creatures (tools/content/gen-bestiary.mjs)
**Reuse pattern:** Skeleton in `tools/content/_templates/creature-skeleton.json`. Edit: name, CR, abilities, loot.

```javascript
// Current: Iudex Gundyr (CR 8, 150 HP, teaches parry)
// To adapt: Rename to "Goblin Warlord" (CR 2, 30 HP, new ability pattern)

// All macro calls (Award Souls, Boss Defeated, Phase 2 trigger) remain identical.
// The creature is just data; macros are neutral.
```

**Cost:** ~10 min per creature (edit JSON template, regenerate).

### 3. Gear (tools/content/gen-gear.mjs)
**Reuse pattern:** Edit item names + prices in the generator. Damage/scaling logic stays.

```javascript
// Current: Longsword (600 GP, 1d8 slashing, STR 1.0 scaling)
// To adapt: Goblin Cleaver (50 GP, 1d6 slashing, STR 1.2 scaling — crude but brutal)

// Pricing curve, shop tiers, all automation stays the same.
```

**Cost:** ~10 min per gear list (bulk-find-replace, regenerate).

### 4. Scaling Config (tools/content/campaign-config.json)
**Reuse pattern:** Edit `campaign_config.json` knobs to tune difficulty + pacing.

```json
{
  "scaling": {
    "hp_multiplier": 1.0,   // <- 1.2 for deadly, 0.8 for forgiving
    "loot_multiplier": 1.0, // <- 1.3 for generous, 0.7 for lean
    "soul_base": 100        // <- swap currency + base rewards
  },
  "theme_colors": {
    "primary": "#0c0a08",      // <- "#e6d5c3" for light temple
    "accent_fire": "#ff6600",  // <- "#ff3333" for lava
    "accent_frost": "#bbddff"  // <- "#33ff99" for poison
  }
}
```

**Cost:** ~5 min (tweak 5–10 knobs).

---

## Multi-Week Expansion (Low-Credit Path)

### Week 1 (This Friday): One-Shot Ready
- Ashen module fully playable.
- Feedback post-session.

### Week 2–4: Polish & Extend (As Needed)
If the one-shot is a hit:
1. **Data extraction** (tools/content/\_templates/ → all generators)
   - Create `campaign.js` config loader so generators read from `campaign-config.json` instead of hardcoded.
   - ~3 hours refactoring, ~5 min per new campaign after.

2. **Multi-theme support** (--theme flag)
   - `npm run build --theme=ashen` vs. `npm run build --theme=waterdeep`
   - Each theme reads its own `src/campaigns/{theme}/` folder.
   - ~2 hours setup, then theme-specific folders are copy-paste.

3. **Dynamic scene builder** (UI or wizard)
   - CLI tool to generate new scene from prompt: "crowded tavern, 6×8 grid, 2 pillars, tavern lights"
   - Uses wall/light presets to scaffold fast.
   - ~4 hours, but then onboarding is 5 min per scene.

### Cost Tracking
- **Week 1 (Now):** ~30 min (templates + config, already done).
- **Week 2–4 per expansion:** 2–4 hours per task, spread out. Use Haiku to reduce costs.

---

## How Next DM Onboards (Lightweight)

**Scenario:** Friend wants to run a **"Heist in Waterdeep"** campaign using your template.

1. **Copy the repo** and branch: `git checkout -b campaigns/waterdeep`

2. **Reskin data** (30 min):
   - Edit `tools/content/gen-scenes.mjs`: 8 scenes → 8 heist locations (rename + update briefs)
   - Edit `tools/content/gen-bestiary.mjs`: swap creature names + stats
   - Edit `tools/content/campaign-config.json`: theme colors, soul_base → gold, hp_multiplier for harder dungeon

3. **Rebuild & test** (5 min):
   ```bash
   npm run rebuild
   npm run test  # (if added)
   ```

4. **Deploy** (2 min):
   ```bash
   npm run release republish patch
   ```

**Total onboarding time:** ~40 min. Most of that is creative (picking new scene names, creature abilities), not technical.

---

## Future High-Value Adds (Deferred)

These are **nice-to-have** but not needed for one-shot or initial campaign:

- **Campaign wizard CLI** (pick theme, grid size, creature count → scaffold all generators)
- **Scene coordinate validator** (warns if walls cross scene boundaries)
- **Macro translator** (auto-convert Frostbite macro to "Poison" variant, etc.)
- **Balance checker** (auto-calc if party is over/underleveled based on XP/loot)

---

## Reference: File Locations

| What | Where | Edit For |
|------|-------|----------|
| Scenes | `tools/content/gen-scenes.mjs` | Names, briefs, walls/lights, grid size |
| Creatures | `tools/content/gen-bestiary.mjs` | Stats, abilities, loot, CR |
| Gear | `tools/content/gen-gear.mjs` | Item names, prices, damage, scaling |
| Scaling | `tools/content/campaign-config.json` | HP mult, loot mult, turn limit, colors |
| Macros | `tools/content/gen-macros.mjs` | (Rarely touch; already generic) |
| Build | `tools/build.mjs` | (Rarely touch; already generic) |

---

## Testing a Reskin

After editing generators + config, validate with:

```bash
# Full rebuild + pack (3–5 sec)
npm run rebuild

# Check scene count
ls -la src/scenes/

# Check creature count
ls -la src/bestiary/

# Spot-check one scene JSON
cat src/scenes/cemetery.json | grep name  # should show new name if edited
```

---

**Questions?** Check `IMPORT.md` for deployment, `INSTALL.md` for Foundry setup, or see `checkpoints/` for iteration history.
