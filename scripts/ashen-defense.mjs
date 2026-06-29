/**
 * Ashen — Windowed Defense automation.
 *
 * When the DM rolls an attack with a hostile NPC against player-targeted tokens,
 * each targeted player is handed a guided reaction card: pick Dodge / Block / Parry
 * and the timing window (W1 wind-up, W2 commit, W3 impact). The script rolls the
 * flat d20 (no stats — pure read) and resolves it. The boss's correct windows stay
 * GM-secret: the DM sets them once per swing from a quick picker (the answers live in
 * the DM Codex), and players only ever see the buttons.
 *
 * Non-destructive. If it ever fails, the paper rules in the Soulslike Rules journal
 * still work — this only saves the table the bookkeeping.
 */

const NS = "ashen";
const WINDOWS = { W1: "W1 \u00b7 wind-up", W2: "W2 \u00b7 commit", W3: "W3 \u00b7 impact" };

function ownerOf(token) {
  const a = token?.actor;
  if (!a) return null;
  return game.users.find((u) => !u.isGM && u.active && a.testUserPermission(u, "OWNER")) ||
         game.users.find((u) => !u.isGM && a.testUserPermission(u, "OWNER")) || null;
}

function shieldBlock(actor, type) {
  const items = actor?.items ?? [];
  let best = 0;
  for (const it of items) {
    const eq = it.system?.equipped;
    const b = it.getFlag?.(NS, "block");
    if (eq && b && typeof b[type] === "number") best = Math.max(best, b[type]);
  }
  return best;
}

/** DM picks the hidden grid for this swing. Returns null if cancelled. */
async function askGrid(attackerName) {
  return Dialog.wait({
    title: `Ashen \u2014 ${attackerName}: set the move`,
    content: `
      <p style="opacity:.8">Set this swing's hidden profile (from the DM Codex). Players won't see it.</p>
      <div class="form-group"><label>Move name</label><input name="mv" value="Attack"/></div>
      <div class="form-group"><label>Defense DC</label><input name="dc" type="number" value="12"/></div>
      <div class="form-group"><label>Dodge ADV window</label><select name="dw"><option>W1</option><option selected>W2</option><option>W3</option></select></div>
      <div class="form-group"><label>Parry ADV window</label><select name="pw"><option>W1</option><option>W2</option><option selected>W3</option></select></div>
      <div class="form-group"><label>Cannot be</label>
        <label><input type="checkbox" name="nd"/> Dodged</label>
        <label><input type="checkbox" name="nb"/> Blocked</label>
        <label><input type="checkbox" name="np"/> Parried</label></div>`,
    buttons: { ok: { label: "Hand to players", callback: (h) => ({
      mv: h[0].querySelector("[name=mv]").value || "Attack",
      dc: Number(h[0].querySelector("[name=dc]").value) || 12,
      dw: h[0].querySelector("[name=dw]").value, pw: h[0].querySelector("[name=pw]").value,
      nd: h[0].querySelector("[name=nd]").checked, nb: h[0].querySelector("[name=nb]").checked,
      np: h[0].querySelector("[name=np]").checked }) },
      skip: { label: "Skip" } },
    default: "ok"
  }, { width: 380 }).then((r) => r || null);
}

async function promptDefense(token, atk) {
  const grid = JSON.stringify(atk);
  const card = `
    <div class="ashen-def" data-grid='${grid}' data-actor="${token.actor?.id||""}" data-name="${token.name}">
      <h3>${atk.mv} \u2014 react!</h3>
      <p><b>${token.name}</b>, read the tell. Flat d20, no stats. Pick a defense and a window:</p>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${["dodge","block","parry"].map((d) => ["W1","W2","W3"].map((w) =>
          `<button class="adf" data-d="${d}" data-w="${w}">${d[0].toUpperCase()+d.slice(1)} ${w}</button>`).join("")).join("")}
      </div></div>`;
  const owner = ownerOf(token);
  await ChatMessage.create({
    content: card,
    speaker: { alias: "Ashen \u2014 Defense" },
    whisper: owner ? [owner.id, ...game.users.filter((u)=>u.isGM).map((u)=>u.id)] : null
  });
}

async function resolve(d, w, atk, name, actor) {
  let msg;
  if (d === "dodge" && atk.nd) msg = `<b>Undodgeable.</b> Block or sidestep.`;
  else if (d === "block" && atk.nb) msg = `<b>Unblockable.</b> Dodge it.`;
  else if (d === "parry" && atk.np) msg = `<b>Unparryable.</b>`;
  else if (d === "block") {
    const pct = Math.round((shieldBlock(actor, "physical") || 0) * 100);
    msg = `Blocks \u2014 reaction spent. Damage reduced <b>${pct || 40}%</b>, no stagger.`;
  } else {
    const adv = d === "parry" ? (w === atk.pw) : (w === atk.dw);
    const dis = d === "parry" ? (w !== atk.pw) : false;
    const r1 = await new Roll("1d20").roll(), r2 = await new Roll("1d20").roll();
    const roll = adv ? Math.max(r1.total, r2.total) : dis ? Math.min(r1.total, r2.total) : r1.total;
    const ok = roll >= atk.dc;
    const tag = adv ? "ADV" : dis ? "DIS" : "flat";
    msg = `<b>${d.toUpperCase()} ${w}</b> (${tag}) \u2014 d20=${roll} vs DC ${atk.dc}: ` +
      (ok ? (d === "parry" ? "<b>PARRY!</b> negated + stagger \u2014 party riposte!" : "<b>Dodge!</b> no damage, reposition 5 ft.")
          : "<b>miss</b> \u2014 full damage.");
  }
  ChatMessage.create({ content: `<b>${name}:</b> ${msg}`, speaker: { alias: "Ashen \u2014 Defense" } });
}

async function onAttack(item) {
  if (!game.user.isGM) return;
  if (item?.actor?.type !== "npc") return;
  const targets = [...(game.user.targets ?? [])].filter((t) => t.actor?.type === "character");
  if (!targets.length) return;
  const atk = await askGrid(item.actor.name);
  if (!atk) return;
  for (const t of targets) await promptDefense(t.document ?? t, atk);
}

Hooks.on("dnd5e.useItem", (item) => onAttack(item));

Hooks.on("renderChatMessage", (msg, html) => {
  html.find(".adf").on("click", (ev) => {
    const root = ev.currentTarget.closest(".ashen-def");
    const atk = JSON.parse(root.dataset.grid);
    const actor = game.actors.get(root.dataset.actor);
    resolve(ev.currentTarget.dataset.d, ev.currentTarget.dataset.w, atk, root.dataset.name || "Defender", actor);
  });
});
