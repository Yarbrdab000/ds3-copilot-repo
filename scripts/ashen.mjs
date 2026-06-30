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
    game.actors.find((x) => x.getFlag("ashen-of-lothric", "role") === "souls") ||
    game.actors.getName("Bonfire Ledger");
  if (ledger) {
    for (const k of ["banked", "carried", "bloodstain"]) {
      if (ledger.getFlag("ashen-of-lothric", k) == null) await ledger.setFlag("ashen-of-lothric", k, 0);
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

// ---------------------------------------------------------------------------
// Player-facing Level-Up picker (runs on EVERY client, including players).
//
// The GM's "Ashen: Level Up" macro spends souls once, raises each PC's class
// level, stamps a pending-upgrade marker, and posts a chat card with one
// "Choose upgrade" button per character. The click is handled here so the
// picker dialog opens on the CLICKING player's own screen and applies to the
// actor they own. The GM owns every actor, so the GM can click any button on
// behalf of an absent player. Players never touch the shared souls ledger.
// ---------------------------------------------------------------------------

const LU_ATTR = [
  "Attribute: Vigor +1", "Attribute: Strength +1", "Attribute: Dexterity +1",
  "Attribute: Endurance +1", "Attribute: Intelligence +1", "Attribute: Faith +1",
  "Attribute: Attunement +1", "Dexterity: AC Milestone (+1 AC)"
];
const LU_ARTS = [
  "Weapon Art: Stomp", "Weapon Art: Perseverance", "Weapon Art: Spin Slash",
  "Weapon Art: Charge", "Weapon Art: Quickstep", "Weapon Art: Leo Riposte",
  "Weapon Art: Steady Chant", "Weapon Art: Crystallize", "Weapon Art: Pyromancer's Fervor",
  "Weapon Art: Sage's Focus", "Weapon Art: Estus Mastery"
];
// Spell tier unlocked by the level being purchased: Tier 1 at L4-5, Tier 2 from
// 5->6 (levels 6-8), Tier 3 from 8->9 (levels 9-10).
const luMaxTier = (lvl) => ({ 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3 })[lvl] || 1;
// Weapon Arts are an EXTRA pick granted only at the skill levels (5->6 and 8->9).
const luArtsLevel = (lvl) => lvl === 6 || lvl === 9;

function luSelect(title, intro, options, dflt) {
  const optHtml = (o) => '<option value="' + o.value + '"' + (String(o.value) === String(dflt) ? " selected" : "") + ">" + o.label + "</option>";
  let opts;
  if (options.some((o) => o.group)) {
    const order = []; const byGroup = {};
    for (const o of options) { if (!byGroup[o.group]) { byGroup[o.group] = []; order.push(o.group); } byGroup[o.group].push(o); }
    opts = order.map((g) => '<optgroup label="' + g + '">' + byGroup[g].map(optHtml).join("") + "</optgroup>").join("");
  } else { opts = options.map(optHtml).join(""); }
  const content = intro + '<form><div class="form-group"><label>Choose</label><select name="pick" style="width:100%">' + opts + "</select></div></form>";
  return new Promise((resolve) => {
    const dlg = new Dialog({
      title, content,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: "Apply", callback: (html) => resolve(html[0].querySelector("[name=pick]")?.value ?? null) },
        skip: { icon: '<i class="fas fa-forward"></i>', label: "Skip", callback: () => resolve(null) }
      },
      default: "ok", close: () => resolve(null)
    }, { width: 480 });
    dlg.render(true);
    setTimeout(() => { try { dlg.bringToTop?.(); } catch (e) {} }, 80);
  });
}

async function luGrant(actor, name) {
  let item = game.items.getName(name);
  if (!item) {
    for (const p of game.packs) {
      if (p.documentName !== "Item") continue;
      const e = p.index.getName?.(name);
      if (e) { item = await p.getDocument(e._id); break; }
    }
  }
  if (!item) { ui.notifications.warn("Ashen: pick '" + name + "' not found; add it from the Level-Up cards manually."); return false; }
  await actor.createEmbeddedDocuments("Item", [item.toObject()]);
  return true;
}

// Tier-gated spell options, grouped by school. Reads flags.ashen.tier/group set by gen-spells.
async function luSpells(maxTier) {
  const out = []; const seen = new Set();
  const add = (doc) => {
    const t = Number(doc.flags?.ashen?.tier || 0);
    if (!t || t > maxTier || seen.has(doc.name)) return;
    seen.add(doc.name);
    const g = String(doc.flags?.ashen?.group || "spell");
    const grp = "Spell - " + g.charAt(0).toUpperCase() + g.slice(1) + " (Tier " + t + ")";
    out.push({ group: grp, label: doc.name, value: doc.name, _t: t, _g: g });
  };
  const pack = game.packs.find((p) => p.documentName === "Item" && p.metadata.packageName === MODULE_ID && /spell/i.test((p.metadata.name || "") + " " + (p.metadata.label || "")));
  if (pack) { for (const d of await pack.getDocuments()) if (d.type === "spell") add(d); }
  if (!out.length) { for (const it of game.items) if (it.type === "spell") add(it); }
  out.sort((x, y) => x._g.localeCompare(y._g) || x._t - y._t || x.label.localeCompare(y.label));
  return out.map(({ group, label, value }) => ({ group, label, value }));
}

async function luChoose(actor, lvl) {
  const tier = luMaxTier(lvl);
  const spellOpts = await luSpells(tier);
  const mainOpts = [...LU_ATTR.map((n) => ({ group: "Attribute (+1)", label: n, value: n })), ...spellOpts];
  const got = [];
  const pick = await luSelect(actor.name + ": choose an upgrade (now L" + lvl + ")",
    "<p>Pick <b>" + actor.name + "</b>'s upgrade - an <b>Attribute</b> or a <b>Spell</b> (up to <b>Tier " + tier + "</b>):</p>",
    mainOpts, LU_ATTR[0]);
  if (pick && await luGrant(actor, pick)) got.push(pick);
  if (luArtsLevel(lvl)) {
    const art = await luSelect(actor.name + ": choose a Weapon Art (skill level " + lvl + ")",
      "<p><b>" + actor.name + "</b> also learns a <b>Weapon Art</b> at this level - pick one (or Skip):</p>",
      LU_ARTS.map((n) => ({ group: "Weapon Art", label: n, value: n })), LU_ARTS[0]);
    if (art && await luGrant(actor, art)) got.push(art);
  }
  try { await actor.unsetFlag(MODULE_ID, "pendingUpgrade"); } catch (e) {}
  ChatMessage.create({ speaker: { alias: "Fire Keeper" }, content: "<b>" + actor.name + "</b> ascends to <b>Level " + lvl + "</b>" + (got.length ? " - " + got.join(" + ") : " (no pick)") + "." });
  return got;
}

// Bind the chat-card buttons. Supports v13 (renderChatMessageHTML, native element)
// and v12 (renderChatMessage, jQuery). The per-button dataset guard makes it
// idempotent if both hooks fire for the same element.
function luBind(message, html) {
  let root = null;
  if (html?.jquery) root = html[0];
  else if (html?.nodeType) root = html;
  else if (html?.[0]?.nodeType) root = html[0];
  if (!root?.querySelectorAll) return;
  for (const btn of root.querySelectorAll("button.ashen-levelup-btn")) {
    if (btn.dataset.ashenBound) continue;
    btn.dataset.ashenBound = "1";
    btn.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const actor = game.actors.get(btn.dataset.actorId);
      if (!actor) return ui.notifications.warn("Ashen: that character no longer exists.");
      if (!actor.isOwner) return ui.notifications.warn("Ashen: only " + actor.name + "'s player (or the GM) can choose that upgrade.");
      const pending = actor.getFlag(MODULE_ID, "pendingUpgrade");
      if (!pending) return ui.notifications.info("Ashen: " + actor.name + " has no pending level-up.");
      const lvl = Number(pending.lvl ?? btn.dataset.lvl);
      btn.disabled = true;
      try { await luChoose(actor, lvl); btn.textContent = "\u2713 " + actor.name + " - chosen"; }
      catch (e) { console.error("Ashen: level-up pick failed", e); ui.notifications.error("Ashen: pick failed - " + (e?.message || e)); btn.disabled = false; }
    });
  }
}

Hooks.on("renderChatMessageHTML", (message, html) => luBind(message, html));
Hooks.on("renderChatMessage", (message, html) => luBind(message, html));

Hooks.once("ready", () => {
  try { const m = game.modules.get(MODULE_ID); if (m) m.api = Object.assign(m.api || {}, { luChoose, luSpells }); } catch (e) {}
});
