#!/usr/bin/env node
/**
 * Ashen release helper — publishes the compiled module to a SEPARATE, public
 * "distribution" repo as a GitHub Release, so Foundry / The Forge can install it
 * from a manifest URL. Your private dev repo never changes visibility.
 *
 * The Forge fetches the manifest + zip with an anonymous server-side request, so
 * the release repo must be PUBLIC for the duration of the install. The flow below
 * keeps that public window to a couple of minutes.
 *
 * ── Friday runbook ──────────────────────────────────────────────────────────
 *   node tools/release.mjs publish     # build + create/refresh the PUBLIC release, prints the manifest URL
 *   (paste the manifest URL into Foundry → Add-on Modules → Install Module)
 *   node tools/release.mjs down         # flip the release repo back to PRIVATE (module keeps working)
 *
 * ── Iteration loop (tuning a system between test runs) ───────────────────────
 *   1. (dev)     edit source/generators, then:  npm run release republish
 *                  (bumps the version, regenerates + repacks + zips, publishes the update)
 *   2. (Foundry) Settings → Manage Modules → Update (or reload); the compendiums refresh
 *   3. (Foundry) run "Ashen: Teardown / Reset World" (Full wipe after a module update)
 *   4. (Foundry) reload → accept the welcome prompt (or run Assemble) → re-test
 *   then:        node tools/release.mjs down               # re-private the artifact
 *
 *   npm run rebuild                                   # regenerate + repack + zip only (no publish)
 *   node tools/release.mjs bump [patch|minor|major]   # just bump module.json version
 *   node tools/release.mjs up           # re-publish access later (e.g. reinstall on a new world)
 *   node tools/release.mjs nuke         # delete the release repo entirely
 *   node tools/release.mjs status       # show repo visibility + latest release
 *
 * Requires the `gh` CLI, authenticated as the repo owner. `nuke` needs the
 * delete_repo scope (gh auth refresh -h github.com -s delete_repo).
 */

import { readFile, writeFile, copyFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");

// The dedicated PUBLIC distribution repo (separate from the private dev repo).
const REPO = "Yarbrdab000/ashen-of-lothric";
const DESC = "Public install artifact for the Ashen — Dark Souls III D&D 5e one-shot Foundry module.";

function sh(args, { capture = false } = {}) {
  const r = spawnSync(args[0], args.slice(1), {
    cwd: ROOT,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    shell: false
  });
  return { status: r.status ?? 1, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function gh(args, opts) { return sh(["gh", ...args], opts); }

function requireGh() {
  const r = gh(["--version"], { capture: true });
  if (r.status !== 0) { console.error("! GitHub CLI (gh) not found or not on PATH."); process.exit(1); }
}

function repoExists() { return gh(["repo", "view", REPO, "--json", "name"], { capture: true }).status === 0; }

function visibility() {
  const r = gh(["repo", "view", REPO, "--json", "visibility"], { capture: true });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.out).visibility; } catch { return null; }
}

async function moduleVersion() {
  const mod = JSON.parse(await readFile(path.join(ROOT, "module.json"), "utf8"));
  return mod.version;
}

async function buildZip() {
  console.log("> building installable module (node tools/build.mjs world) ...");
  const r = sh(["node", "tools/build.mjs", "world"]);
  if (r.status !== 0) { console.error("! build failed"); process.exit(1); }
  const zip = path.join(ROOT, "dist", "ashen-of-lothric.zip");
  await access(zip);
  // The manifest asset must be the module.json (same url/manifest/download fields).
  await copyFile(path.join(ROOT, "module.json"), path.join(ROOT, "dist", "module.json"));
  return zip;
}

async function publish() {
  requireGh();
  const version = await moduleVersion();
  const tag = `v${version}`;
  const zip = await buildZip();
  const manifestAsset = path.join(ROOT, "dist", "module.json");

  if (!repoExists()) {
    console.log(`> creating PUBLIC repo ${REPO} ...`);
    const r = gh(["repo", "create", REPO, "--public", "-d", DESC]);
    if (r.status !== 0) { console.error("! could not create repo"); process.exit(1); }
  } else if (visibility() !== "PUBLIC") {
    console.log(`> repo exists; making it PUBLIC ...`);
    gh(["repo", "edit", REPO, "--visibility", "public", "--accept-visibility-change-consequences"]);
  }

  const exists = gh(["release", "view", tag, "-R", REPO], { capture: true }).status === 0;
  if (exists) {
    console.log(`> release ${tag} exists; clobbering assets ...`);
    gh(["release", "upload", tag, zip, manifestAsset, "-R", REPO, "--clobber"]);
  } else {
    console.log(`> creating release ${tag} ...`);
    const r = gh(["release", "create", tag, zip, manifestAsset, "-R", REPO,
      "--title", `Ashen ${tag}`, "--notes", "Installable Foundry VTT module. Paste the manifest URL below into Install Module."]);
    if (r.status !== 0) { console.error("! release create failed"); process.exit(1); }
  }

  const manifest = `https://github.com/${REPO}/releases/latest/download/module.json`;
  console.log("\n=============================================================");
  console.log(" PASTE THIS into Foundry → Add-on Modules → Install Module:");
  console.log("   " + manifest);
  console.log(" Then: Create World → import the Ashen adventure → invite players.");
  console.log(" When installed, run:  node tools/release.mjs down");
  console.log("=============================================================\n");
}

function setVisibility(vis) {
  requireGh();
  if (!repoExists()) { console.log(`(repo ${REPO} does not exist yet — nothing to do)`); return; }
  const r = gh(["repo", "edit", REPO, "--visibility", vis, "--accept-visibility-change-consequences"]);
  console.log(r.status === 0 ? `> ${REPO} is now ${vis.toUpperCase()}.` : `! failed to set visibility (${r.err})`);
}

function nuke() {
  requireGh();
  if (!repoExists()) { console.log(`(repo ${REPO} does not exist — nothing to delete)`); return; }
  const r = gh(["repo", "delete", REPO, "--yes"]);
  console.log(r.status === 0 ? `> deleted ${REPO}.` : `! delete failed — you may need: gh auth refresh -h github.com -s delete_repo`);
}

function status() {
  requireGh();
  if (!repoExists()) { console.log(`${REPO}: does not exist (nothing public).`); return; }
  console.log(`${REPO}: visibility = ${visibility()}`);
  const r = gh(["release", "list", "-R", REPO], { capture: true });
  console.log(r.out || "(no releases)");
}

async function bump(kind = "patch") {
  const file = path.join(ROOT, "module.json");
  const mod = JSON.parse(await readFile(file, "utf8"));
  const [maj, min, pat] = String(mod.version).split(".").map((n) => parseInt(n, 10) || 0);
  let next;
  if (kind === "major") next = `${maj + 1}.0.0`;
  else if (kind === "minor") next = `${maj}.${min + 1}.0`;
  else next = `${maj}.${min}.${pat + 1}`;
  mod.version = next;
  await writeFile(file, JSON.stringify(mod, null, 2) + "\n");
  console.log(`> module.json version ${maj}.${min}.${pat} -> ${next}`);
  return next;
}

async function republish() {
  // Bump (default patch) then regenerate everything from source and publish, so
  // Foundry's "Check for Updates" sees a new version and re-downloads the module on
  // the test instance. The fast iteration path: one command from edit to deployed.
  await bump(process.argv[3] || "patch");
  console.log("> regenerating content (node tools/build.mjs rebuild) ...");
  const r = sh(["node", "tools/build.mjs", "rebuild"]);
  if (r.status !== 0) { console.error("! rebuild failed"); process.exit(1); }
  await publish();
}

const cmd = process.argv[2] || "publish";
const table = {
  publish,
  republish,
  bump: () => bump(process.argv[3]),
  down: () => setVisibility("private"),
  up: () => setVisibility("public"),
  nuke,
  status
};
const fn = table[cmd];
if (!fn) { console.error(`Unknown command: ${cmd}\nUse: ${Object.keys(table).join(", ")}`); process.exit(1); }
await fn();
