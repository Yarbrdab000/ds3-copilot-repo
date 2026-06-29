#!/usr/bin/env node
/**
 * Generator for the Ashen battlemaps. Renders one original, grid-aligned tactical
 * map per scene into maps/<slug>.webp, sized to the scene's exact dimensions so
 * Foundry's 100px (5 ft) grid overlays perfectly. NO grid is baked into the art
 * (Foundry draws it); NO FromSoftware art is used — everything here is generated
 * from primitives + value noise, so it is copyright-safe and self-contained.
 *
 * Re-run:  node tools/content/gen-maps.mjs
 * Reads the scene list + dimensions from src/scenes/*.json; layouts below are keyed
 * by file slug and follow each scene's flags.ashen.brief.
 *
 * Requires the dev dependency @napi-rs/canvas.
 */

import { createCanvas } from "@napi-rs/canvas";
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "../..");
const SCENES_DIR = path.join(ROOT, "src/scenes");
const OUT = path.join(ROOT, "maps");
const ART = path.join(ROOT, "art/maps");
const MAX_BYTES = 2 * 1000 * 1000; // keep each map under 2 MB

// ---------------------------------------------------------------------------
// Math / noise / colour helpers
// ---------------------------------------------------------------------------
function makeNoise(seed) {
  function hash(x, y) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 362437;
    h = (h ^ (h >> 13)) * 1274126177;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const xf = x - x0, yf = y - y0;
    const tl = hash(x0, y0), tr = hash(x0 + 1, y0), bl = hash(x0, y0 + 1), br = hash(x0 + 1, y0 + 1);
    const u = smooth(xf), v = smooth(yf);
    return (tl + (tr - tl) * u) + ((bl + (br - bl) * u) - (tl + (tr - tl) * u)) * v;
  }
  function fbm(x, y, oct = 4) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * noise(x * freq, y * freq); norm += amp; amp *= 0.5; freq *= 2; }
    return sum / norm;
  }
  return { noise, fbm };
}

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function hex2rgb(h) {
  h = h.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lerp3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function dist(x, y, cx, cy) { return Math.hypot(x - cx, y - cy); }

// ---------------------------------------------------------------------------
// Terrain rasteriser: paints floor vs void from a 0..1 "floorness" mask + fbm.
// ---------------------------------------------------------------------------
function paintTerrain(ctx, W, H, { seed, scale = 0.0016, palette, mask, grain = 0.10, warp = 200 }) {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const { fbm, noise } = makeNoise(seed);
  const fD = hex2rgb(palette.floor[0]), fL = hex2rgb(palette.floor[1]);
  const vD = hex2rgb(palette.void[0]), vL = hex2rgb(palette.void[1]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wn = (fbm(x * 0.0011, y * 0.0011, 2) - 0.5) * warp;
      let m = clamp(mask(x + wn, y + wn, W, H));
      const t = fbm(x * scale, y * scale, 4);
      const g = (noise(x * 0.05, y * 0.05) - 0.5) * grain;
      const fc = lerp3(fD, fL, clamp(t * 0.85 + 0.1 + g));
      const vc = lerp3(vD, vL, clamp(t * 0.5 + g));
      const c = lerp3(vc, fc, m);
      const i = (y * W + x) * 4;
      d[i] = c[0] | 0; d[i + 1] = c[1] | 0; d[i + 2] = c[2] | 0; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Vector feature helpers
// ---------------------------------------------------------------------------
function pillar(ctx, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.40)";
  ctx.beginPath(); ctx.ellipse(cx + r * 0.28, cy + r * 0.34, r * 1.05, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  g.addColorStop(0, "rgba(150,146,138,0.95)");
  g.addColorStop(0.7, "rgba(86,82,76,0.95)");
  g.addColorStop(1, "rgba(40,38,35,0.95)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(20,18,16,0.6)"; ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function grave(ctx, cx, cy, w, h, rot, rng) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, "rgba(120,116,108,0.92)");
  g.addColorStop(1, "rgba(64,60,55,0.92)");
  ctx.fillStyle = g;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "rgba(25,22,20,0.7)"; ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = "rgba(20,18,16,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-w * 0.2, -h / 2); ctx.lineTo(w * 0.1, h * 0.1); ctx.lineTo(-w * 0.05, h / 2); ctx.stroke();
  ctx.restore();
}

function rubble(ctx, cx, cy, r, rng) {
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const a = rng() * Math.PI * 2, rr = r * (0.3 + rng() * 0.7);
    const px = cx + Math.cos(a) * rr * 0.6, py = cy + Math.sin(a) * rr * 0.6;
    const s = r * (0.16 + rng() * 0.22);
    ctx.fillStyle = `rgba(${70 + rng() * 40 | 0},${66 + rng() * 36 | 0},${60 + rng() * 32 | 0},0.9)`;
    ctx.beginPath();
    ctx.moveTo(px - s, py);
    ctx.lineTo(px, py - s * 0.8);
    ctx.lineTo(px + s, py);
    ctx.lineTo(px + s * 0.3, py + s * 0.7);
    ctx.lineTo(px - s * 0.5, py + s * 0.6);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function archBlock(ctx, cx, cy, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(cx - w / 2 + 8, cy - h / 2 + 10, w, h);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, "rgba(112,108,100,0.95)");
  g.addColorStop(1, "rgba(58,55,50,0.95)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  // arch opening
  ctx.fillStyle = "rgba(12,10,9,0.85)";
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.22, cy + h / 2);
  ctx.lineTo(cx - w * 0.22, cy - h * 0.05);
  ctx.arc(cx, cy - h * 0.05, w * 0.22, Math.PI, 0);
  ctx.lineTo(cx + w * 0.22, cy + h / 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "rgba(20,18,16,0.7)"; ctx.lineWidth = 3;
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}

function bonfire(ctx, cx, cy, lit = true) {
  ctx.save();
  // ash ring
  ctx.fillStyle = "rgba(18,16,14,0.85)";
  ctx.beginPath(); ctx.ellipse(cx, cy, 64, 50, 0, 0, Math.PI * 2); ctx.fill();
  if (lit) {
    const g = ctx.createRadialGradient(cx, cy - 10, 6, cx, cy, 150);
    g.addColorStop(0, "rgba(255,196,96,0.95)");
    g.addColorStop(0.35, "rgba(226,120,40,0.6)");
    g.addColorStop(1, "rgba(226,120,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.fill();
  }
  // coiled sword: blade + guard
  ctx.strokeStyle = lit ? "rgba(40,34,28,0.95)" : "rgba(90,86,80,0.9)";
  ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx, cy + 40); ctx.lineTo(cx, cy - 70); ctx.stroke();
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(cx - 26, cy - 36); ctx.lineTo(cx + 26, cy - 36); ctx.stroke();
  if (lit) {
    ctx.fillStyle = "rgba(255,228,150,0.95)";
    ctx.beginPath(); ctx.arc(cx, cy - 6, 9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function fogGate(ctx, x, yTop, yBot, w = 80, rng = Math.random) {
  ctx.save();
  const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, "rgba(196,214,230,0)");
  g.addColorStop(0.5, "rgba(206,222,236,0.5)");
  g.addColorStop(1, "rgba(196,214,230,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - w, yTop, w * 2, yBot - yTop);
  for (let i = 0; i < 26; i++) {
    const yy = yTop + rng() * (yBot - yTop);
    const xx = x + (rng() - 0.5) * w * 1.4;
    const rr = 18 + rng() * 42;
    ctx.fillStyle = `rgba(220,232,244,${0.05 + rng() * 0.10})`;
    ctx.beginPath(); ctx.ellipse(xx, yy, rr, rr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function cliffEdge(ctx, pts, fillBelow) {
  // pts: array of [x,y] along the cliff line; fillBelow draws void shading to that side.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = "rgba(180,176,166,0.5)"; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = "rgba(8,7,6,0.8)"; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1] + 10);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1] + 10);
  ctx.stroke();
  ctx.restore();
}

function fireLane(ctx, x0, x1, y, halfH) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y - halfH, 0, y + halfH);
  g.addColorStop(0, "rgba(232,120,40,0)");
  g.addColorStop(0.5, "rgba(244,150,60,0.16)");
  g.addColorStop(1, "rgba(232,120,40,0)");
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(x0, x1), y - halfH, Math.abs(x1 - x0), halfH * 2);
  ctx.restore();
}

function icePatch(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, "rgba(180,212,232,0.32)");
  g.addColorStop(1, "rgba(120,160,196,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.78, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function ladder(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(60,46,32,0.95)"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y + h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  ctx.lineWidth = 5;
  for (let i = 0; i <= 6; i++) {
    const yy = y + (h * i) / 6;
    ctx.beginPath(); ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy); ctx.stroke();
  }
  ctx.restore();
}

function vignette(ctx, W, H, strength = 0.55) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.30, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function label(ctx, W, H, text) {
  ctx.save();
  ctx.font = "600 38px 'DejaVu Serif', serif";
  const tw = ctx.measureText(text).width;
  const pad = 22, bw = tw + pad * 2, bh = 64;
  const bx = 28, by = H - bh - 28;
  ctx.fillStyle = "rgba(10,9,8,0.62)";
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
  ctx.strokeStyle = "rgba(180,150,90,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.stroke();
  ctx.fillStyle = "rgba(226,214,188,0.92)";
  ctx.textBaseline = "middle";
  ctx.fillText(text, bx + pad, by + bh / 2 + 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Per-scene layouts (keyed by file slug). Each gets the scene's W/H + a seed.
// ---------------------------------------------------------------------------
const PAL = {
  ash: { floor: ["#27231d", "#4a443b"], void: ["#0c0a08", "#191510"] },
  stone: { floor: ["#23262b", "#444a52"], void: ["#0a0c10", "#15181d"] },
  court: { floor: ["#24261f", "#474b3f"], void: ["#10110f", "#1c1d18"] },
  bridge: { floor: ["#2a241b", "#4f4636"], void: ["#14110c", "#211b13"] },
  duel: { floor: ["#22262c", "#414854"], void: ["#0b0e12", "#161a20"] },
  rampart: { floor: ["#24202a", "#46404f"], void: ["#0d0b0e", "#1a161d"] },
  ice: { floor: ["#1f2a34", "#3f5666"], void: ["#0a0f16", "#142029"] }
};

function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967295; }; }

const LAYOUTS = {
  cemetery(ctx, W, H) {
    const cx = W * 0.5, cy = H * 0.66, r = Math.min(W, H) * 0.34;
    paintTerrain(ctx, W, H, {
      seed: 11, palette: PAL.ash, scale: 0.0017, grain: 0.12,
      mask: (x, y) => {
        const arena = 1 - smoothstep(r - 180, r, dist(x, y, cx, cy));
        const slope = (1 - smoothstep(W * 0.16, W * 0.26, Math.abs(x - cx) * (1 + (cy - y) / H))) * (1 - smoothstep(cy, cy - 40, y) * 0 ) * smoothstep(-50, 250, y);
        return Math.max(arena, slope * 0.96);
      }
    });
    const rng = rngFrom(7);
    // ruined pillars (cover) on the approach
    for (const [px, py, pr] of [[cx - 360, cy - 470, 46], [cx + 320, cy - 520, 52], [cx - 180, cy - 690, 40], [cx + 150, cy - 700, 44], [cx - 520, cy - 250, 50], [cx + 520, cy - 230, 48]]) pillar(ctx, px, py, pr);
    // scattered graves on the slope
    for (let i = 0; i < 14; i++) {
      const gx = cx + (rng() - 0.5) * W * 0.62;
      const gy = cy - 360 - rng() * (cy - 120);
      grave(ctx, gx, gy, 46 + rng() * 30, 70 + rng() * 36, (rng() - 0.5) * 0.5, rng);
    }
    rubble(ctx, cx - r * 0.7, cy + r * 0.4, 60, rng);
    rubble(ctx, cx + r * 0.74, cy - r * 0.1, 54, rng);
    bonfire(ctx, cx, cy + r * 0.82, false); // coiled sword, unlit until after the fight
    vignette(ctx, W, H, 0.6);
    label(ctx, W, H, "Cemetery of Ash");
  },

  firelink(ctx, W, H) {
    const cx = W * 0.5, cy = H * 0.52, r = Math.min(W, H) * 0.42;
    paintTerrain(ctx, W, H, {
      seed: 23, palette: PAL.stone, scale: 0.0015, grain: 0.09,
      mask: (x, y) => {
        let m = 1 - smoothstep(r - 150, r, dist(x, y, cx, cy));
        // alcoves: small bumps around the ring
        for (const [ax, ay] of [[cx - r, cy], [cx + r, cy], [cx, cy - r], [cx - r * 0.7, cy + r * 0.75], [cx + r * 0.7, cy + r * 0.75]])
          m = Math.max(m, 1 - smoothstep(150, 230, dist(x, y, ax, ay)));
        return m;
      }
    });
    // hub features: central bonfire (lit), station markers (alcove discs)
    bonfire(ctx, cx, cy, true);
    const stations = [
      [cx, cy - r * 0.92, "throne"], [cx - r * 0.92, cy, "alcove"], [cx + r * 0.92, cy, "forge"],
      [cx - r * 0.66, cy + r * 0.72, "steps"], [cx + r * 0.66, cy + r * 0.72, "rest"]
    ];
    for (const [sx, sy] of stations) {
      ctx.save();
      ctx.fillStyle = "rgba(28,30,34,0.8)";
      ctx.beginPath(); ctx.arc(sx, sy, 78, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(150,150,160,0.35)"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(sx, sy, 78, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // forge glow (Andre)
    const fg = ctx.createRadialGradient(cx + r * 0.92, cy, 8, cx + r * 0.92, cy, 120);
    fg.addColorStop(0, "rgba(240,140,50,0.5)"); fg.addColorStop(1, "rgba(240,140,50,0)");
    ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(cx + r * 0.92, cy, 120, 0, Math.PI * 2); ctx.fill();
    vignette(ctx, W, H, 0.5);
    label(ctx, W, H, "Firelink Shrine");
  },

  "high-wall"(ctx, W, H) {
    paintTerrain(ctx, W, H, {
      seed: 31, palette: PAL.court, scale: 0.0015, grain: 0.10,
      mask: (x, y) => {
        // gated entry hall (upper third) opening to a wide courtyard
        const hall = (1 - smoothstep(W * 0.20, W * 0.23, Math.abs(x - W * 0.5))) * smoothstep(-50, 120, y) * (1 - smoothstep(H * 0.30, H * 0.36, y));
        const court = (1 - smoothstep(W * 0.40, W * 0.44, Math.abs(x - W * 0.5))) * smoothstep(H * 0.30, H * 0.40, y) * (1 - smoothstep(H * 0.92, H * 0.99, y));
        return Math.max(hall, court);
      }
    });
    const rng = rngFrom(13);
    // rampart border (raised walls) along courtyard top corners + archer perches
    for (const [px, py] of [[W * 0.16, H * 0.46], [W * 0.84, H * 0.46], [W * 0.16, H * 0.78], [W * 0.84, H * 0.78]]) {
      ctx.save();
      ctx.fillStyle = "rgba(40,42,36,0.9)";
      ctx.fillRect(px - 70, py - 70, 140, 140);
      ctx.strokeStyle = "rgba(20,20,16,0.7)"; ctx.lineWidth = 4; ctx.strokeRect(px - 70, py - 70, 140, 140);
      ctx.restore();
    }
    // gate between hall and courtyard
    ctx.save();
    ctx.strokeStyle = "rgba(70,64,52,0.9)"; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(W * 0.34, H * 0.33); ctx.lineTo(W * 0.66, H * 0.33); ctx.stroke();
    ctx.restore();
    // cover in the courtyard
    pillar(ctx, W * 0.36, H * 0.58, 50); pillar(ctx, W * 0.64, H * 0.62, 54);
    rubble(ctx, W * 0.5, H * 0.74, 70, rng); rubble(ctx, W * 0.28, H * 0.66, 54, rng);
    for (let i = 0; i < 8; i++) grave(ctx, W * (0.3 + rng() * 0.4), H * (0.5 + rng() * 0.4), 40 + rng() * 24, 60 + rng() * 30, (rng() - 0.5) * 0.6, rng);
    vignette(ctx, W, H, 0.55);
    label(ctx, W, H, "High Wall of Lothric");
  },

  "dragon-bridge"(ctx, W, H) {
    const cy = H * 0.5;
    paintTerrain(ctx, W, H, {
      seed: 41, palette: PAL.bridge, scale: 0.0016, grain: 0.10, warp: 120,
      mask: (x, y) => {
        const half = H * 0.30 + Math.sin(x * 0.004) * 30;
        return 1 - smoothstep(half - 40, half + 40, Math.abs(y - cy));
      }
    });
    // open fire lane down the span
    fireLane(ctx, W * 0.12, W * 0.88, cy, H * 0.16);
    // archways / rubble cover + a perch dead-zone at the far end
    archBlock(ctx, W * 0.26, cy - H * 0.16, 150, 220);
    archBlock(ctx, W * 0.5, cy + H * 0.17, 150, 220);
    archBlock(ctx, W * 0.7, cy - H * 0.17, 150, 220);
    const rng = rngFrom(5);
    rubble(ctx, W * 0.40, cy + H * 0.04, 80, rng);
    rubble(ctx, W * 0.6, cy - H * 0.02, 70, rng);
    // dragon perch (dead zone) far right
    ctx.save();
    ctx.fillStyle = "rgba(60,40,30,0.5)";
    ctx.beginPath(); ctx.ellipse(W * 0.9, cy, 150, H * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    const pg = ctx.createRadialGradient(W * 0.9, cy, 10, W * 0.9, cy, 220);
    pg.addColorStop(0, "rgba(240,120,40,0.35)"); pg.addColorStop(1, "rgba(240,120,40,0)");
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(W * 0.9, cy, 220, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // cliff edges along the span
    cliffEdge(ctx, [[W * 0.08, cy - H * 0.30], [W * 0.5, cy - H * 0.31], [W * 0.92, cy - H * 0.30]]);
    cliffEdge(ctx, [[W * 0.08, cy + H * 0.30], [W * 0.5, cy + H * 0.31], [W * 0.92, cy + H * 0.30]]);
    vignette(ctx, W, H, 0.6);
    label(ctx, W, H, "Dragon Bridge");
  },

  outrider(ctx, W, H) {
    const cx = W * 0.5, cy = H * 0.5;
    paintTerrain(ctx, W, H, {
      seed: 53, palette: PAL.duel, scale: 0.0016, grain: 0.09,
      mask: (x, y) => {
        // enclosed square chamber with rounded corners
        const mx = 1 - smoothstep(W * 0.40, W * 0.44, Math.abs(x - cx));
        const my = 1 - smoothstep(H * 0.40, H * 0.44, Math.abs(y - cy));
        return Math.min(mx, my);
      }
    });
    // one or two pillars to break charge lanes
    pillar(ctx, cx - W * 0.16, cy - H * 0.12, 58);
    pillar(ctx, cx + W * 0.17, cy + H * 0.14, 62);
    // chamber wall inset shadow
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 40;
    ctx.beginPath(); ctx.roundRect(W * 0.085, H * 0.085, W * 0.83, H * 0.83, 60); ctx.stroke();
    ctx.restore();
    vignette(ctx, W, H, 0.62);
    label(ctx, W, H, "Outrider Knight's Hall");
  },

  "pus-wall"(ctx, W, H) {
    const cy = H * 0.44;
    paintTerrain(ctx, W, H, {
      seed: 61, palette: PAL.rampart, scale: 0.0016, grain: 0.10,
      mask: (x, y) => {
        // a rampart walk: floor band across, void (drop) along the lower edge
        const top = smoothstep(H * 0.16, H * 0.22, y);
        const bot = 1 - smoothstep(H * 0.62, H * 0.70, y);
        return Math.min(top, bot);
      }
    });
    const rng = rngFrom(9);
    // battlements (merlons) along the top wall
    ctx.save();
    ctx.fillStyle = "rgba(44,40,48,0.92)";
    for (let x = W * 0.06; x < W * 0.94; x += 130) ctx.fillRect(x, H * 0.12, 80, 70);
    ctx.restore();
    // the 'corpse' that erupts (marker) mid-walk
    ctx.save();
    ctx.fillStyle = "rgba(70,30,40,0.6)";
    ctx.beginPath(); ctx.ellipse(W * 0.52, cy, 70, 44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    rubble(ctx, W * 0.34, cy + 30, 60, rng); rubble(ctx, W * 0.7, cy - 20, 54, rng);
    // ledge / drop along the bottom
    cliffEdge(ctx, [[W * 0.04, H * 0.66], [W * 0.5, H * 0.67], [W * 0.96, H * 0.66]]);
    // kicked-down ladder = shortcut, far right
    ladder(ctx, W * 0.9, H * 0.30, 70, H * 0.30);
    vignette(ctx, W, H, 0.6);
    label(ctx, W, H, "Pus-of-Man Rampart");
  },

  vordt(ctx, W, H) {
    const cx = W * 0.5;
    paintTerrain(ctx, W, H, {
      seed: 71, palette: PAL.ice, scale: 0.0015, grain: 0.08,
      mask: (x, y) => {
        // long frozen hall, narrow approach at top through the fog gate
        const hall = (1 - smoothstep(W * 0.36, W * 0.40, Math.abs(x - cx))) * smoothstep(H * 0.20, H * 0.28, y) * (1 - smoothstep(H * 0.93, H * 0.99, y));
        const approach = (1 - smoothstep(W * 0.12, W * 0.15, Math.abs(x - cx))) * smoothstep(-40, 80, y) * (1 - smoothstep(H * 0.18, H * 0.24, y));
        return Math.max(hall, approach);
      }
    });
    // pre-bonfire at the approach, fog gate, then the hall
    bonfire(ctx, cx, H * 0.10, true);
    fogGate(ctx, cx, H * 0.205, H * 0.255, 0, rngFrom(2)); // thin wisp band
    ctx.save();
    const fg = ctx.createLinearGradient(0, H * 0.205, 0, H * 0.255);
    fg.addColorStop(0, "rgba(210,226,240,0)"); fg.addColorStop(0.5, "rgba(210,226,240,0.55)"); fg.addColorStop(1, "rgba(210,226,240,0)");
    ctx.fillStyle = fg; ctx.fillRect(cx - W * 0.15, H * 0.205, W * 0.30, H * 0.05);
    ctx.restore();
    // frost charge lane down the hall centre
    ctx.save();
    const lane = ctx.createLinearGradient(cx - 160, 0, cx + 160, 0);
    lane.addColorStop(0, "rgba(150,196,224,0)"); lane.addColorStop(0.5, "rgba(150,196,224,0.12)"); lane.addColorStop(1, "rgba(150,196,224,0)");
    ctx.fillStyle = lane; ctx.fillRect(cx - 160, H * 0.30, 320, H * 0.58);
    ctx.restore();
    // ice patches
    icePatch(ctx, cx - W * 0.2, H * 0.5, 160); icePatch(ctx, cx + W * 0.22, H * 0.62, 190); icePatch(ctx, cx - W * 0.05, H * 0.74, 150);
    // victory bonfire past the far gate
    bonfire(ctx, cx, H * 0.93, true);
    vignette(ctx, W, H, 0.58);
    label(ctx, W, H, "Vordt of the Boreal Valley");
  },

  map(ctx, W, H) {
    // Gridless region overview: nodes + route. Painterly fog over dark slate.
    paintTerrain(ctx, W, H, {
      seed: 91, palette: { floor: ["#15171c", "#23262d"], void: ["#08090b", "#101218"] }, scale: 0.0012, grain: 0.07,
      mask: (x, y) => 0.4 + 0.6 * smoothstep(0, 1, (makeNoise(91).fbm(x * 0.0008, y * 0.0008, 3)))
    });
    const nodes = {
      Cemetery: [W * 0.12, H * 0.80],
      Firelink: [W * 0.27, H * 0.60],
      "High Wall": [W * 0.45, H * 0.46],
      "Dragon Bridge": [W * 0.50, H * 0.18],
      Outrider: [W * 0.68, H * 0.36],
      "Pus Wall": [W * 0.78, H * 0.62],
      Vordt: [W * 0.90, H * 0.84]
    };
    const route = ["Cemetery", "Firelink", "High Wall", "Outrider", "Pus Wall", "Vordt"];
    // main path
    ctx.save();
    ctx.strokeStyle = "rgba(196,170,110,0.55)"; ctx.lineWidth = 8; ctx.setLineDash([2, 0]); ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < route.length; i++) {
      const [x, y] = nodes[route[i]];
      if (i === 0) ctx.moveTo(x, y);
      else {
        const [px, py] = nodes[route[i - 1]];
        const mx = (px + x) / 2 + (py - y) * 0.18, my = (py + y) / 2 + (x - px) * 0.18;
        ctx.quadraticCurveTo(mx, my, x, y);
      }
    }
    ctx.stroke();
    // fork to Dragon Bridge
    ctx.setLineDash([14, 14]); ctx.strokeStyle = "rgba(220,130,60,0.6)";
    ctx.beginPath(); ctx.moveTo(...nodes["High Wall"]); ctx.lineTo(...nodes["Dragon Bridge"]); ctx.stroke();
    // shortcut Pus Wall -> Firelink
    ctx.strokeStyle = "rgba(150,170,200,0.5)";
    ctx.beginPath(); ctx.moveTo(...nodes["Pus Wall"]);
    ctx.quadraticCurveTo(W * 0.5, H * 0.86, ...nodes.Firelink); ctx.stroke();
    ctx.restore();
    // dragon marker near the bridge
    ctx.save();
    const dg = ctx.createRadialGradient(W * 0.5, H * 0.13, 6, W * 0.5, H * 0.13, 90);
    dg.addColorStop(0, "rgba(244,140,60,0.6)"); dg.addColorStop(1, "rgba(244,140,60,0)");
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(W * 0.5, H * 0.13, 90, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // nodes + labels
    ctx.save();
    ctx.font = "600 34px 'DejaVu Serif', serif"; ctx.textBaseline = "middle";
    for (const [name, [x, y]] of Object.entries(nodes)) {
      const climax = name === "Vordt", hub = name === "Firelink";
      ctx.fillStyle = climax ? "rgba(150,196,224,0.95)" : hub ? "rgba(244,180,90,0.95)" : "rgba(206,200,186,0.92)";
      ctx.beginPath(); ctx.arc(x, y, climax ? 30 : 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(10,9,8,0.8)"; ctx.lineWidth = 4; ctx.stroke();
      const tw = ctx.measureText(name).width;
      const lx = x + 34, ly = y;
      ctx.fillStyle = "rgba(10,9,8,0.6)";
      ctx.beginPath(); ctx.roundRect(lx - 8, ly - 24, tw + 16, 46, 8); ctx.fill();
      ctx.fillStyle = "rgba(228,218,196,0.96)";
      ctx.fillText(name, lx, ly + 2);
    }
    ctx.restore();
    vignette(ctx, W, H, 0.5);
    label(ctx, W, H, "Cemetery \u2192 Vordt");
  }
};

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
function slugFromFile(f) { return f.replace(/\.json$/, ""); }

async function encodeUnder(canvas, maxBytes) {
  for (const q of [82, 74, 66, 58, 50]) {
    const buf = await canvas.encode("webp", q);
    if (buf.length <= maxBytes || q === 50) return { buf, q };
  }
}

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const files = readdirSync(SCENES_DIR).filter((f) => f.endsWith(".json"));
  let made = 0;
  for (const f of files) {
    const slug = slugFromFile(f);
    const override = path.join(ART, slug + ".webp");
    if (existsSync(override)) {
      copyFileSync(override, path.join(OUT, slug + ".webp"));
      made++;
      console.log(`  ${slug.padEnd(14)} custom art (art/maps/${slug}.webp)`);
      continue;
    }
    const layout = LAYOUTS[slug];
    if (!layout) { console.warn("! no layout for", slug, "(skipping)"); continue; }
    const s = JSON.parse(readFileSync(path.join(SCENES_DIR, f), "utf8"));
    const W = s.width, H = s.height;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = s.backgroundColor || "#0b0d10";
    ctx.fillRect(0, 0, W, H);
    layout(ctx, W, H);
    const { buf, q } = await encodeUnder(canvas, MAX_BYTES);
    const out = path.join(OUT, slug + ".webp");
    writeFileSync(out, buf);
    made++;
    console.log(`  ${slug.padEnd(14)} ${W}x${H}  q${q}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
  console.log(`Generated ${made} battlemap(s) -> maps/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
