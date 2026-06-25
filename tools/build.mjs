#!/usr/bin/env node
/**
 * Ashen build tool.
 *
 * Compiles the human-editable JSON source under src/ into Foundry VTT compendium
 * packs under packs/, using the official @foundryvtt/foundryvtt-cli.
 *
 * Commands:
 *   node tools/build.mjs pack       Compile src/ -> packs/ (LevelDB compendia)
 *   node tools/build.mjs unpack     Extract packs/ -> src/ (round-trip / editing)
 *   node tools/build.mjs validate   Parse every source JSON and report problems
 *   node tools/build.mjs clean      Remove compiled packs/
 *   node tools/build.mjs world      Pack, then zip the module into dist/
 *   node tools/build.mjs rebuild    Regenerate generated source, then world-build
 *
 * The pack <-> source-folder mapping is derived from module.json + SRC_MAP below.
 */

import { readFile, writeFile, readdir, rm, mkdir, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

/** Maps a module.json pack `type` to its Foundry LevelDB collection prefix. */
const TYPE_TO_COLLECTION = {
  Actor: "actors",
  Item: "items",
  JournalEntry: "journal",
  Scene: "scenes",
  RollTable: "tables",
  Macro: "macros",
  Cards: "cards",
  Playlist: "playlists"
};

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a Foundry-style 16-character document id. */
function genId() {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}

/** Embedded-document hierarchy, mirroring the Foundry CLI so keys can be injected. */
const HIERARCHY = {
  actors: { items: [], effects: [] },
  cards: { cards: [] },
  items: { effects: [] },
  journal: { pages: [], categories: [] },
  playlists: { sounds: [] },
  tables: { results: [] },
  scenes: {
    drawings: [], tokens: [], lights: [], notes: [], regions: [],
    sounds: [], templates: [], tiles: [], walls: []
  }
};

/**
 * Recursively assign _id and _key to a document and its embedded collections,
 * matching the key format the Foundry CLI produces on extract.
 */
function assignKeys(doc, collection, sublevelPrefix = "", idPrefix = "") {
  if (!doc._id) doc._id = genId();
  const sublevel = sublevelPrefix ? `${sublevelPrefix}.${collection}` : collection;
  const id = idPrefix ? `${idPrefix}.${doc._id}` : doc._id;
  doc._key = `!${sublevel}!${id}`;
  for (const embeddedName of Object.keys(HIERARCHY[collection] ?? {})) {
    const value = doc[embeddedName];
    if (Array.isArray(value)) {
      for (const child of value) assignKeys(child, embeddedName, sublevel, id);
    }
  }
}

/** Maps a compendium pack `name` (from module.json) to its source folder under src/. */
const SRC_MAP = {
  "actors-pcs": "src/actors/pcs",
  "actors-bestiary": "src/actors/bestiary",
  "items-gear": "src/items/gear",
  "items-spells": "src/items/spells",
  "items-levels": "src/items/levels",
  "journals-rules": "src/journals/rules",
  "journals-handbook": "src/journals/handbook",
  "journals-handouts": "src/journals/handouts",
  "scenes": "src/scenes",
  "tables": "src/tables",
  "macros": "src/macros"
};

function log(...args) {
  console.log("[ashen]", ...args);
}

async function loadModule() {
  const raw = await readFile(path.join(ROOT, "module.json"), "utf8");
  return JSON.parse(raw);
}

async function listJsonFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listJsonFiles(full)));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

async function importCli() {
  try {
    return await import("@foundryvtt/foundryvtt-cli");
  } catch {
    console.error(
      "\n  The Foundry CLI is not installed. Run `npm install` first.\n" +
        "  (Not needed for `validate`, which only parses JSON.)\n"
    );
    process.exit(1);
  }
}

async function cmdValidate() {
  let count = 0;
  let errors = 0;
  for (const [pack, src] of Object.entries(SRC_MAP)) {
    const dir = path.join(ROOT, src);
    const files = await listJsonFiles(dir);
    for (const file of files) {
      count++;
      try {
        const doc = JSON.parse(await readFile(file, "utf8"));
        if (!doc.name && !doc._id) {
          console.warn(`  ! ${path.relative(ROOT, file)} has no name/_id`);
        }
      } catch (err) {
        errors++;
        console.error(`  x ${path.relative(ROOT, file)}: ${err.message}`);
      }
    }
    log(`${pack}: ${files.length} source doc(s)`);
  }
  log(`validated ${count} document(s), ${errors} error(s)`);
  if (errors) process.exit(1);
}

async function cmdPack() {
  const { compilePack } = await importCli();
  const mod = await loadModule();
  const stageRoot = path.join(ROOT, "dist", ".stage");
  await rm(stageRoot, { recursive: true, force: true });
  for (const p of mod.packs) {
    const src = path.join(ROOT, SRC_MAP[p.name] ?? `src/${p.name}`);
    const dest = path.join(ROOT, p.path);
    const files = existsSync(src) ? await listJsonFiles(src) : [];
    if (files.length === 0) {
      log(`skip ${p.name} (no source yet)`);
      continue;
    }
    const collection = TYPE_TO_COLLECTION[p.type];
    if (!collection) {
      console.error(`  x ${p.name}: unknown pack type '${p.type}'`);
      process.exit(1);
    }
    // Stage each doc with an injected _id/_key so authored source stays clean.
    const stage = path.join(stageRoot, p.name);
    await mkdir(stage, { recursive: true });
    let i = 0;
    for (const file of files) {
      const doc = JSON.parse(await readFile(file, "utf8"));
      assignKeys(doc, collection);
      if (!doc._stats) {
        doc._stats = { coreVersion: "13.351", systemId: "dnd5e", systemVersion: "5.3.3" };
      }
      const base = String(i++).padStart(4, "0") + "-" + path.basename(file);
      await writeFile(path.join(stage, base), JSON.stringify(doc, null, 2));
    }
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    await compilePack(stage, dest, { recursive: true, log: true });
    log(`packed ${p.name} (${files.length} doc(s))`);
  }
  await rm(stageRoot, { recursive: true, force: true });
  log("done. packs/ is ready to ship in the module.");
}

async function cmdUnpack() {
  const { extractPack } = await importCli();
  const mod = await loadModule();
  for (const p of mod.packs) {
    const src = path.join(ROOT, p.path);
    const dest = path.join(ROOT, SRC_MAP[p.name] ?? `src/${p.name}`);
    if (!existsSync(src)) {
      log(`skip ${p.name} (no compiled pack)`);
      continue;
    }
    await mkdir(dest, { recursive: true });
    await extractPack(src, dest, { log: true });
    log(`unpacked ${p.name}`);
  }
}

async function cmdClean() {
  const mod = await loadModule();
  for (const p of mod.packs) {
    const dir = path.join(ROOT, p.path);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
      log(`removed ${p.path}`);
    }
  }
}

/** Zip a staged folder into `out` using whatever archiver the OS provides. */
function zipDir(stageParent, folderName, out) {
  if (process.platform === "win32") {
    const ps =
      `Compress-Archive -Path '${path.join(stageParent, folderName)}' ` +
      `-DestinationPath '${out}' -Force`;
    const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
    return r.status === 0;
  }
  let r = spawnSync("zip", ["-r", "-q", out, folderName], { cwd: stageParent, stdio: "inherit" });
  if (r.error || r.status !== 0) {
    // Fallback to tar (produces a .zip-named archive only if zip is unavailable).
    r = spawnSync("tar", ["-a", "-c", "-f", out, folderName], { cwd: stageParent, stdio: "inherit" });
  }
  return !r.error && r.status === 0;
}

async function cmdWorld() {
  await cmdPack();
  const mod = await loadModule();
  const dist = path.join(ROOT, "dist");
  const stage = path.join(dist, mod.id);
  await rm(dist, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });

  // Stage the installable module: manifest + compiled packs + docs + placeholder media.
  const include = ["module.json", "packs", "scripts", "README.md", "IMPORT.md", "LICENSE", "maps", "tokens"];
  for (const rel of include) {
    const from = path.join(ROOT, rel);
    if (existsSync(from)) await cp(from, path.join(stage, rel), { recursive: true });
  }

  const out = path.join(dist, `${mod.id}.zip`);
  const ok = zipDir(dist, mod.id, out);
  if (ok && existsSync(out)) {
    log(`built ${path.relative(ROOT, out)} — drag this into Foundry/The Forge "Install Module", or upload it to the Forge Bazaar.`);
  } else {
    log(
      `packs built and staged at ${path.relative(ROOT, stage)}, but no zip tool was found.\n` +
        "        Zip that folder manually (module.json must be at its root) to get an installable module."
    );
  }
}

async function cmdRebuild() {
  // Deterministic source -> installable zip. Runs every content generator, then
  // packs and zips. gen-scenes must precede gen-maps (maps read scene dimensions).
  // Hand-authored journals are not generated and are left untouched.
  const generators = [
    "gen-spells.mjs",
    "gen-gear.mjs",
    "gen-levels.mjs",
    "gen-pregens.mjs",
    "gen-bestiary.mjs",
    "gen-tables.mjs",
    "gen-macros.mjs",
    "gen-scenes.mjs",
    "gen-maps.mjs"
  ];
  for (const g of generators) {
    log(`generate ${g}`);
    const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "content", g)], { stdio: "inherit" });
    if (r.status !== 0) {
      console.error(`  x generator failed: ${g}`);
      process.exit(1);
    }
  }
  await cmdWorld();
  log("rebuild complete — dist/ holds a fresh installable module.");
}

const COMMANDS = {
  validate: cmdValidate,
  pack: cmdPack,
  unpack: cmdUnpack,
  clean: cmdClean,
  world: cmdWorld,
  rebuild: cmdRebuild
};

const cmd = process.argv[2] ?? "pack";
const handler = COMMANDS[cmd];
if (!handler) {
  console.error(`Unknown command: ${cmd}\nUse one of: ${Object.keys(COMMANDS).join(", ")}`);
  process.exit(1);
}
handler().catch((err) => {
  console.error(err);
  process.exit(1);
});
