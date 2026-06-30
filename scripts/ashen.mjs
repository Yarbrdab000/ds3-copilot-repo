/**
 * Ashen — first-launch convenience.
 *
 * On a world that has the Ashen module enabled but not yet imported, greet the GM
 * and offer one-click setup: import every compendium into labelled folders,
 * initialise the Bonfire Ledger, and pin the tracker macros to the hotbar.
 *
 * Fully optional and non-destructive. If anything here fails, the adventure still
 * works via the "Ashen: Assemble Adventure" macro — this only saves the DM a click.
 * It never runs for players, and never nags once the world is assembled.
 */

const MODULE_ID = "ashen-of-lothric";
const FPREFIX = "Ashen \u2014 ";

/**
 * Re-skin two 5e ability scores to their Dark Souls identities, since DS3 has no
 * "Constitution" or "Charisma". CON governs HP/durability = Vigor; CHA is the
 * Pyromancer's casting stat = Inner Will (force of the inner flame). Cosmetic only:
 * it relabels the headers/tooltips, all underlying mechanics are unchanged.
 */
Hooks.once("setup", () => {
  try {
    const ab = CONFIG.DND5E?.abilities;
    if (!ab) return;
    if (ab.con) { ab.con.label = "Vigor"; ab.con.abbreviation = "Vig"; }
    if (ab.cha) { ab.cha.label = "Inner Will"; ab.cha.abbreviation = "IW"; }
  } catch (e) {
    console.warn("Ashen: ability relabel failed", e);
  }
});

/** Tracker macros to drop on the hotbar, in slot order, after import. */
const HOTBAR = [
  "Ashen: Award Souls",
  "Ashen: Bank Souls (at Bonfire)",
  "Ashen: Spend Banked Souls",
  "Ashen: Bonfire Rest",
  "Ashen: Boss Defeated",
  "Ashen: Spend a Cinder",
  "Ashen: Drop Bloodstain (on Wipe)",
  "Ashen: New Run / Reset Bonfire"
];

async function pinMacros() {
  try {
    let slot = 1;
    for (const name of HOTBAR) {
      if (slot > 10) break;
      const m = game.macros?.getName(name);
      if (m) await game.user.assignHotbarMacro(m, slot);
      slot++;
    }
  } catch (e) {
    console.warn("Ashen: could not auto-pin macros", e);
  }
}

async function assemble() {
  const packs = game.packs.filter((p) => p.metadata.packageName === MODULE_ID);
  if (!packs.length) {
    ui.notifications.error("Ashen: module compendiums not found.");
    return;
  }
  let imported = 0;
  let failed = 0;
  for (const pack of packs) {
    const folderName = String(pack.metadata.label || pack.metadata.name).replace(/^Ashen:\s*/, FPREFIX);
    const folder = game.folders.find((f) => f.type === pack.metadata.type && f.name === folderName);
    if (folder && (folder.contents?.length ?? 0) > 0) continue;
    try {
      const docs = await pack.importAll({ folderName });
      imported += Array.isArray(docs) ? docs.length : (pack.index?.size ?? 0);
      ui.notifications.info("Ashen: imported " + folderName + ".");
    } catch (e) {
      failed++;
      console.error("Ashen import error for " + pack.collection, e);
    }
  }

  const ledger =
    game.actors.find((x) => x.getFlag("ashen", "role") === "souls") ||
    game.actors.getName("Bonfire Ledger");
  if (ledger) {
    for (const k of ["banked", "carried", "bloodstain"]) {
      if (ledger.getFlag("ashen", k) == null) await ledger.setFlag("ashen", k, 0);
    }
  }

  await pinMacros();

  const msg =
    "<h3>Ashen is ready.</h3>" +
    "<p>Imported <b>" + imported + "</b> document(s)" +
    (failed ? ", <b>" + failed + "</b> failed (see console)" : "") +
    ". Look for the <b>Ashen \u2014</b> folders in each tab; your tracker macros are on the hotbar.</p>" +
    "<p><b>Start here:</b> open the <b>DM Handbook</b> \u2192 <i>DM Quick-Start</i>, hand each player a <b>Pregen</b>, " +
    "run <b>New Run / Reset Bonfire</b> to set the party's Cinders, then drag <b>1 \u00b7 Cemetery of Ash</b> onto the canvas.</p>";
  ChatMessage.create({ content: msg });
}

Hooks.once("ready", async () => {
  try {
    if (!game.user?.isGM) return;
    const packs = game.packs.filter((p) => p.metadata.packageName === MODULE_ID);
    if (!packs.length) return;
    const assembled = game.folders.some((f) => f.name && f.name.indexOf(FPREFIX) === 0);
    if (assembled) return;

    const proceed = await Dialog.confirm({
      title: "Welcome, Unkindled \u2014 set up Ashen?",
      content:
        "<p>This world has the <b>Ashen</b> Dark-Souls one-shot enabled, but the content hasn't been imported yet.</p>" +
        "<p>Import <b>all " + packs.length + " compendiums</b> into labelled folders, prepare the Bonfire Ledger, " +
        "and pin the tracker macros to your hotbar? It takes a few seconds and is safe to re-run.</p>" +
        "<p style=\"opacity:.8\">You can also do this any time from the <b>Ashen: Assemble Adventure</b> macro.</p>",
      yes: () => true,
      no: () => false,
      defaultYes: true
    });
    if (proceed) await assemble();
  } catch (e) {
    console.error("Ashen first-launch hook failed (content still works via the Assemble macro)", e);
  }
});
