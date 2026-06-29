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

function guardBonus(actor) {
  let armor = 0, shield = 0;
  for (const it of actor?.items ?? []) {
    if (!it.system?.equipped) continue;
    const t = it.system?.type?.value;
    const ac = Number(it.system?.armor?.value) || 0;
    if (it.type === "equipment" && ["light", "medium", "heavy"].includes(t))
      armor = Math.max(armor, t === "heavy" ? 3 : t === "medium" ? 2 : 1);
    if (t === "shield" || ac === 2) shield = 1;
  }
  return Math.min(4, armor + shield);
}

function shieldBlock(actor, type) {
  const items = actor?.items ?? [];
  let best = 0;
  for (const it of items) {
    const eq = it.system?.equipped;
    const b = it.flags?.[NS]?.block;
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
    const shield = [...(actor?.items ?? [])].some((it) => it.system?.equipped && (it.system?.type?.value === "shield" || Number(it.system?.armor?.value) === 2));
    if (!shield) { msg = `<b>No shield!</b> Can't block — full damage.`; }
    else {
      const pct = Math.round((shieldBlock(actor, "physical") || 0) * 100);
      const dr = guardBonus(actor);
      msg = `Blocks — reaction spent. Damage reduced <b>${pct || 40}%</b>${dr ? ` then subtract <b>${dr}</b> armor` : ""}, no stagger.`;
    }
  } else {
    const adv = d === "parry" ? (w === atk.pw) : (w === atk.dw);
    const dis = d === "parry" ? (w !== atk.pw) : false;
    const tag = adv ? "ADV" : dis ? "DIS" : "flat";
    const formula = adv ? "2d20kh1" : dis ? "2d20kl1" : "1d20";
    const r = await new Roll(formula).roll();
    await r.toMessage({ speaker: { alias: `Ashen — ${name}` }, flavor: `${d.toUpperCase()} ${w} (${tag}) vs DC ${atk.dc}` });
    const ok = r.total >= atk.dc;
    const dr = guardBonus(actor);
    msg = `<b>${d.toUpperCase()} ${w}</b> (${tag}) — ${r.total} vs DC ${atk.dc}: ` +
      (ok ? (d === "parry" ? "<b>PARRY!</b> negated + stagger — party riposte!" : "<b>Dodge!</b> no damage, reposition 5 ft.")
          : `<b>hit</b> — full damage${dr ? `, then subtract <b>${dr}</b> armor` : ""}.`);
  }
  ChatMessage.create({ content: `<b>${name}:</b> ${msg}`, speaker: { alias: "Ashen \u2014 Defense" } });
}

async function onAttack(item) {
  if (!game.user.isGM) return;
  if (item?.actor?.type !== "npc") return;
  const stamp = `${item.id}:${Math.floor(Date.now() / 1500)}`;
  if (onAttack._last === stamp) return;
  onAttack._last = stamp;
  const targets = [...(game.user.targets ?? [])].filter((t) => t.actor && t.actor.type !== "npc");
  console.log(`[ashen-defense] attack by ${item.actor?.name} / ${item.name}; targets=${targets.length}`);
  if (!targets.length) { ui.notifications?.info("Ashen: target a player (hover + T) before attacking to prompt defense."); return; }
  let atk = item.flags?.[NS]?.def;
  if (atk) atk = { mv: item.name, dc: atk.dc ?? 12, dw: atk.dw ?? "W2", pw: atk.pw ?? "W3", nd: !!atk.nd, nb: !!atk.nb, np: !!atk.np };
  else atk = await askGrid(item.actor.name);
  if (!atk) return;
  for (const t of targets) await promptDefense(t.document ?? t, atk);
}

function itemFromMessage(msg) {
  const f = msg?.flags?.dnd5e ?? {};
  const actorId = msg?.speaker?.actor;
  const actor = actorId ? game.actors.get(actorId) : null;
  const itemId = f.use?.itemId || f.item?.id || f.roll?.itemId || f.activity?.itemId;
  return itemId && actor ? actor.items.get(itemId) : null;
}

// dnd5e v3 path: items fire dnd5e.useItem.
Hooks.on("dnd5e.useItem", (item) => onAttack(item));
// dnd5e v4/v5 path: items run "activities"; useItem is gone. Catch the activity instead.
Hooks.on("dnd5e.postUseActivity", (activity) => onAttack(activity?.item));
Hooks.on("dnd5e.useActivity", (activity) => onAttack(activity?.item));
// Version-proof fallback: every attack posts a chat card; read the item off it.
Hooks.on("createChatMessage", (msg) => { const it = itemFromMessage(msg); if (it) onAttack(it); });

Hooks.once("ready", () => console.log("[ashen-defense] loaded. Target a player (T) + use an NPC attack to fire."));

Hooks.on("renderChatMessageHTML", (msg, el) => {
  const root = el instanceof HTMLElement ? el : el?.[0];
  root?.querySelectorAll?.(".adf").forEach((btn) => btn.addEventListener("click", (ev) => {
    const card = ev.currentTarget.closest(".ashen-def");
    const atk = JSON.parse(card.dataset.grid);
    const actor = game.actors.get(card.dataset.actor);
    resolve(ev.currentTarget.dataset.d, ev.currentTarget.dataset.w, atk, card.dataset.name || "Defender", actor);
  }));
});
