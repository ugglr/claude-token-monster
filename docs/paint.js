// Generated from hooks/paint.ts, the mod's renderer. Do not edit; rebuild from the repo root with:
// npx esbuild hooks/paint.ts --format=esm --target=es2020 --outfile=docs/paint.js
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const MINUTE = 6e4;
const SAD = 15 * MINUTE;
const STARVING = 60 * MINUTE;
const BURP = MINUTE;
const AMBER = 50;
const RED = 80;
const BURST = 90;
const COMBO_MS = 4e3;
const COMBO_FRAMES = 40;
const DOZE = 1800;
const YAWN = 40;
const CHEER = 26;
const HOP = 12;
const PERK = 18;
const PALETTE = {
  blue: 4029439,
  cyan: 2279382,
  green: 4641120,
  yellow: 15909424,
  magenta: 13786352,
  red: 15749180,
  white: 14673648
};
const WHITE = 16777215;
const BLACK = 0;
const INK = 1707812;
const MOUTH = 2753552;
const TONGUE = 15229054;
const BLUSH = 16743080;
const GOLD = 16765503;
const GOLD_LIGHT = 16774048;
const GOLD_DARK = 9067008;
const TEAL = 3137736;
const BOLT = 13629183;
const TEXT = 16765286;
const THINKING = 11902207;
const PROMPT = 10147839;
const TOOL_COLORS = [
  [/^Bash/, 6094730],
  [/^(Read|Grep|Glob|LS)/, 6080767],
  [/^(Edit|Write|MultiEdit|NotebookEdit)/, 16755021],
  [/^Web/, 13073919],
  [/^Agent/, 16740312],
  [/^mcp__/, 16769126]
];
const toolColor = (tool) => tool === void 0 ? TEXT : TOOL_COLORS.find(([match]) => match.test(tool))?.[1] ?? TEXT;
const mix = (a, b, t) => {
  const k = Math.max(0, Math.min(1, t));
  const channel = (shift) => {
    const from = a >> shift & 255;
    return Math.round(from + ((b >> shift & 255) - from) * k) << shift;
  };
  return channel(16) | channel(8) | channel(0);
};
const hash = (a, b = 0) => {
  let h = a * 374761393 + b * 668265263 | 0;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 2 ** 32;
};
let seed = 7;
const random = () => (seed = seed * 1664525 + 1013904223 >>> 0) / 2 ** 32;
const ease = (from, to, k) => from + (to - from) * k;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const createScene = (look) => ({
  tick: 0,
  at: 0,
  hour: 22,
  belly: null,
  look,
  pantry: [],
  busy: false,
  tools: /* @__PURE__ */ new Map(),
  minions: 0,
  level: 0,
  lastLevel: 0,
  typedAt: -100,
  errorAt: -100,
  activeAt: 0,
  perkAt: -100,
  cheerAt: -100,
  flashAt: -100,
  arrived: 0,
  rate: 0,
  heat: 0,
  servings: [],
  motes: [],
  bits: [],
  chew: 0,
  bob: 0,
  breathe: 0,
  blinkAt: -100,
  gaze: { x: 0, y: 0 },
  gazeTo: { x: 0, y: 0 },
  gazeUntil: 0,
  googly: { x: 0, y: 0 },
  googlyV: { x: 0, y: 0 },
  squash: 0,
  squashV: 0,
  lid: 0,
  open: 0,
  smile: 0.3,
  blush: 0,
  power: 0,
  combo: 0,
  best: 0,
  comboAt: -100,
  lastHitAt: -Infinity,
  finish: null
});
const serve = (s, tokens, color, heats = true) => {
  if (tokens <= 0) return;
  if (heats) s.arrived += tokens;
  s.activeAt = s.tick;
  s.servings.push({ tokens: Math.min(tokens, 3e3), color });
  s.servings = s.servings.slice(-24);
};
const perk = (s) => {
  s.perkAt = s.tick;
  s.activeAt = s.tick;
};
const hit = (s, isError, at) => {
  s.combo = at - s.lastHitAt > COMBO_MS ? 1 : s.combo + 1;
  s.best = Math.max(s.best, s.combo);
  s.lastHitAt = at;
  s.comboAt = s.tick;
  s.activeAt = s.tick;
  s.squashV += 0.05;
  if (isError) {
    s.errorAt = s.tick;
    s.finish = { text: "COUNTER", at: s.tick };
  }
};
const startTurn = (s) => {
  s.busy = true;
  s.combo = 0;
  s.best = 0;
  s.activeAt = s.tick;
};
const finishTurn = (s, isAborted = false) => {
  if (!isAborted) {
    if (s.best >= 3) s.finish = { text: "K.O.", at: s.tick };
    s.cheerAt = s.tick;
  }
  s.busy = false;
  s.tools.clear();
  s.combo = 0;
  s.best = 0;
  s.activeAt = s.tick;
};
const settle = (s) => {
  s.arrived = 0;
  s.rate = 0;
  s.heat = 0;
  s.servings = [];
  s.motes = [];
  s.bits = [];
};
const comboShown = (s) => s.combo >= 2 && s.tick - s.comboAt <= COMBO_FRAMES;
const lively = (s) => s.busy || s.heat > 0.02 || s.power > 0.02 || s.motes.length > 0 || s.servings.length > 0 || s.bits.some((bit) => bit.kind !== "z" && bit.kind !== "firefly") || s.tick - s.typedAt < 15 || s.tick - s.cheerAt < CHEER || s.tick - s.perkAt < PERK || Math.abs(s.squashV) > 0.01 || comboShown(s) || s.finish !== null && s.tick - s.finish.at < 18;
const shape = (s, width, height) => {
  const t = s.tick;
  const full = (s.belly?.percent ?? 0) / 100;
  const fill = s.belly?.fill ?? 0;
  const idle = s.belly === null ? 0 : s.at - s.belly.fedAt;
  const starving = idle >= STARVING;
  const monster = s.look.monster;
  const eating = s.heat > 0.02;
  const quiet = t - s.activeAt;
  const hungry = idle >= SAD;
  const sleeping = !s.busy && !eating && quiet > DOZE && !hungry;
  const yawning = !s.busy && !eating && quiet > DOZE - YAWN && !sleeping && !hungry;
  const floor = height - 4;
  const tight = 1 - s.power * 0.18;
  const r0 = Math.min(width * 0.5, height * 0.62) * 0.5;
  const wobble = monster === "slime" ? 1 + 0.05 * Math.sin(s.breathe * 2.2) : 1;
  const breath = 1 + Math.sin(s.breathe) * (sleeping ? 0.05 : 0.025);
  const rx0 = Math.min(width * 0.36, r0 * (0.78 + 0.5 * full) * (starving ? 0.85 : 1) * wobble) * tight;
  const ry0 = Math.min(height * 0.3, r0 * (0.82 + 0.3 * full)) * tight * breath;
  const rx = rx0 * (1 + s.squash * 0.7);
  const ry = ry0 * (1 - s.squash);
  const hopP = (t - s.cheerAt) / HOP;
  const hop = hopP >= 0 && hopP < 1 ? Math.sin(Math.PI * hopP) * r0 * 0.45 : 0;
  const lift = (monster === "ghost" ? 3 + Math.sin(s.breathe * 1.3) * 1.4 : 0) + (eating ? Math.abs(Math.sin(s.bob)) * (0.3 + s.heat * 1.8) : 0) + s.power * 1.5 + hop;
  const shake = s.heat > 0.7 || s.level >= 2 || t - s.errorAt < 6 ? Math.round((hash(t, 1) - 0.5) * 2) : 0;
  const cx = width / 2 + shake;
  const feet = monster === "ghost" || monster === "slime" ? 0 : r0 * 0.18;
  const cy = floor - feet - ry - Math.min(lift, Math.max(0, floor - feet - 2 * ry - 4));
  return {
    t,
    monster,
    floor,
    r0,
    rx,
    ry,
    lift,
    cx,
    cy,
    feet,
    eating,
    starving,
    sleeping,
    yawning,
    heat: s.heat,
    power: s.power,
    // How hard the combo burns, 0 to 1, dying down once the chain breaks.
    blaze: comboShown(s) ? (0.3 + 0.7 * clamp((s.combo - 2) / 6)) * clamp((COMBO_FRAMES - (t - s.comboAt)) / 12) : 0,
    flare: t - s.comboAt < 4 ? 1 - (t - s.comboAt) / 4 : 0,
    level: s.level,
    wave: s.breathe,
    hour: s.hour,
    sad: idle >= SAD,
    burping: s.belly?.burpAt != null && s.at - s.belly.burpAt < BURP,
    bursting: fill >= BURST,
    stuffed: fill >= 75,
    pressure: Math.max(0, ...s.pantry.map((limit) => limit.percentUsed)),
    typing: t - s.typedAt < 15,
    perking: t - s.perkAt < PERK,
    cheering: t - s.cheerAt < CHEER,
    thinking: s.busy && !eating,
    angry: t - s.errorAt < 20,
    blink: t - s.blinkAt < 3 && t - s.typedAt >= 15,
    body: starving ? mix(PALETTE[s.look.color] ?? 4029439, 9080729, 0.55) : PALETTE[s.look.color] ?? 4029439,
    mouth: { x: cx, y: cy + ry * (monster === "slime" ? 0.3 : 0.34) }
  };
};
const mood = (s, f) => {
  const chomp = Math.abs(Math.sin(s.chew));
  const set = (eyes, brows, lid, open, smile, blush) => ({
    eyes,
    brows,
    lid,
    open,
    smile,
    blush
  });
  if (f.bursting && f.power <= 0.5) return set("dizzy", "sad", 0, 0.35 + 0.15 * Math.sin(f.t * 0.3), -0.3, 0.3);
  if (f.angry && f.t - s.errorAt < 10) return set("squeeze", "sad", 0, 0.15, -0.8, 0);
  if (f.burping) return set("happy", "none", 0, 1, 0.6, 0.6);
  if (f.cheering) return set("happy", "none", 0, 0.75, 1, 1);
  if (f.power > 0.5) return set("open", "fierce", 0.1, f.eating ? 0.3 + 0.6 * chomp : 0.5, 0.3, 0.2);
  if (f.blaze > 0.3) return set("open", "fierce", 0.15, f.eating ? 0.3 + 0.6 * chomp : 0.25, 0.6, 0.4);
  if (f.sleeping) return set("closed", "none", 1, 0.12 + 0.06 * Math.sin(f.wave), 0.1, 0.35);
  if (f.yawning) return set("closed", "none", 1, 1, 0, 0);
  if (f.eating) return set("open", "none", 0.1 + f.heat * 0.35, (0.25 + 0.75 * f.heat) * chomp, 0.6, 0.2 + f.heat * 0.7);
  if (f.typing || f.perking) return set("open", "none", 0, 0.3, 0.4, 0.3);
  if (f.thinking) return set("open", "none", 0.25, 0, -0.1, 0);
  if (f.starving) return set("open", "sad", 0.55, 0, -1, 0);
  if (f.sad) return set("open", "sad", 0.3, 0, -0.7, 0);
  if (f.stuffed) return set("open", "none", 0.45, 0, 0.8, 0.6);
  return set("open", "none", 0.05, 0, 0.35, 0.15);
};
const step = (s, width, height) => {
  s.tick += 1;
  s.rate = s.rate * 0.85 + s.arrived * 0.15;
  s.arrived = 0;
  s.heat = 1 - Math.exp(-s.rate / 8);
  s.breathe += s.tick - s.activeAt > DOZE ? 0.02 : 0.035;
  if (s.heat > 0.02) {
    s.chew += 0.15 + s.heat * 0.9;
    s.bob += 0.12 + s.heat * 0.7;
  }
  if (s.tick - s.blinkAt > 3 && random() < 1 / 50) s.blinkAt = s.tick;
  if (s.tick >= s.gazeUntil) {
    s.gazeTo = s.tools.size > 0 ? { x: 0.8, y: 0 } : s.busy ? { x: -0.5, y: -0.8 } : { x: (random() * 2 - 1) * 0.8, y: (random() * 2 - 1) * 0.5 };
    s.gazeUntil = s.tick + 15 + random() * 60;
  }
  const looking = s.tick - s.typedAt < 15 || s.tick - s.perkAt < PERK ? { x: 0, y: 0.9 } : s.gazeTo;
  s.gaze = { x: ease(s.gaze.x, looking.x, 0.35), y: ease(s.gaze.y, looking.y, 0.35) };
  s.googlyV = {
    x: (s.googlyV.x + (s.gaze.x - s.googly.x) * 0.25) * 0.72,
    y: (s.googlyV.y + (s.gaze.y + 0.25 - s.googly.y) * 0.25 + s.squashV * 3) * 0.72
  };
  s.googly = { x: clamp(s.googly.x + s.googlyV.x, -1, 1), y: clamp(s.googly.y + s.googlyV.y, -1, 1) };
  if (s.level > s.lastLevel) s.flashAt = s.tick;
  s.lastLevel = s.level;
  s.power += ((s.level > 0 ? 1 : 0) - s.power) * 0.08;
  if (s.tick - s.cheerAt === HOP) s.squashV += 0.14;
  s.squashV = (s.squashV + (0 - s.squash) * 0.35) * 0.7;
  s.squash += s.squashV;
  const f = shape(s, width, height);
  const face2 = mood(s, f);
  const quick = face2.eyes === "open" && f.eating ? 0.6 : 0.25;
  s.lid = ease(s.lid, face2.lid, 0.25);
  s.open = ease(s.open, face2.open, quick);
  s.smile = ease(s.smile, face2.smile, 0.2);
  s.blush = ease(s.blush, face2.blush, 0.1);
  for (let budget = 1 + Math.round(s.heat * 5); budget > 0 && s.servings.length > 0; budget--) {
    const serving = s.servings[0];
    const bite = Math.max(25, serving.tokens / 40);
    const [x, y] = serving.color === PROMPT ? [random() * width, height - 1] : [random() < 0.5 ? 0 : width - 1, 2 + random() * (f.floor - 6)];
    s.motes.push({ x, y, px: x, py: y, color: serving.color });
    serving.tokens -= bite;
    if (serving.tokens <= 0) s.servings.shift();
  }
  const speed = 1.2 + s.heat * 2.2 + s.power;
  const { mouth: mouth2 } = f;
  s.motes = s.motes.slice(-120).filter((mote) => {
    const [dx, dy] = [mouth2.x - mote.x, mouth2.y - mote.y];
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) {
      s.squashV += 0.015;
      if (random() < 0.5) {
        s.bits.push({
          kind: "crumb",
          x: mouth2.x + (random() - 0.5) * 3,
          y: mouth2.y,
          vx: (random() - 0.5) * 1.4,
          vy: -0.4 - random() * 0.8,
          life: 26,
          max: 26,
          color: mix(mote.color, 13011530, 0.4)
        });
      }
      return false;
    }
    mote.px = mote.x;
    mote.py = mote.y;
    mote.x += dx / dist * Math.min(dist, speed);
    mote.y += dy / dist * Math.min(dist, speed);
    return true;
  });
  if (s.tick - s.cheerAt === 1) {
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      s.bits.push({
        kind: "spark",
        x: f.cx + Math.cos(angle) * (f.rx + 3),
        y: f.cy + Math.sin(angle) * (f.ry + 3),
        vx: Math.cos(angle) * 0.3,
        vy: Math.sin(angle) * 0.3 - 0.1,
        life: 22,
        max: 22,
        color: i % 2 ? GOLD_LIGHT : WHITE
      });
    }
  }
  if (s.finish?.text === "K.O." && s.tick - s.finish.at === 1) {
    for (let i = 0; i < 24; i++) {
      s.bits.push({
        kind: "confetti",
        x: random() * width,
        y: -random() * 8,
        vx: (random() - 0.5) * 0.4,
        vy: 0.2 + random() * 0.3,
        life: 40,
        max: 40,
        color: [16734815, 16765503, 6094730, 6080767, 16740312][i % 5]
      });
    }
  }
  if (f.sleeping && s.tick % 28 === 0) {
    s.bits.push({ kind: "z", x: f.cx + f.rx * 0.6, y: f.cy - f.ry, vx: 0.15, vy: -0.25, life: 50, max: 50, color: 14542591 });
  }
  if (f.sad && !f.starving && !f.sleeping && s.tick % 20 === 0) {
    const side = s.tick % 40 === 0 ? -1 : 1;
    s.bits.push({ kind: "tear", x: f.cx + side * f.rx * 0.45, y: f.cy - f.ry * 0.1, vx: 0, vy: 0.3, life: 20, max: 20, color: 7259903 });
  }
  if ((f.typing || f.perking) && !f.eating && s.tick % 12 === 0) {
    s.bits.push({ kind: "drool", x: mouth2.x + f.rx * 0.2, y: mouth2.y + 1, vx: 0, vy: 0.25, life: 14, max: 14, color: 12577279 });
  }
  if (f.burping && s.tick % 6 === 0 && s.bits.filter((bit) => bit.kind === "puff").length < 4) {
    s.bits.push({ kind: "puff", x: mouth2.x, y: mouth2.y - 2, vx: (random() - 0.5) * 0.4, vy: -0.35, life: 24, max: 24, color: 14087624 });
  }
  for (let i = 0; s.tick - s.comboAt === 1 && s.combo >= 2 && i < 3 + Math.min(s.combo, 9); i++) {
    s.bits.push({
      kind: "ember",
      x: f.cx + (random() - 0.5) * f.rx * 1.6,
      y: f.cy + f.ry * 0.3,
      vx: (random() - 0.5) * 1.2,
      vy: -0.6 - random() * 0.8,
      life: 18 + random() * 12,
      max: 30,
      color: random() < 0.5 ? 16756782 : 16734751
    });
  }
  if (f.blaze > 0 && random() < 0.3 + f.blaze) {
    s.bits.push({
      kind: "ember",
      x: f.cx + (random() - 0.5) * f.rx * 2,
      y: f.cy + f.ry * 0.5,
      vx: (random() - 0.5) * 0.5,
      vy: -0.5 - random() * 0.6 * (1 + f.blaze),
      life: 16 + random() * 14,
      max: 30,
      color: random() < 0.4 ? 16769354 : random() < 0.7 ? 16747039 : 16726815
    });
  }
  const night = 1 - daylight(s.hour);
  if (night > 0.6 && !s.busy && s.bits.filter((bit) => bit.kind === "firefly").length < 3 && random() < 0.02) {
    s.bits.push({ kind: "firefly", x: random() * width, y: f.floor - 2 - random() * 8, vx: 0, vy: 0, life: 120, max: 120, color: 14221178 });
  }
  s.bits = s.bits.slice(-160).filter((bit) => {
    bit.life -= 1;
    if (bit.kind === "crumb" || bit.kind === "confetti" || bit.kind === "tear" || bit.kind === "drool") {
      bit.vy += bit.kind === "confetti" ? 0.01 : 0.12;
      if (bit.kind === "confetti") bit.vx = Math.sin((bit.life + bit.color) * 0.3) * 0.3;
      if (bit.y + bit.vy >= f.floor && bit.kind === "crumb") {
        bit.vy *= -0.4;
        bit.vx *= 0.6;
      }
    }
    if (bit.kind === "ember") {
      bit.vy -= 0.02;
      bit.vx += (random() - 0.5) * 0.2;
    }
    if (bit.kind === "firefly") {
      bit.vx = ease(bit.vx, (random() - 0.5) * 0.6, 0.1);
      bit.vy = ease(bit.vy, (random() - 0.5) * 0.4, 0.1);
    }
    bit.x += bit.vx;
    bit.y += bit.vy;
    return bit.life > 0 && bit.y < height + 2;
  });
};
class Canvas {
  constructor(width, height) {
    __publicField(this, "width");
    __publicField(this, "height");
    __publicField(this, "px");
    this.width = width;
    this.height = height;
    this.px = new Uint32Array(width * height);
  }
  get(x, y) {
    return this.px[Math.round(y) * this.width + Math.round(x)] ?? 0;
  }
  put(x, y, color, alpha = 1) {
    const [cx, cy] = [Math.round(x), Math.round(y)];
    if (cx >= 0 && cy >= 0 && cx < this.width && cy < this.height) {
      this.px[cy * this.width + cx] = alpha >= 1 ? color : mix(this.get(cx, cy), color, alpha);
    }
  }
  // Light added, not painted over: a glow brightens the dark sky instead of muddying it.
  add(x, y, color, amount) {
    const [cx, cy] = [Math.round(x), Math.round(y)];
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return;
    const under = this.get(cx, cy);
    const channel = (shift) => Math.min(255, (under >> shift & 255) + Math.round((color >> shift & 255) * amount)) << shift;
    this.px[cy * this.width + cx] = channel(16) | channel(8) | channel(0);
  }
  disc(x, y, r, color, alpha = 1) {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r * r) this.put(x + dx, y + dy, color, alpha);
      }
    }
  }
  line(x0, y0, x1, y1, color, alpha = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.put(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, color, alpha);
  }
  // A solid shape, lit from the upper left in cel-shaded bands, with an outline.
  // `inside` takes coordinates normalised to the shape's radii.
  blob(cx, cy, rx, ry, color, inside, { alpha = 1, rim = INK, belly = false } = {}) {
    const [x0, x1] = [Math.floor(cx - rx * 1.6 - 2), Math.ceil(cx + rx * 1.6 + 2)];
    const [y0, y1] = [Math.floor(cy - ry * 1.6 - 2), Math.ceil(cy + ry * 1.6 + 2)];
    const at = (x, y) => inside((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!at(x, y)) continue;
        const [nx, ny] = [(x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry];
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)));
        const light = -0.45 * nx - 0.55 * ny + 0.7 * nz;
        let tone = light > 0.82 ? mix(color, WHITE, 0.32) : light > 0.5 ? mix(color, WHITE, 0.12) : light > 0.12 ? color : mix(color, BLACK, 0.3);
        if (belly && (nx / 0.55) ** 2 + ((ny - 0.38) / 0.5) ** 2 < 1) tone = mix(tone, WHITE, 0.25);
        if ((nx + 0.38) ** 2 + (ny + 0.48) ** 2 < 0.018) tone = mix(tone, WHITE, 0.7);
        const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
        this.put(x, y, edge ? mix(color, rim, 0.75) : tone, alpha);
      }
    }
  }
}
const daylight = (hour) => clamp(Math.sin((hour - 6) / 12 * Math.PI) * 1.6, 0, 1);
const SKIES = [
  [0, 461598, 1905728],
  [5, 856112, 3810128],
  [6.5, 3816058, 16752250],
  [8, 4886754, 12116735],
  [16.5, 4886754, 12116735],
  [18.5, 4206702, 16744031],
  [20, 1314864, 3481679],
  [24, 461598, 1905728]
];
const skyAt = (hour) => {
  const h = (hour % 24 + 24) % 24;
  const i = Math.max(0, SKIES.findIndex(([at]) => at > h) - 1);
  const [a, top0, bottom0] = SKIES[i];
  const [b, top1, bottom1] = SKIES[i + 1] ?? SKIES[i];
  const k = b === a ? 0 : (h - a) / (b - a);
  return { top: mix(top0, top1, k), bottom: mix(bottom0, bottom1, k) };
};
const world = (c, { t, floor, hour, wave }) => {
  const { top, bottom } = skyAt(hour);
  const day = daylight(hour);
  const night = 1 - day;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) c.px[y * c.width + x] = mix(top, bottom, y / floor);
  }
  for (let i = 0; i < 18 && night > 0.3; i++) {
    const twinkle = hash(i, Math.floor((t + i * 7) / 30)) > 0.7 ? 1 : 0.35;
    c.put((i * 37 + 11) % c.width, (i * 23 + 5) % Math.max(1, floor - 8), mix(top, WHITE, twinkle * night));
  }
  const streak = t % 260;
  if (night > 0.6 && streak < 9 && hash(Math.floor(t / 260), 7) < 0.5) {
    const [sx, sy] = [c.width * 0.15 + streak * 2.5, 2 + streak * 0.7];
    for (let k = 0; k < 5; k++) c.add(sx - k * 1.2, sy - k * 0.35, 16777215, 0.8 - k * 0.15);
  }
  const sunP = (hour - 6) / 12;
  if (sunP > 0 && sunP < 1) {
    const [x, y] = [c.width * (0.12 + 0.76 * sunP), floor - 6 - Math.sin(Math.PI * sunP) * (floor - 10)];
    for (let r = 6; r > 2; r--) c.disc(x, y, r, 16765562, 0.08);
    c.disc(x, y, 2.6, 16773552);
  } else {
    const p = (hour + 6) % 24 / 12;
    const [x, y] = [c.width * (0.12 + 0.76 * clamp(p)), floor - 6 - Math.sin(Math.PI * clamp(p)) * (floor - 10)];
    c.disc(x, y, 2.6, 15921382);
    c.disc(x + 1.2, y - 0.8, 2.2, mix(top, bottom, y / floor));
  }
  for (let i = 0; i < 3 && day > 0.2; i++) {
    const x = (hash(i, 11) * c.width + t * (0.03 + 0.02 * i)) % (c.width + 16) - 8;
    const y = 3 + hash(i, 12) * (floor * 0.35);
    for (const [dx, dy, r] of [[0, 0, 2.2], [2.5, -0.8, 2.6], [5, 0, 2]]) c.disc(x + dx, y + dy, r, WHITE, 0.75 * day);
  }
  for (let x = 0; x < c.width; x++) {
    const far = floor - 7 - 3 * Math.sin(x * 0.13 + 1.3) - 1.5 * Math.sin(x * 0.31);
    const near = floor - 3 - 2 * Math.sin(x * 0.21 + 4);
    for (let y = Math.floor(far); y < floor; y++) c.put(x, y, mix(bottom, mix(1780287, 5930394, day), 0.55));
    for (let y = Math.floor(near); y < floor; y++) c.put(x, y, mix(1450810, 4161370, day));
  }
  const grass = mix(1780287, 4165455, day);
  for (let y = floor; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) c.px[y * c.width + x] = mix(grass, BLACK, 0.12 * (y - floor));
  }
  for (let i = 0; i < c.width; i += 5) {
    const x = i + Math.floor(hash(i, 3) * 3);
    const sway = Math.sin(wave * 1.5 + i) * 0.8;
    c.line(x, floor, x + sway, floor - 2 - hash(i, 4) * 2, mix(grass, WHITE, 0.15));
  }
};
const glow = (c, { t, cx, cy, rx, ry, floor, pressure, power }, hasLimits) => {
  if (!hasLimits || power > 0.5 && pressure < RED) return;
  const color = pressure >= RED ? 16726843 : pressure >= AMBER ? 16756782 : 3134074;
  const pulse = pressure >= RED ? 0.55 + 0.45 * Math.sin(t * 0.6) : Math.max(0, 1 - power * 2);
  for (let y = 0; y < floor; y++) {
    for (let x = 0; x < c.width; x++) {
      const d = Math.hypot((x + 0.5 - cx) / (rx + 6), (y + 0.5 - cy) / (ry + 5));
      if (d < 1) c.add(x, y, color, 0.22 * (1 - d) * pulse);
    }
  }
};
const aura = (c, { t, cx, cy, rx, ry, floor, power, level }, flashAt) => {
  const flash = t - flashAt;
  if (flash >= 0 && flash < 10) {
    const r = 3 + flash * 3;
    for (let a = 0; a < 64; a++) {
      const angle = a / 64 * Math.PI * 2;
      c.add(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.8, 16777215, 1 - flash / 10);
    }
  }
  if (power < 0.03) return;
  const reach = rx + 4 + level;
  for (let y = 0; y < floor; y++) {
    for (let x = 0; x < c.width; x++) {
      const nx = (x + 0.5 - cx) / reach;
      let ny = (y + 0.5 - cy) / (ry + 3);
      if (ny < 0) ny *= 0.42 + 0.06 * (3 - level);
      const d = Math.hypot(nx, ny);
      const flame = 1 + 0.22 * Math.sin(Math.atan2(ny, nx) * 9 + t * 0.9) + 0.12 * Math.sin(y * 0.9 + t * 1.4);
      if (d >= flame) continue;
      const out = Math.max(0, (d - 0.55) / (flame - 0.55));
      const color = mix(16764928, 16747008, out);
      if (out < 0.6) c.put(x, y, mix(color, 16774048, 0.3 * (1 - out)), Math.min(1, power * 1.2) * 0.85 * (1 - out * 0.6));
      else c.add(x, y, color, power * (1 - out) * 0.9);
    }
  }
  for (let i = 0; i < 6 + level * 4; i++) {
    const x = cx + (hash(i, 3) * 2 - 1) * reach;
    const y = floor - (t * (0.6 + hash(i, 4)) + hash(i, 5) * 40) % (floor - 2);
    c.add(x, y, GOLD_LIGHT, power);
  }
  if (level >= 2 && t % 4 < 2) {
    for (let b = 0; b < level - 1; b++) {
      const side = hash(t >> 2, b) < 0.5 ? -1 : 1;
      let [x, y] = [cx + side * (rx + 1 + hash(t >> 2, b + 9) * 3), cy - ry + hash(t >> 2, b + 5) * ry];
      for (let k = 0; k < 6; k++) {
        const [nx, ny] = [x + (hash(t >> 2, b * 10 + k) - 0.5) * 4 + side, y + 1.5 + hash(t >> 2, b * 20 + k) * 2];
        c.line(x, y, nx, ny, BOLT);
        x = nx;
        y = ny;
      }
    }
  }
};
const blaze = (c, { t, cx, cy, rx, ry, floor, blaze: k, flare }, front) => {
  const fire = Math.max(k, flare * 0.5);
  if (fire <= 0.01) return;
  const reach = rx + 3 + fire * 4;
  const stretch = 0.78 - fire * 0.45;
  for (let y = 0; y < floor; y++) {
    for (let x = Math.floor(cx - reach * 1.5); x <= Math.ceil(cx + reach * 1.5); x++) {
      const nx = (x + 0.5 - cx) / reach;
      let ny = (y + 0.5 - cy) / (ry + 2);
      if (ny < 0) ny *= stretch;
      const d = Math.hypot(nx, ny);
      const angle = Math.atan2(ny, nx);
      const tongue = 0.26 * Math.sin(angle * 7 + t * 1.2) + 0.15 * Math.sin(angle * 13 - t * 2.1) + 0.12 * Math.sin(y * 0.8 + t * 2.4);
      const limit = 1 + tongue * (0.6 + fire * 0.6) + flare * 0.15;
      if (d >= limit) continue;
      if (front && (y < cy + ry * 0.25 || d < 0.8)) continue;
      const out = clamp((d - 0.55) / (limit - 0.55));
      const color = out < 0.3 ? mix(mix(16756736, 16770688, fire * 0.5), 16751104, out / 0.3) : out < 0.65 ? mix(16747008, 15222794, (out - 0.3) / 0.35) : mix(14696458, 10097672, (out - 0.65) / 0.35);
      if (out < 0.7) c.put(x, y, color, (front ? 0.75 : 0.92) * (1 - out * 0.4));
      else c.add(x, y, color, 0.5 * (1 - out) * 3 * (0.5 + fire * 0.5));
    }
  }
};
const shadow = (c, { cx, rx, floor, lift }) => {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const k = 1 - ((x + 0.5 - cx) / rx) ** 2;
    if (k > 0) c.put(x, floor, BLACK, 0.45 * k * Math.max(0.2, 1 - lift / 8));
  }
};
const HELPERS = [16740312, 6080767, 16765503, 6094730];
const helpers = (c, f, count) => {
  const { t, monster, cx, rx, floor, mouth: mouth2, power } = f;
  for (let i = 0; i < Math.min(4, count); i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const home = side < 0 ? 5 + (i >> 1) * 8 : c.width - 6 - (i >> 1) * 8;
    const target = cx + side * (rx + 4);
    const p = (t + i * 23) % 70 / 70;
    let x = home;
    let toss = -1;
    if (p >= 0.5 && p < 0.65) x = ease(home, target, (p - 0.5) / 0.15);
    else if (p >= 0.65 && p < 0.75) {
      x = target;
      toss = (p - 0.65) / 0.1;
    } else if (p >= 0.75) x = ease(target, home, (p - 0.75) / 0.25);
    const running = p >= 0.5 && p < 0.65 || p >= 0.75;
    const beat = Math.sin(t * 0.6);
    const hop = running ? Math.abs(Math.sin(t * 1.3 + i)) * 1.5 : Math.abs(beat) * 2.5;
    const float = monster === "ghost" ? 2 + Math.sin(t * 0.2 + i) : 0;
    const y = floor - 3 - hop - float;
    const color = mix(HELPERS[i], GOLD, power * 0.3);
    const squash = hop < 0.4 && !running ? 0.15 : 0;
    const facing = running ? p < 0.65 ? -side : side : 0;
    const mini = (nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (monster === "slime") return d < 1 && ny < 0.8;
      if (monster === "ghost") return ny < 0 ? d < 1 : Math.abs(nx) < 1 && ny < 1 + 0.25 * Math.sin(nx * 6 + t * 0.6);
      if (monster === "cookie") return d < 1 + 0.12 * Math.sin(Math.atan2(ny, nx) * 9);
      return d < 1;
    };
    c.blob(x, y, 3.2 * (1 + squash), 2.9 * (1 - squash), color, mini);
    if (monster === "gremlin") {
      c.put(x - 2, y - 3.5, 15392712);
      c.put(x + 2, y - 3.5, 15392712);
    }
    const armUp = running || toss >= 0 ? 1 : beat > 0 ? 1 : 0;
    if (monster !== "ghost") {
      c.put(x - 3.5, y - armUp * 1.5, mix(color, INK, 0.3));
      c.put(x + 3.5, y - (1 - armUp) * 1.5 - (running ? 1.5 : 0), mix(color, INK, 0.3));
    }
    const [ey, gaze] = [monster === "cookie" ? y - 2.5 : y - 0.8, facing * 0.6];
    c.put(x - 1, ey, WHITE);
    c.put(x + 1, ey, WHITE);
    c.put(x - 1 + gaze, ey + 0.4, INK);
    c.put(x + 1 + gaze, ey + 0.4, INK);
    if (p >= 0.5 && p < 0.65) {
      c.disc(x, y - 4.5, 1, TEXT);
      c.add(x, y - 4.5, 16777215, 0.4);
    }
    if (toss >= 0) {
      const [tx, ty] = [ease(x, mouth2.x, toss), ease(y - 4.5, mouth2.y, toss) - Math.sin(Math.PI * toss) * 6];
      c.disc(tx, ty, 1, TEXT);
      c.add(tx, ty, 16777215, 0.5);
    }
  }
};
const limbs = (c, f, s) => {
  const { monster, cx, cy, rx, ry, r0, t, body, floor, feet } = f;
  const thick = Math.max(1.2, r0 * 0.15);
  const length = r0 * 0.6;
  if (feet > 0) {
    for (const side of [-1, 1]) {
      const tap = f.thinking && side === 1 && t % 10 < 3 ? 1 : 0;
      const fx = cx + side * rx * 0.42;
      const fy = Math.min(floor - 1, cy + ry + feet * 0.6) - tap;
      c.blob(fx, fy, rx * 0.26, feet * 1.1, mix(body, BLACK, 0.15), (nx, ny) => nx * nx + ny * ny < 1);
    }
  }
  if (monster === "ghost") return;
  for (const side of [-1, 1]) {
    const [ax, ay] = [cx + side * rx * 0.86, cy + ry * 0.1];
    const rest = { x: ax + side * length * 0.45, y: ay + length * 0.8 + Math.sin(f.wave + side) * 0.5 };
    const mouthSpot = { x: f.mouth.x + side * rx * 0.35, y: f.mouth.y + 1 };
    const up = { x: ax + side * length * 0.7, y: ay - length * 1.05 + Math.sin(t * 0.8 + side) * 0.8 };
    let hand = rest;
    if (f.cheering || s.finish?.text === "K.O." && t - s.finish.at < 30) hand = up;
    else if (f.power > 0.5) hand = { x: ax + side * length * 0.75, y: ay + length * 0.45 + (hash(t, side) - 0.5) };
    else if (f.eating) {
      const scoop = Math.max(0, Math.sin(s.chew * 0.5 + (side > 0 ? Math.PI : 0)));
      hand = { x: ease(rest.x, mouthSpot.x, scoop), y: ease(rest.y, mouthSpot.y, scoop) };
    } else if (f.typing || f.perking) {
      const rub = Math.sin(t * 1.2) * side * 0.8;
      hand = { x: cx + side * rx * 0.25 + rub, y: cy + ry * 0.6 };
    } else if (f.thinking && side === 1) hand = { x: f.mouth.x + rx * 0.3, y: f.mouth.y + ry * 0.28 };
    else if (f.sleeping) hand = { x: ax + side * length * 0.2, y: ay + length * 0.7 };
    const arm = mix(body, BLACK, 0.08);
    const steps = Math.ceil(Math.hypot(hand.x - ax, hand.y - ay) * 2);
    for (let k = 0; k <= steps; k++) {
      const p = k / Math.max(1, steps);
      c.disc(ease(ax, hand.x, p), ease(ay, hand.y, p), thick + 0.6, mix(arm, INK, 0.75));
    }
    for (let k = 0; k <= steps; k++) {
      const p = k / Math.max(1, steps);
      c.disc(ease(ax, hand.x, p), ease(ay, hand.y, p), thick, arm);
    }
    c.blob(hand.x, hand.y, thick * 1.35, thick * 1.35, mix(arm, WHITE, 0.08), (nx, ny) => nx * nx + ny * ny < 1);
  }
};
const torso = (c, f) => {
  const { monster, cx, cy, rx, ry, body, wave, t } = f;
  if (monster === "gremlin") {
    const wag = Math.sin(t * (f.eating ? 0.6 : 0.15)) * 0.6;
    for (let k = 0; k <= 12; k++) {
      const p = k / 12;
      const [x, y] = [cx + rx * (0.7 + p * 0.9), cy + ry * (0.6 - p * 0.9 + Math.sin(p * 3 + wag) * 0.2)];
      c.disc(x, y, 1.1, mix(body, BLACK, 0.25));
      if (k === 12) c.disc(x + 0.5, y - 0.8, 1.6, mix(body, BLACK, 0.35));
    }
  }
  const shapeOf = (nx, ny) => {
    const angle = Math.atan2(ny, nx);
    const d = Math.hypot(nx, ny);
    if (monster === "cookie") return d < 1 + 0.06 * Math.sin(angle * 14 + wave * 2) + 0.04 * (hash(Math.floor(angle * 9 + 40)) - 0.5);
    if (monster === "slime") {
      const sx = ny > 0 ? nx / (1 + 0.32 * ny) : nx;
      return Math.hypot(sx, ny) < 1 && ny < 0.9;
    }
    if (monster === "ghost") return ny < 0 ? d < 1 : Math.abs(nx) < 1 && ny < 1.05 + 0.2 * Math.sin(nx * 9 + wave * 4);
    return d < 1;
  };
  c.blob(cx, cy, rx, ry, body, shapeOf, {
    alpha: monster === "ghost" ? 0.88 : 1,
    belly: monster === "cookie" || monster === "gremlin"
  });
  if (monster === "slime") {
    for (let i = 0; i < 4; i++) {
      const p = ((t * 0.02 + hash(i, 21)) % 1 + 1) % 1;
      const [x, y] = [cx + (hash(i, 22) - 0.5) * rx * 1.1, cy + ry * (0.7 - p * 1.3)];
      if (shapeOf((x - cx) / rx, (y - cy) / ry)) c.disc(x, y, 0.8 + hash(i, 23), mix(body, WHITE, 0.45), 0.7);
    }
  }
  if (monster === "gremlin") {
    for (const side of [-1, 1]) {
      const twitch = hash(Math.floor(t / 40), side + 5) < 0.15 && t % 40 < 3 ? -1 : 0;
      const [bx, by] = [cx + side * rx * 0.85, cy - ry * 0.35];
      const [tx, ty] = [cx + side * rx * 1.45, cy - ry * 0.7 + twitch];
      for (let k = 0; k <= 1; k += 0.1) {
        const half = 2.2 * (1 - k);
        for (let d = -half; d <= half; d += 0.5) c.put(ease(bx, tx, k), ease(by, ty, k) + d, k > 0.85 ? mix(body, INK, 0.6) : mix(body, BLACK, 0.12));
      }
      const [hx, hy] = [cx + side * rx * 0.75, cy - ry * 1.3];
      const [fx, fy] = [cx + side * rx * 0.42, cy - ry * 0.75];
      for (let y = Math.floor(hy); y <= fy; y++) {
        const p = (y - hy) / (fy - hy);
        const x = hx + (fx - hx) * p;
        for (let dx = -2 * p; dx <= 2 * p; dx++) c.put(x + dx, y, mix(15392712, BLACK, 0.25 * p));
      }
    }
  }
};
const hair = (c, { t, cx, cy, rx, ry, r0, power, level }) => {
  if (power < 0.3) return;
  const spikes = 5;
  const length = Math.min((2 + level * 3) * power, cy - ry - 1, r0 * 0.9);
  for (let i = 0; i < spikes; i++) {
    const offset = (i - (spikes - 1) / 2) / ((spikes - 1) / 2);
    const [bx, by] = [cx + offset * rx * 0.7, cy - ry * Math.sqrt(1 - offset * offset * 0.49) + 1];
    const tall = length * (i === 2 ? 1.4 : 1 - Math.abs(offset) * 0.2);
    const sway = Math.sin(t * 0.3 + i) * 0.6;
    const [tx, ty] = [bx + offset * tall * 0.6 + sway, by - tall];
    for (let k = 0; k <= 1; k += 1 / Math.max(2, tall * 2)) {
      const half = 2.2 * (1 - k);
      const [x, y] = [bx + (tx - bx) * k, by + (ty - by) * k];
      for (let dx = -half; dx <= half; dx += 0.5) {
        c.put(x + dx, y, Math.abs(dx) > half - 0.6 ? GOLD_DARK : dx < 0 ? GOLD_LIGHT : GOLD);
      }
    }
  }
};
const eye = (c, x, y, r, look, lid, f, iris) => {
  const superEyes = f.power > 0.5;
  const sclera = f.monster === "ghost" ? 1708080 : f.monster === "gremlin" && !superEyes ? 16769357 : WHITE;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      c.put(x + dx, y + dy, d > r - 0.7 ? mix(sclera, INK, 0.55) : dy < -r * 0.45 ? mix(sclera, 9081008, 0.25) : sclera);
    }
  }
  const ir = r * (f.monster === "cookie" ? 0.58 : 0.62);
  const [ix, iy] = [x + look.x * (r - ir - 0.4), y + look.y * (r - ir - 0.4)];
  if (f.monster === "gremlin" && !superEyes) {
    for (let k = -ir; k <= ir; k += 0.5) c.put(ix, iy + k, INK);
  } else if (f.monster === "cookie" && !superEyes) {
    c.disc(ix, iy, ir, INK);
    c.disc(ix - ir * 0.35, iy - ir * 0.4, Math.max(0.6, ir * 0.3), WHITE);
  } else if (f.monster === "ghost") {
    c.disc(ix, iy, ir * 0.8, superEyes ? TEAL : f.eating ? 8386303 : 9412607);
    c.add(ix, iy, 16777215, 0.5);
  } else {
    const color = superEyes ? TEAL : iris;
    c.disc(ix, iy, ir, mix(color, BLACK, 0.15));
    c.disc(ix, iy + ir * 0.2, ir * 0.7, color);
    c.disc(ix, iy, ir * 0.48, INK);
    c.disc(ix - ir * 0.4, iy - ir * 0.45, Math.max(0.6, ir * 0.3), WHITE);
    c.put(ix + ir * 0.4, iy + ir * 0.4, WHITE);
  }
  if (lid > 0.02) {
    const cut = y - r + lid * 2 * r;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r || y + dy > cut) continue;
        c.put(x + dx, y + dy, Math.abs(y + dy - cut) < 0.8 || d > r - 0.7 ? mix(f.body, INK, 0.7) : mix(f.body, BLACK, 0.1));
      }
    }
  }
};
const face = (c, f, s) => {
  const { t, monster, cx, cy, rx, ry, r0, body } = f;
  const m = mood(s, f);
  const eyes = monster === "slime" ? [[cx, cy - ry * 0.28, 0]] : monster === "cookie" ? [[cx - rx * 0.32, cy - ry * 0.8, -1], [cx + rx * 0.32, cy - ry * 0.8, 1]] : [[cx - rx * 0.34, cy - ry * 0.22, -1], [cx + rx * 0.34, cy - ry * 0.22, 1]];
  const re = Math.max(2, r0 * (monster === "slime" ? 0.42 : monster === "cookie" ? 0.34 : 0.26));
  const look = monster === "cookie" ? s.googly : s.gaze;
  const lid = m.eyes === "open" ? Math.max(s.lid, f.blink ? 1 : 0) : 0;
  const iris = { cookie: INK, slime: 1989170, ghost: 9412607, gremlin: INK }[monster] ?? 6961951;
  if (monster !== "ghost" && s.blush > 0.05) {
    for (const side of [-1, 1]) {
      const [bx, by] = [cx + side * rx * 0.55, cy + ry * 0.14];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx / 5 + dy * dy / 1.5 < 1) c.put(bx + dx, by + dy, BLUSH, 0.6 * s.blush);
    }
  }
  for (const [ex, ey, side] of eyes) {
    if (m.eyes === "dizzy") {
      c.disc(ex, ey, re, WHITE);
      for (let a = 0; a < 20; a++) {
        const angle = a / 20 * Math.PI * 2 + t * 0.4;
        const rr = re * (0.25 + 0.5 * (a / 20));
        c.put(ex + Math.cos(angle) * rr, ey + Math.sin(angle) * rr, INK);
      }
    } else if (m.eyes === "happy" || m.eyes === "closed") {
      for (let dx = -re; dx <= re; dx += 0.5) {
        const curve = (1 - (dx / re) ** 2) * re * 0.55;
        c.put(ex + dx, ey + (m.eyes === "happy" ? -curve + re * 0.2 : curve - re * 0.2), INK);
        c.put(ex + dx, ey + (m.eyes === "happy" ? -curve + re * 0.2 + 1 : curve - re * 0.2 + 1), INK, 0.5);
      }
    } else if (m.eyes === "squeeze") {
      const dir = side === 0 ? 1 : -side;
      if (monster !== "ghost") c.disc(ex, ey, re, WHITE);
      c.line(ex - re * 0.8 * dir, ey - re * 0.6, ex + re * 0.6 * dir, ey, INK);
      c.line(ex + re * 0.6 * dir, ey, ex - re * 0.8 * dir, ey + re * 0.6, INK);
    } else {
      eye(c, ex, ey, re, look, lid, f, iris);
    }
    if (m.brows !== "none" && side !== 0) {
      for (let dx = -re; dx <= re; dx += 0.5) {
        const inner = dx * -side / re;
        const by = ey - re - 1.4 + inner * (m.brows === "fierce" ? 1.3 : -1.3);
        c.put(ex + dx, by, mix(body, INK, 0.85));
        c.put(ex + dx, by - 0.6, mix(body, INK, 0.85));
      }
    }
  }
  mouth(c, f, s);
};
const mouth = (c, f, s) => {
  const { monster, rx, ry } = f;
  const { x: mx, y: my } = f.mouth;
  const open = clamp(s.open);
  const mw = rx * (monster === "slime" ? 0.3 : 0.42) * (0.8 + 0.2 * open);
  const mh = 0.6 + open * ry * 0.55;
  if (mh < 1.3) {
    for (let dx = -mw; dx <= mw; dx += 0.5) {
      const y = my + s.smile * 4 * (1 - (dx / mw) ** 2) - s.smile * 2;
      c.put(mx + dx, y, INK);
      if (Math.abs(dx) < mw * 0.45) c.put(mx + dx, y - Math.sign(s.smile) * 0.6, INK, 0.45);
    }
    return;
  }
  for (let y = Math.floor(my - mh); y <= Math.ceil(my + mh); y++) {
    for (let x = Math.floor(mx - mw); x <= Math.ceil(mx + mw); x++) {
      const [nx, ny] = [(x + 0.5 - mx) / mw, (y + 0.5 - my) / mh];
      const top = -1 + s.smile * 0.25 * (1 - nx * nx);
      if (ny < top || nx * nx + ny * ny >= 1) continue;
      const edge = nx * nx + ny * ny > 0.75 || ny < top + 0.25;
      const tooth = ny < top + 0.45 && x % 2 === 0 && (monster === "cookie" || monster === "gremlin");
      let color = ny > 0.3 ? mix(TONGUE, WHITE, ny > 0.55 && nx < 0 ? 0.2 : 0) : MOUTH;
      if (tooth) color = WHITE;
      if (edge && !tooth) color = mix(MOUTH, INK, 0.6);
      c.put(x, y, color);
    }
  }
  if (monster === "gremlin") {
    for (const side of [-0.55, 0.55]) for (let k = 0; k < 3; k++) c.put(mx + side * mw, my - mh + 1 + k, WHITE);
  }
};
const bits = (c, s) => {
  for (const bit of s.bits) {
    const fade = bit.life / bit.max;
    if (bit.kind === "spark") {
      const r = 1 + fade * 1.5;
      c.add(bit.x, bit.y, bit.color, fade);
      c.add(bit.x - r, bit.y, bit.color, fade * 0.6);
      c.add(bit.x + r, bit.y, bit.color, fade * 0.6);
      c.add(bit.x, bit.y - r, bit.color, fade * 0.6);
      c.add(bit.x, bit.y + r, bit.color, fade * 0.6);
    } else if (bit.kind === "z") {
      const size = fade > 0.5 ? 3 : 2;
      for (let k = 0; k < size; k++) {
        c.put(bit.x + k, bit.y, bit.color, fade);
        c.put(bit.x + k, bit.y + size - 1, bit.color, fade);
        c.put(bit.x + size - 1 - k, bit.y + k, bit.color, fade);
      }
    } else if (bit.kind === "puff") {
      c.disc(bit.x, bit.y, 1.2 + (1 - fade) * 2, bit.color, 0.5 * fade);
    } else if (bit.kind === "ember") {
      c.add(bit.x, bit.y, bit.color, Math.min(1, fade * 1.5));
    } else if (bit.kind === "firefly") {
      const glow2 = 0.5 + 0.5 * Math.sin(bit.life * 0.3);
      c.add(bit.x, bit.y, bit.color, 0.9 * glow2 * Math.min(1, fade * 4));
    } else {
      c.put(bit.x, bit.y, bit.color, bit.kind === "crumb" ? Math.min(1, fade * 2) : 1);
    }
  }
};
const GLYPHS = {
  "0": [7, 5, 5, 5, 7],
  "1": [2, 6, 2, 2, 7],
  "2": [7, 1, 7, 4, 7],
  "3": [7, 1, 7, 1, 7],
  "4": [5, 5, 7, 1, 1],
  "5": [7, 4, 7, 1, 7],
  "6": [7, 4, 7, 5, 7],
  "7": [7, 1, 1, 2, 2],
  "8": [7, 5, 7, 5, 7],
  "9": [7, 5, 7, 1, 7],
  C: [7, 4, 4, 4, 7],
  E: [7, 4, 7, 4, 7],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  K: [5, 5, 6, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [7, 5, 5, 5, 7],
  R: [7, 5, 6, 5, 5],
  S: [7, 4, 7, 1, 7],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  ".": [0, 0, 0, 0, 2],
  " ": [0, 0, 0, 0, 0]
};
const write = (c, text, x0, y0, scale, fill, shade) => {
  const cells = [];
  [...text].forEach((char, i) => {
    ;
    (GLYPHS[char] ?? GLYPHS[" "]).forEach((row, y) => {
      for (let x = 0; x < 3; x++) if (row & 4 >> x) cells.push([x0 + (i * 4 + x) * scale, y0 + y * scale, y]);
    });
  });
  for (const [x, y] of cells) {
    for (let dy = -1; dy <= scale; dy++) for (let dx = -1; dx <= scale; dx++) c.put(x + dx, y + dy, INK);
  }
  for (const [x, y, row] of cells) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) c.put(x + dx, y + dy, row < 3 ? fill : shade);
  }
};
const hud = (c, s) => {
  if (s.finish !== null && s.tick - s.finish.at < 18 && (s.tick - s.finish.at) % 6 < 5) {
    const big = s.finish.text === "K.O.";
    const scale = big ? 2 : 1;
    const width = s.finish.text.length * 4 * scale - scale;
    write(
      c,
      s.finish.text,
      big ? Math.round((c.width - width) / 2) : c.width - width - 2,
      big ? 3 : 2,
      scale,
      big ? 16726843 : 16769101,
      big ? 11735598 : 16742938
    );
  }
};
const paint = (s, width, height) => {
  const c = new Canvas(width, height);
  const f = shape(s, width, height);
  world(c, f);
  glow(c, f, s.pantry.length > 0);
  aura(c, f, s.flashAt);
  blaze(c, f, false);
  shadow(c, f);
  torso(c, f);
  limbs(c, f, s);
  blaze(c, f, true);
  helpers(c, f, s.minions);
  hair(c, f);
  face(c, f, s);
  for (const mote of s.motes) {
    c.put(mote.px, mote.py, mote.color, 0.4);
    c.put(mote.x, mote.y, mote.color);
  }
  bits(c, s);
  if (f.pressure >= RED || f.bursting || f.heat > 0.8) {
    const p = f.t * 0.06 % 1;
    c.disc(f.cx + f.rx * 0.78, f.cy - f.ry * 0.55 + p * f.ry * 0.5, 0.9, 12577279);
  }
  hud(c, s);
  return c.px;
};
const LEVELS = [0, 95, 135, 175, 215, 255];
const around = (v) => {
  const above = LEVELS.findIndex((level) => level >= v);
  return above <= 0 ? [LEVELS[0]] : [LEVELS[above - 1], LEVELS[above]];
};
const memo = /* @__PURE__ */ new Map();
const to256 = (color) => {
  const hit2 = memo.get(color);
  if (hit2 !== void 0) return hit2;
  const [r, g, b] = [color >> 16 & 255, color >> 8 & 255, color & 255];
  const mean = (r + g + b) / 3;
  const level = Math.min(23, Math.max(0, Math.round((mean - 8) / 10)));
  const candidates = [[8 + level * 10, 8 + level * 10, 8 + level * 10]];
  for (const x2 of around(r)) for (const y2 of around(g)) for (const z2 of around(b)) candidates.push([x2, y2, z2]);
  const cost = ([x2, y2, z2]) => {
    const m = (x2 + y2 + z2) / 3;
    const hue = (x2 - m - (r - mean)) ** 2 + (y2 - m - (g - mean)) ** 2 + (z2 - m - (b - mean)) ** 2;
    return (x2 - r) ** 2 + (y2 - g) ** 2 + (z2 - b) ** 2 + hue * 1.5;
  };
  const [x, y, z] = candidates.reduce((best, one) => cost(one) < cost(best) ? one : best);
  const out = x << 16 | y << 8 | z;
  if (memo.size < 4096) memo.set(color, out);
  return out;
};
const encode = (px, columns, rows, is256 = false) => {
  const words = new Uint32Array(columns * rows * 3);
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < columns; x++) {
      const i = (row * columns + x) * 3;
      const [top, bottom] = [px[2 * row * columns + x] ?? 0, px[(2 * row + 1) * columns + x] ?? 0];
      words[i] = 9600;
      words[i + 1] = is256 ? to256(top) : top;
      words[i + 2] = is256 ? to256(bottom) : bottom;
    }
  }
  const bytes = new Uint8Array(words.buffer);
  let text = "";
  for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(text);
};
export {
  AMBER,
  BURP,
  BURST,
  COMBO_MS,
  MINUTE,
  PALETTE,
  PROMPT,
  RED,
  SAD,
  STARVING,
  TEXT,
  THINKING,
  createScene,
  encode,
  finishTurn,
  hit,
  lively,
  paint,
  perk,
  serve,
  settle,
  startTurn,
  step,
  to256,
  toolColor
};
