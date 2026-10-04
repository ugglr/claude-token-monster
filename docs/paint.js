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
const LEVEL_UP = 50;
const EGG_CRACK = 28;
const EGG = 42;
const HATCH_WINDOW = 2e4;
const PALETTE = {
  blue: 4029439,
  cyan: 2279382,
  green: 4641120,
  yellow: 15909424,
  magenta: 13786352,
  red: 15749180,
  white: 14673648,
  // CrabStack's amber.
  amber: 16756736
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
const RAINBOW = [16734815, 16765503, 6094730, 6080767, 13073919, 16777215];
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
const rainbow = (turn) => {
  const h = (turn % 1 + 1) % 1 * 6;
  const x = 1 - Math.abs(h % 2 - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  return Math.round(r * 255) << 16 | Math.round(g * 255) << 8 | Math.round(b * 255);
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
  frenzy: 0,
  ended: "quiet",
  typedMs: -Infinity,
  combo: 0,
  best: 0,
  comboAt: -100,
  lastHitAt: -Infinity,
  finish: null,
  petAt: -100,
  fuss: "purr",
  affection: 0,
  lovedAt: 0,
  greetAt: -100,
  antic: null,
  anticAt: -1,
  lastAntic: null,
  shift: 0,
  eaten: 0,
  rank: 0,
  rankUpAt: -1e3,
  eggDue: null,
  eggAt: -1e3,
  waiting: false,
  waitAt: -1e3,
  cache: null
});
const serve = (s, tokens, color, heats = true) => {
  if (tokens <= 0) return;
  if (heats) {
    s.arrived += tokens;
    s.eaten += tokens;
  }
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
  s.ended = isAborted ? "quiet" : s.best >= 3 ? "ko" : "cheer";
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
const asleep = (s) => !s.busy && s.heat <= 0.02 && s.tick - s.activeAt > DOZE && (s.belly === null || s.at - s.belly.fedAt < SAD);
const levelUp = (s, rank) => {
  if (s.rank > 0 && rank > s.rank) {
    s.rankUpAt = s.tick;
    s.activeAt = s.tick;
  }
  s.rank = Math.max(s.rank, rank);
};
const hatch = (s, at) => {
  const due = s.eggDue;
  s.eggDue = null;
  if (due === null || at - due >= HATCH_WINDOW) return false;
  s.eggAt = s.tick;
  s.activeAt = s.tick;
  return true;
};
const wait = (s, isWaiting) => {
  if (isWaiting && !s.waiting) s.waitAt = s.tick;
  s.waiting = isWaiting;
  s.activeAt = s.tick;
};
const hatching = (s) => s.tick - s.eggAt >= 0 && s.tick - s.eggAt < EGG;
const settle = (s) => {
  s.arrived = 0;
  s.rate = 0;
  s.heat = 0;
  s.servings = [];
  s.motes = [];
  s.bits = [];
  s.antic = null;
};
const comboShown = (s) => s.combo >= 2 && s.tick - s.comboAt <= COMBO_FRAMES;
const lively = (s) => s.busy || s.waiting || s.heat > 0.02 || s.power > 0.02 || s.frenzy > 0.02 || s.motes.length > 0 || s.servings.length > 0 || s.bits.some((bit) => bit.kind !== "z" && bit.kind !== "firefly") || s.tick - s.typedAt < 15 || s.tick - s.cheerAt < CHEER || s.tick - s.perkAt < PERK || Math.abs(s.squashV) > 0.01 || comboShown(s) || s.finish !== null && s.tick - s.finish.at < 18 || s.antic !== null || s.tick - s.petAt < PET || s.tick - s.greetAt < GREET || Math.abs(s.shift) > 0.05 || s.tick - s.rankUpAt < LEVEL_UP || hatching(s);
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
  const sleeping = asleep(s);
  const yawning = !s.busy && !eating && quiet > DOZE - YAWN && !sleeping && !hungry;
  const floor = height - 4;
  const tight = 1 - s.power * 0.18;
  const r0 = Math.min(width * 0.5, height * 0.62) * 0.5;
  const wobble = monster === "slime" ? 1 + 0.05 * Math.sin(s.breathe * 2.2) : 1;
  const breath = 1 + Math.sin(s.breathe) * (sleeping ? 0.05 : 0.025);
  const [wide, low] = monster === "crab" ? [1.18, 0.7] : [1, 1];
  const rx0 = Math.min(width * 0.38, r0 * (0.78 + 0.5 * full) * (starving ? 0.85 : 1) * wobble * wide) * tight;
  const ry0 = Math.min(height * 0.3, r0 * (0.82 + 0.3 * full) * low) * tight * breath;
  const move = motion(s, r0);
  const grown = t - s.rankUpAt;
  const leveling = grown >= 0 && grown < LEVEL_UP;
  const flight = (grown - 4) / 14;
  const flying = flight > 0 && flight < 1;
  const spin = flying ? Math.cos(flight * Math.PI * 4) : 1;
  const egg2 = t - s.eggAt;
  const pop = egg2 >= EGG_CRACK && egg2 < EGG_CRACK + 6 ? 0.55 + 0.45 * ((egg2 - EGG_CRACK) / 6) : 1;
  const rx = rx0 * (1 + s.squash * 0.7) * pop * Math.max(0.14, Math.abs(spin)) * move.sx;
  const ry = ry0 * (1 - s.squash) * pop * move.sy;
  const hopP = (t - s.cheerAt) / HOP;
  const callP = (t - s.waitAt) % 15 / 8;
  const hop = (hopP >= 0 && hopP < 1 ? Math.sin(Math.PI * hopP) * r0 * 0.45 : 0) + (flying ? Math.sin(Math.PI * flight) * r0 * 1.5 : 0) + (s.waiting && callP < 1 ? Math.sin(Math.PI * callP) * r0 * 0.3 : 0);
  const lift = (monster === "ghost" ? 3 + Math.sin(s.breathe * 1.3) * 1.4 : 0) + (eating ? Math.abs(Math.sin(s.bob)) * (0.3 + s.heat * 1.8) : 0) + s.power * 1.5 + hop + move.lift;
  const shake = s.heat > 0.7 || s.level >= 2 || t - s.errorAt < 6 ? Math.round((hash(t, 1) - 0.5) * 2 * (1 + s.frenzy * 2)) : 0;
  const shuffle = monster === "crab" ? Math.round(Math.sin(s.breathe * 0.8) * 2) : 0;
  const cx = width / 2 + shake + shuffle + Math.round(s.shift + move.dx);
  const feet = monster === "ghost" || monster === "slime" ? 0 : r0 * (monster === "crab" ? 0.4 : 0.18);
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
    body: starving ? mix(PALETTE[s.look.color] ?? 4029439, 9080729, 0.55) : mix(PALETTE[s.look.color] ?? 4029439, rainbow(t * 0.08), s.frenzy * 0.4),
    frenzy: s.frenzy,
    mouth: { x: cx, y: cy + ry * (monster === "slime" ? 0.3 : monster === "crab" ? 0.05 : 0.34) },
    // Where it stands at rest, and the middle of its body there, for the antics' props.
    home: width / 2,
    rest: floor - feet - ry,
    // Turned away, by an antic or mid level-up spin: no face to draw.
    back: move.back || spin < 0.3,
    petting: t - s.petAt < PET,
    calling: s.waiting,
    // The prompt cache has lapsed since the last response: the next one re-reads it all.
    cold: !s.busy && s.cache !== null && s.at - s.cache.at > s.cache.ttl,
    greeting: t - s.greetAt < GREET,
    leveling,
    grown,
    egg: egg2,
    rank: s.rank,
    width,
    // Red and magenta monsters wear their reds in blue and teal, so they show.
    reddish: s.look.color === "red" || s.look.color === "magenta"
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
  if (f.leveling) return set("happy", "none", 0, 0.85, 1, 1);
  if (f.calling) return set("open", "none", 0, 0.55, 0.8, 0.5);
  if (f.bursting && f.power <= 0.5) return set("dizzy", "sad", 0, 0.35 + 0.15 * Math.sin(f.t * 0.3), -0.3, 0.3);
  if (f.angry && f.t - s.errorAt < 10) return set("squeeze", "sad", 0, 0.15, -0.8, 0);
  if (f.petting) {
    if (s.fuss === "stir") return set("closed", "none", 1, 0.1, 0.9, 1);
    if (s.fuss === "plead") return set("plead", "sad", 0, 0, -0.35, 0.6);
    return set("happy", "none", 0, f.eating ? 0.3 + 0.6 * chomp : s.fuss === "spin" ? 0.45 : 0, 1, 1);
  }
  if (f.greeting) return set("happy", "none", 0, 0.45, 1, 0.5);
  if (f.burping) return set("happy", "none", 0, 1, 0.6, 0.6);
  if (f.cheering) return set("happy", "none", 0, 0.75, 1, 1);
  if (f.frenzy > 0.55) return set("dizzy", "fierce", 0, 0.55 + 0.45 * chomp, 0.9, 1);
  if (f.power > 0.5) return set("open", "fierce", 0.1, f.eating ? 0.3 + 0.6 * chomp : 0.5, 0.3, 0.2);
  if (f.blaze > 0.3) return set("open", "fierce", 0.15, f.eating ? 0.3 + 0.6 * chomp : 0.25, 0.6, 0.4);
  if (s.antic !== null) {
    const [eyes, brows, lid, open, smile, blush] = feel(s, f, s.antic);
    return set(eyes, brows, lid, open, smile, blush);
  }
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
const ANTICS = {
  stretch: { len: 32, weight: 3 },
  scratch: { len: 30, weight: 3 },
  look: { len: 40, weight: 3 },
  wave: { len: 24, weight: 2 },
  chase: { len: 40, weight: 3 },
  juggle: { len: 40, weight: 2 },
  hop: { len: 18, weight: 2 },
  peek: { len: 34, weight: 2 },
  star: { len: 38, weight: 2 }
};
const PET = 22;
const GREET = 24;
const AWAY = 1200;
const LULL = 150;
const LULL_MORE = 300;
const HEART = 16732027;
const fondness = (s, at) => s.affection * 0.5 ** (Math.max(0, at - s.lovedAt) / (2 * MINUTE));
const pet = (s, at) => {
  const dozing = asleep(s);
  const starving = s.belly !== null && at - s.belly.fedAt >= STARVING;
  s.affection = Math.min(6, fondness(s, at) + 1);
  s.lovedAt = at;
  s.petAt = s.tick;
  s.fuss = dozing ? "stir" : starving ? "plead" : s.affection > 3.5 ? "spin" : s.affection > 1.5 ? "wiggle" : "purr";
  s.antic = null;
  if (!dozing) s.activeAt = s.tick;
  return s.fuss;
};
const typed = (s) => {
  const away = s.tick - s.activeAt >= AWAY && s.tick - s.typedAt >= AWAY;
  if (away) s.greetAt = s.tick;
  s.typedAt = s.tick;
  return away;
};
const calm = (s, f) => !s.busy && !s.waiting && !f.eating && !f.typing && !f.perking && !f.cheering && !f.sleeping && !f.yawning && !f.starving && !f.angry && !f.petting && !f.greeting && s.power < 0.05 && s.servings.length === 0 && s.motes.length === 0 && !comboShown(s);
const choose = (s, f) => {
  const night = daylight(s.hour) < 0.4;
  const options = Object.keys(ANTICS).filter(
    (kind) => kind !== s.lastAntic && (kind !== "star" || night) && (kind !== "scratch" || f.monster !== "ghost")
  );
  let roll = random() * options.reduce((sum, kind) => sum + ANTICS[kind].weight, 0);
  return options.find((kind) => (roll -= ANTICS[kind].weight) < 0) ?? options[0];
};
const progress = (s) => s.antic === null ? 0 : (s.tick - s.antic.at) / s.antic.len;
const swell = (p, rise, fall) => clamp(Math.min(p / rise, (1 - p) / fall));
const motion = (s, r0) => {
  const t = s.tick;
  const m = { dx: 0, lift: 0, sx: 1, sy: 1, back: false };
  const ghost = s.look.monster === "ghost";
  if (t - s.petAt < PET) {
    const p2 = (t - s.petAt) / PET;
    if (s.fuss === "purr") m.dx = Math.sin(t * 1.5) * 1.2 * (1 - p2);
    if (s.fuss === "wiggle") {
      m.dx = Math.sin(t * 1.5) * 2 * (1 - p2);
      m.lift = Math.abs(Math.sin(p2 * Math.PI * 2)) * r0 * 0.18;
    }
    if (s.fuss === "spin") {
      const q = clamp(p2 / 0.6);
      const turn = Math.cos(q * Math.PI * 2);
      m.sx = Math.max(0.25, Math.abs(turn));
      m.back = turn < 0;
      m.lift = Math.sin(Math.PI * q) * r0 * 0.4;
    }
    if (s.fuss === "stir") m.dx = p2 < 0.6 ? Math.sin(t * 0.9) * 0.8 : 0;
    if (s.fuss === "plead") m.lift = Math.abs(Math.sin(t * 0.45)) * 0.8;
    return m;
  }
  if (t - s.greetAt < GREET) {
    const p2 = (t - s.greetAt) / GREET;
    m.lift = p2 < 0.4 ? Math.sin(Math.PI * p2 / 0.4) * r0 * 0.25 : 0;
    if (ghost) m.dx = Math.sin(t * 0.9) * 2;
    return m;
  }
  const a = s.antic;
  if (a === null) return m;
  const p = progress(s);
  if (a.kind === "stretch") {
    const k = swell(p, 0.25, 0.25);
    m.sy = 1 + 0.16 * k;
    m.sx = 1 - 0.08 * k;
    if (p > 0.8) m.dx = Math.sin(t * 2.2) * 0.8;
  }
  if (a.kind === "look") {
    m.dx = p < 0.1 ? 0 : p < 0.32 ? -1 : p < 0.56 ? 1 : 0;
    m.lift = p >= 0.62 ? Math.sin(clamp((p - 0.62) / 0.3) * Math.PI) * 1.6 : 0;
  }
  if (a.kind === "wave" && ghost) {
    m.dx = Math.sin(t * 0.9) * 2;
    m.lift = Math.abs(Math.sin(t * 0.45)) * 1.5;
  }
  if (a.kind === "scratch") m.dx = swell(p, 0.15, 0.15);
  if (a.kind === "chase") {
    m.lift = p < 0.56 ? Math.abs(Math.sin(p * Math.PI * 6)) * r0 * 0.12 : p < 0.74 ? Math.sin((p - 0.56) / 0.18 * Math.PI) * r0 * 0.3 : 0;
  }
  if (a.kind === "hop") m.lift = Math.abs(Math.sin(p * Math.PI * 3)) * r0 * 0.3;
  if (a.kind === "peek") {
    const k = swell(p, 0.15, 0.2);
    m.sy = 1 - 0.07 * k;
    m.sx = 1 + 0.04 * k;
    if (p >= 0.8) m.lift = Math.abs(Math.sin((p - 0.8) / 0.2 * Math.PI * 2)) * 1.2;
  }
  if (a.kind === "star" && hash(a.at, 4) < 0.7 && p > 0.62 && p < 0.86) m.lift = Math.sin((p - 0.62) / 0.24 * Math.PI) * r0 * 0.25;
  if (a.kind === "juggle" && p > 0.9) m.lift = Math.sin((p - 0.9) / 0.1 * Math.PI) * 1.2;
  return m;
};
const prop = (s, f, p = progress(s)) => {
  const a = s.antic;
  if (a === null) return null;
  const side = a.seed < 0.5 ? -1 : 1;
  if (a.kind === "chase") {
    const away = clamp((p - 0.66) / 0.34);
    const y0 = f.rest - f.ry * 0.9;
    return {
      x: f.home + side * f.rx * 1.3 * Math.cos(Math.PI * 2 * 1.15 * Math.min(p, 0.66)) + side * away * f.rx * 2.5,
      y: y0 + Math.sin(Math.PI * 2 * 2.3 * p) * f.ry * 0.3 - away * away * (y0 + 6)
    };
  }
  if (a.kind === "star") {
    const { aim, caught, start } = falling(s, f);
    const land = caught ? aim : aim - side * (f.rx + 3);
    const q = clamp((p - 0.12) / (caught ? 0.48 : 0.6));
    if (caught && p >= 0.6 || p >= 0.72) return null;
    return {
      x: ease(start, land, q),
      y: ease(2, caught ? f.rest + f.ry * 0.34 : f.floor - 1, q ** 1.4)
    };
  }
  if (a.kind === "juggle") {
    const head = { x: f.cx, y: f.cy - f.ry - 1.5 };
    const [left, right] = f.monster === "ghost" ? [head, head] : [-1, 1].map((side2) => ({ x: f.cx + side2 * f.rx * 0.95, y: f.cy + f.ry * 0.15 }));
    const arc = (from, to, u, height) => ({
      x: ease(from.x, to.x, u),
      y: ease(from.y, to.y, u) - 4 * height * u * (1 - u)
    });
    if (p < 0.72) {
      const q = p / 0.72 * 3;
      const k = Math.floor(q);
      return arc(k % 2 === 0 ? left : right, k % 2 === 0 ? right : left, q - k, f.monster === "ghost" ? 5 : f.ry * 1.3 + 2);
    }
    return p < 0.9 ? arc(right, f.mouth, (p - 0.72) / 0.18, f.ry * 1.4 + 4) : null;
  }
  return null;
};
const falling = (s, f) => {
  const a = s.antic;
  const side = a.seed < 0.5 ? -1 : 1;
  const aim = f.home + (hash(a.at, 3) - 0.5) * f.rx * 1.2;
  return { aim, caught: hash(a.at, 4) < 0.7, start: aim + side * f.home * 0.7 };
};
const feel = (s, f, a) => {
  const p = progress(s);
  if (a.kind === "stretch") return p < 0.78 ? ["closed", "none", 1, 0.55, 0.3, 0.2] : ["happy", "none", 0, 0, 0.8, 0.4];
  if (a.kind === "scratch") return ["open", "none", 0.5, 0, 0.7, 0.3];
  if (a.kind === "look") return p < 0.6 ? ["open", "none", 0, 0, 0.1, 0] : ["open", "sad", 0, 0, -0.05, 0];
  if (a.kind === "wave" || a.kind === "hop") return ["happy", "none", 0, 0.35, 1, 0.5];
  if (a.kind === "chase") {
    if (p < 0.6) return ["open", "none", 0, 0.2, 0.6, 0.3];
    if (p < 0.74) return ["open", "fierce", 0, 0.5, 0.4, 0.3];
    return p < 0.88 ? ["open", "none", 0, 0.3, 0.3, 0.2] : ["happy", "none", 0, 0, 0.9, 0.4];
  }
  if (a.kind === "juggle") {
    if (p < 0.78) return ["open", "none", 0, 0.1, 0.7, 0.3];
    if (p < 0.9) return ["open", "none", 0, 0.8, 0.5, 0.3];
    return ["happy", "none", 0, Math.abs(Math.sin(f.t * 0.8)) * 0.4, 1, 0.7];
  }
  if (a.kind === "peek") return p < 0.8 ? ["open", "none", 0, 0.15, 0, 0] : ["happy", "none", 0, 0, 0.8, 0.3];
  const { caught } = falling(s, f);
  if (p < 0.12) return ["open", "none", 0, 0, 0.4, 0];
  if (p < 0.35) return ["open", "none", 0, 0.2, 0.5, 0.2];
  if (p < 0.6) return ["open", "none", 0, 0.9, 0.4, 0.3];
  if (caught) return ["happy", "none", 0, 0, 1, 1];
  return p < 0.72 ? ["open", "none", 0, 0.5, 0.2, 0] : ["open", "sad", 0.2, 0, -0.6, 0];
};
const glance = (s, f) => {
  if (f.calling) return { x: 0, y: 0 };
  if (f.petting) return s.fuss === "plead" ? { x: 0, y: -0.7 } : null;
  if (f.greeting) return { x: 0, y: 0 };
  const a = s.antic;
  if (a === null) return null;
  const p = progress(s);
  const thing = prop(s, f);
  if (thing !== null) {
    const [dx, dy] = [thing.x - f.cx, thing.y - (f.cy - f.ry * 0.4)];
    const d = Math.max(1, Math.hypot(dx, dy));
    return { x: dx / d, y: dy / d };
  }
  if (a.kind === "look") return p < 0.1 ? { x: 0, y: 0 } : p < 0.32 ? { x: -0.95, y: 0.1 } : p < 0.56 ? { x: 0.95, y: 0.1 } : { x: 0, y: 0 };
  if (a.kind === "scratch") return { x: 0.8, y: 0.6 };
  if (a.kind === "peek") return p < 0.8 ? { x: Math.sin(p * Math.PI * 5) * 0.8, y: 1 } : { x: 0, y: 0.3 };
  if (a.kind === "chase") return { x: (a.seed < 0.5 ? -1 : 1) * 0.6, y: -0.9 };
  if (a.kind === "star") return falling(s, f).caught ? { x: 0, y: 0 } : { x: (a.seed < 0.5 ? 1 : -1) * 0.7, y: 0.9 };
  return null;
};
const pose = (s, f, side, ax, ay, length, rest) => {
  const { t } = f;
  const up = { x: ax + side * length * 0.6, y: ay - length * 1.1 };
  const wave = { x: ax + side * length * 0.55 + Math.sin(t * 1.1) * length * 0.45, y: ay - length * 1.05 };
  if (f.petting) {
    const p2 = (t - s.petAt) / PET;
    if (s.fuss === "plead") return { x: f.mouth.x + side * 1.5, y: f.mouth.y + 2.5 };
    if (s.fuss === "stir") return null;
    if (s.fuss === "spin") return p2 < 0.6 ? { x: ax + side * length * 0.9, y: ay - length * 0.2 } : up;
    return { x: f.cx + side * f.rx * 0.8, y: f.cy + f.ry * 0.2 };
  }
  if (f.greeting) return side === -1 ? wave : null;
  const a = s.antic;
  if (a === null) return null;
  const p = progress(s);
  if (a.kind === "stretch") {
    const k = swell(p, 0.25, 0.25);
    return { x: ax + side * length * (0.6 - 0.25 * k), y: ay - length * (0.2 + 1.2 * k) };
  }
  if (a.kind === "scratch") {
    return side === 1 ? { x: f.cx + f.rx * 0.78, y: f.cy + f.ry * 0.2 + Math.sin(t * 1.6) * 2 } : null;
  }
  if (a.kind === "look") return p >= 0.6 ? { x: ax + side * length * 0.95, y: ay - length * 0.15 } : null;
  if (a.kind === "wave") return side === -1 ? wave : null;
  if (a.kind === "hop") return { x: ax + side * length * 0.8, y: ay - length * 0.6 };
  if (a.kind === "peek") return { x: f.cx + side * f.rx * 0.5, y: f.cy + f.ry * 0.8 };
  if (a.kind === "chase") {
    const clap = prop(s, f, 0.66);
    const k = p < 0.54 ? 0 : p < 0.64 ? (p - 0.54) / 0.1 : p < 0.78 ? 1 : 1 - (p - 0.78) / 0.12;
    return k <= 0 ? null : { x: ease(rest.x, clap.x + side * 1.3, k), y: ease(rest.y, clap.y, k) };
  }
  if (a.kind === "juggle") {
    const thing = prop(s, f);
    const base = { x: f.cx + side * f.rx * 0.95, y: f.cy + f.ry * 0.15 };
    const near = thing === null ? 0 : clamp(1 - Math.hypot(thing.x - base.x, thing.y - base.y) / 5);
    return p < 0.92 ? { x: base.x, y: base.y + 1 - near * 2 } : { x: f.cx + side * f.rx * 0.35, y: f.cy + f.ry * 0.55 };
  }
  if (p < 0.3) return null;
  if (p < 0.62) return up;
  if (falling(s, f).caught) return { x: f.cx + side * f.rx * 0.35, y: f.cy + f.ry * (0.55 + (t % 6 < 3 ? 0.05 : 0)) };
  return null;
};
const live = (s, f) => {
  const a = s.antic;
  if (!calm(s, f)) {
    s.antic = null;
    s.anticAt = -1;
  } else if (a !== null && s.tick - a.at >= a.len) {
    s.antic = null;
    s.anticAt = s.tick + LULL + random() * LULL_MORE;
  } else if (a === null && s.anticAt < 0) {
    s.anticAt = s.tick + LULL + random() * LULL_MORE;
  } else if (a === null && s.tick >= s.anticAt && s.tick - s.activeAt + 40 < DOZE - YAWN) {
    const kind = choose(s, f);
    s.antic = { kind, at: s.tick, len: ANTICS[kind].len, seed: random() };
    s.lastAntic = kind;
  }
  const now = s.antic;
  const p = progress(s);
  const room = Math.max(0, f.home - f.rx - 2);
  let target = 0;
  if (now?.kind === "chase" && p < 0.62) target = ((prop(s, f)?.x ?? f.home) - f.home) * 0.45;
  if (now?.kind === "star" && p > 0.1 && p < 0.85) target = falling(s, f).aim - f.home;
  s.shift = ease(s.shift, clamp(target, -room, room), 0.15);
  if (target === 0 && Math.abs(s.shift) < 0.05) s.shift = 0;
  const sparkle = (x, y, n, color) => {
    for (let i = 0; i < n; i++) {
      const angle = i / n * Math.PI * 2;
      s.bits.push({ kind: "spark", x, y, vx: Math.cos(angle) * 0.45, vy: Math.sin(angle) * 0.45 - 0.1, life: 16, max: 16, color });
    }
  };
  const heart = (x, y, vx, vy, life = 28) => s.bits.push({ kind: "heart", x, y, vx, vy, life, max: life, color: HEART });
  if (now !== null) {
    const e = s.tick - now.at;
    const at = (q) => e === Math.round(now.len * q);
    if (now.kind === "star" && falling(s, f).caught && at(0.6)) {
      sparkle(f.mouth.x, f.mouth.y - 1, 10, GOLD_LIGHT);
      s.squashV += 0.1;
    }
    if (now.kind === "star" && !falling(s, f).caught && at(0.72)) {
      s.bits.push({ kind: "puff", x: f.home + (falling(s, f).aim - f.home) - (now.seed < 0.5 ? -1 : 1) * (f.rx + 3), y: f.floor - 2, vx: 0, vy: -0.2, life: 18, max: 18, color: 16773552 });
    }
    if (now.kind === "chase" && at(0.66)) {
      const clap = prop(s, f, 0.66);
      sparkle(clap.x, clap.y, 4, WHITE);
    }
    if (now.kind === "juggle" && at(0.9)) {
      s.squashV += 0.08;
      for (let i = 0; i < 5; i++) {
        s.bits.push({ kind: "crumb", x: f.mouth.x, y: f.mouth.y, vx: (random() - 0.5) * 1.2, vy: -0.4 - random() * 0.6, life: 22, max: 22, color: GOLD });
      }
    }
    if (now.kind === "hop" && (at(1 / 3) || at(2 / 3))) s.squashV += 0.1;
    if (now.kind === "scratch" && e % 7 === 3 && f.monster !== "ghost") {
      s.bits.push({ kind: "crumb", x: f.cx + f.rx * 0.95, y: f.cy + f.ry * 0.3, vx: 0.3 + random() * 0.4, vy: -0.5, life: 16, max: 16, color: mix(f.body, WHITE, 0.45) });
    }
  }
  const since = s.tick - s.petAt;
  if (since >= 1 && since < PET) {
    const top = f.cy - f.ry * (f.monster === "cookie" ? 1.3 : 1) - 2;
    const above = () => [f.cx + (random() - 0.5) * f.rx * 1.2, top];
    if ((s.fuss === "purr" || s.fuss === "wiggle") && (since === 1 || since % 7 === 0)) heart(...above(), (random() - 0.5) * 0.3, -0.3);
    if (s.fuss === "wiggle" && since === 1) heart(...above(), (random() - 0.5) * 0.5, -0.4);
    if (s.fuss === "stir" && since === 4) heart(f.cx - f.rx * 0.5, top, -0.1, -0.2, 22);
    if (s.fuss === "spin" && since === Math.round(PET * 0.6)) {
      s.squashV += 0.12;
      for (let i = 0; i < 6; i++) {
        const angle = i / 6 * Math.PI * 2 - Math.PI / 2;
        heart(f.cx + Math.cos(angle) * (f.rx + 3), f.cy + Math.sin(angle) * (f.ry + 2), Math.cos(angle) * 1.1, Math.sin(angle) * 0.7);
      }
    }
    if (s.fuss === "plead" && since === 8 && f.monster !== "slime") {
      s.bits.push({ kind: "tear", x: f.cx - f.rx * 0.45, y: f.cy - f.ry * 0.1, vx: 0, vy: 0.2, life: 16, max: 16, color: 7259903 });
    }
  }
};
const antics = (c, s, f) => {
  const a = s.antic;
  if (a === null) return;
  const p = progress(s);
  const thing = prop(s, f);
  if (a.kind === "look" && p >= 0.62 && p < 0.97) write(c, "?", f.cx + f.rx * 0.75, f.cy - f.ry - 5, 1, WHITE, 13160672);
  if (a.kind === "star" && thing === null && falling(s, f).caught && p >= 0.6) {
    const fade = 1 - (p - 0.6) / 0.4;
    for (let i = 0; i < 5; i++) {
      const angle = i / 5 * Math.PI * 2 + f.t * 0.15;
      if (hash(i, f.t >> 1) < 0.75) c.add(f.cx + Math.cos(angle) * (f.rx + 2), f.cy + Math.sin(angle) * (f.ry + 2), GOLD_LIGHT, fade);
    }
  }
  if (thing === null) return;
  const { x, y } = thing;
  if (a.kind === "chase" && daylight(s.hour) < 0.4) {
    const glow2 = 0.6 + 0.4 * Math.sin(f.t * 0.5);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = Math.hypot(dx, dy);
        if (d <= 2.3) c.add(x + dx, y + dy, 14221178, (d < 1.2 ? 0.6 : 0.25) * glow2);
      }
    }
    c.put(x, y, 16056264);
  } else if (a.kind === "chase") {
    const open = (f.t >> 1) % 2 === 0;
    const wings = open ? [[-2, -1], [-1, -1], [-1, 0], [1, -1], [2, -1], [1, 0]] : [[-1, -1], [1, -1]];
    for (const [dx, dy] of wings) c.put(x + dx, y + dy, Math.abs(dx) === 2 ? 16769126 : 16747069);
    c.put(x, y - 1, INK);
    c.put(x, y, INK);
  } else if (a.kind === "star") {
    if (p < 0.12) {
      const r = 1 + Math.round(p / 0.12 * 1.5);
      for (let k = -r; k <= r; k++) {
        c.add(x + k, y, 16774848, 1 - Math.abs(k) / (r + 1));
        c.add(x, y + k, 16774848, 1 - Math.abs(k) / (r + 1));
      }
    } else {
      const before = prop(s, f, p - 0.06) ?? thing;
      const [dx, dy] = [x - before.x, y - before.y];
      for (let k = 1; k <= 5; k++) c.add(x - dx * k / 3, y - dy * k / 3, 16771488, 0.7 - k * 0.12);
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.put(x + ox, y + oy, GOLD_LIGHT);
      c.put(x, y, WHITE);
    }
  } else if (a.kind === "juggle") {
    const w = Math.max(0.5, Math.abs(Math.cos(f.t * 0.6)) * 1.6);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = (dx / w) ** 2 + (dy / 1.7) ** 2;
        if (d <= 1) c.put(x + dx, y + dy, d > 0.55 ? GOLD_DARK : dx < 0 && dy < 0 ? GOLD_LIGHT : GOLD);
      }
    }
  }
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
  if (s.level > s.lastLevel) s.flashAt = s.tick;
  s.lastLevel = s.level;
  s.power += ((s.level > 0 ? 1 : 0) - s.power) * 0.08;
  const goal = s.level > 0 ? clamp((s.heat - 0.8) / 0.2) * clamp(0.4 + s.level * 0.2 + (s.combo >= 3 ? 0.15 : 0)) : 0;
  s.frenzy += (goal - s.frenzy) * (goal > s.frenzy ? 0.15 : 0.04);
  if (s.tick - s.cheerAt === HOP) s.squashV += 0.14;
  const grown = s.tick - s.rankUpAt;
  if (grown === 1) s.squashV += 0.2;
  if (grown === 4) s.squashV -= 0.3;
  if (grown === 18) s.squashV += 0.3;
  s.squashV = (s.squashV + (0 - s.squash) * 0.35) * 0.7;
  s.squash = clamp(s.squash + s.squashV, -0.35, 0.35);
  const f = shape(s, width, height);
  live(s, f);
  const face2 = mood(s, f);
  const quick = face2.eyes === "open" && f.eating ? 0.6 : 0.25;
  s.lid = ease(s.lid, face2.lid, 0.25);
  s.open = ease(s.open, face2.open, quick);
  s.smile = ease(s.smile, face2.smile, 0.2);
  s.blush = ease(s.blush, face2.blush, 0.1);
  const looking = s.tick - s.typedAt < 15 || s.tick - s.perkAt < PERK ? { x: 0, y: 0.9 } : glance(s, f) ?? s.gazeTo;
  s.gaze = { x: ease(s.gaze.x, looking.x, 0.35), y: ease(s.gaze.y, looking.y, 0.35) };
  s.googlyV = {
    x: (s.googlyV.x + (s.gaze.x - s.googly.x) * 0.25) * 0.72,
    y: (s.googlyV.y + (s.gaze.y + 0.25 - s.googly.y) * 0.25 + s.squashV * 3) * 0.72
  };
  s.googly = { x: clamp(s.googly.x + s.googlyV.x, -1, 1), y: clamp(s.googly.y + s.googlyV.y, -1, 1) };
  for (let budget = 1 + Math.round(s.heat * 5 + s.frenzy * 24); budget > 0 && s.servings.length > 0; budget--) {
    const serving = s.servings[0];
    const bite = Math.max(25, serving.tokens / 40) / (1 + s.frenzy * 4);
    const edge = random();
    const [x, y] = serving.color === PROMPT ? [random() * width, height - 1] : s.frenzy > 0.2 && edge < s.frenzy * 0.5 ? [random() * width, edge < s.frenzy * 0.25 ? 0 : height - 1] : [random() < 0.5 ? 0 : width - 1, 2 + random() * (f.floor - 6)];
    s.motes.push({ x, y, px: x, py: y, color: serving.color });
    serving.tokens -= bite;
    if (serving.tokens <= 0) s.servings.shift();
  }
  const speed = 1.2 + s.heat * 2.2 + s.power + s.frenzy * 2;
  const { mouth: mouth2 } = f;
  let bites = 0;
  s.motes = s.motes.slice(-(120 + Math.round(s.frenzy * 320))).filter((mote) => {
    const [dx, dy] = [mouth2.x - mote.x, mouth2.y - mote.y];
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) {
      bites += 1;
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
    const swirl = dist > 4 ? s.frenzy * 0.9 : 0;
    mote.x += dx / dist * Math.min(dist, speed) - dy / dist * speed * swirl;
    mote.y += dy / dist * Math.min(dist, speed) + dx / dist * speed * swirl;
    return true;
  });
  s.squashV += Math.min(0.045, bites * 0.015);
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
  if (grown >= 0 && grown < 32 && random() < 0.75) {
    s.bits.push({
      kind: "spark",
      x: f.cx + (random() - 0.5) * f.r0 * 1.6,
      y: f.floor - random() * 4,
      vx: 0,
      vy: -0.8 - random() * 0.9,
      life: 18 + random() * 10,
      max: 28,
      color: random() < 0.5 ? GOLD_LIGHT : WHITE
    });
  }
  for (let i = 0; grown === 18 && i < 16; i++) {
    const angle = i / 16 * Math.PI * 2;
    s.bits.push({
      kind: "spark",
      x: f.cx + Math.cos(angle) * f.rx,
      y: f.cy + Math.sin(angle) * f.ry,
      vx: Math.cos(angle) * (0.9 + i % 2 * 0.5),
      vy: Math.sin(angle) * (0.7 + i % 2 * 0.4) - 0.2,
      life: 24,
      max: 24,
      color: RAINBOW[i % RAINBOW.length]
    });
  }
  if (f.egg === EGG_CRACK || f.egg === EGG) {
    const g = eggOf(f);
    const top = f.egg === EGG_CRACK;
    if (top) {
      s.flashAt = s.tick;
      s.cheerAt = s.tick;
      s.squash = -0.3;
    }
    for (let i = 0; i < (top ? 12 : 6); i++) {
      const angle = top ? -Math.PI * (i / 11) : Math.PI * (i / 5);
      const side = Math.cos(angle);
      s.bits.push({
        kind: "shell",
        x: g.x + side * g.rx * 0.9,
        y: top ? g.y + Math.sin(angle) * g.ry * 0.7 : f.floor - 2,
        vx: side * (0.5 + random() * 0.7),
        vy: top ? -1 - random() * 1.1 : -0.5 - random() * 0.6,
        life: 16 + random() * 10,
        max: 26,
        color: i % 2 === 0 ? 16183783 : g.color
      });
    }
  }
  for (let i = 0; s.frenzy > 0.4 && i < 2 && random() < s.frenzy; i++) {
    s.bits.push({
      kind: "crumb",
      x: f.cx + (random() - 0.5) * f.rx * 3,
      y: f.floor - 1,
      vx: (random() - 0.5) * 1.6,
      vy: -1 - random() * 1.6 * s.frenzy,
      life: 24,
      max: 24,
      color: random() < 0.5 ? mix(4165455, 1780287, 1 - daylight(s.hour)) : 9071178
    });
  }
  const night = 1 - daylight(s.hour);
  if (night > 0.6 && !s.busy && s.bits.filter((bit) => bit.kind === "firefly").length < 3 && random() < 0.02) {
    s.bits.push({ kind: "firefly", x: random() * width, y: f.floor - 2 - random() * 8, vx: 0, vy: 0, life: 120, max: 120, color: 14221178 });
  }
  s.bits = s.bits.slice(-160).filter((bit) => {
    bit.life -= 1;
    if (bit.kind === "crumb" || bit.kind === "confetti" || bit.kind === "tear" || bit.kind === "drool" || bit.kind === "shell") {
      bit.vy += bit.kind === "confetti" ? 0.01 : 0.12;
      if (bit.kind === "confetti") bit.vx = Math.sin((bit.life + bit.color) * 0.3) * 0.3;
      if (bit.y + bit.vy >= f.floor && (bit.kind === "crumb" || bit.kind === "shell")) {
        bit.vy *= -0.4;
        bit.vx *= 0.6;
      }
    }
    if (bit.kind === "ember") {
      bit.vy -= 0.02;
      bit.vx += (random() - 0.5) * 0.2;
    }
    if (bit.kind === "heart") {
      bit.vx = bit.vx * 0.9 + Math.sin(bit.life * 0.3) * 0.04;
      bit.vy = ease(bit.vy, -0.28, 0.08);
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
  const flash2 = t - flashAt;
  if (flash2 >= 0 && flash2 < 10) {
    const r = 3 + flash2 * 3;
    for (let a = 0; a < 64; a++) {
      const angle = a / 64 * Math.PI * 2;
      c.add(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.8, 16777215, 1 - flash2 / 10);
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
    const lap = f.frenzy > 0.5;
    const orbit = t * 0.35 + i * Math.PI / 2;
    if (lap) {
      x = cx + Math.cos(orbit) * (rx + 7);
      toss = -1;
    }
    const running = lap || p >= 0.5 && p < 0.65 || p >= 0.75;
    const beat = Math.sin(t * 0.6);
    const hop = running ? Math.abs(Math.sin(t * 1.3 + i)) * 1.5 : Math.abs(beat) * 2.5;
    const float = monster === "ghost" ? 2 + Math.sin(t * 0.2 + i) : 0;
    const y = floor - 3 - hop - float - (lap ? Math.max(0, Math.sin(orbit)) * 3 : 0);
    const color = mix(HELPERS[i], GOLD, power * 0.3);
    const squash = hop < 0.4 && !running ? 0.15 : 0;
    const facing = running ? p < 0.65 ? -side : side : 0;
    const mini = (nx, ny) => {
      const d = Math.hypot(nx, ny);
      if (monster === "slime") return d < 1 && ny < 0.8;
      if (monster === "ghost") return ny < 0 ? d < 1 : Math.abs(nx) < 1 && ny < 1 + 0.25 * Math.sin(nx * 6 + t * 0.6);
      if (monster === "cookie") return d < 1 + 0.12 * Math.sin(Math.atan2(ny, nx) * 9);
      if (monster === "crab") return d < 1 && ny > -0.55;
      return d < 1;
    };
    c.blob(x, y, 3.2 * (1 + squash), 2.9 * (1 - squash), color, mini);
    if (monster === "gremlin") {
      c.put(x - 2, y - 3.5, 15392712);
      c.put(x + 2, y - 3.5, 15392712);
    }
    if (monster === "crab") {
      for (const side2 of [-1, 1]) {
        c.put(x + side2 * 4, y - 2, mix(color, INK, 0.2));
        c.put(x + side2 * 4.5, y - 3, mix(color, INK, 0.2));
        c.put(x + side2 * 3.5, y - 3, mix(color, INK, 0.2));
        c.put(x + side2 * 3, y + 2.5, mix(color, INK, 0.4));
      }
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
  const reach = thick * 3.8;
  if (feet > 0 && monster !== "crab") {
    for (const side of [-1, 1]) {
      const tap = f.thinking && side === 1 && t % 10 < 3 ? 1 : 0;
      const fx = cx + side * rx * 0.42;
      const fy = Math.min(floor - 1, cy + ry + feet * 0.6) - tap;
      c.blob(fx, fy, rx * 0.26, feet * 1.1, mix(body, BLACK, 0.15), (nx, ny) => nx * nx + ny * ny < 1);
    }
  }
  if (monster === "ghost") return;
  const crab = monster === "crab";
  for (const side of [-1, 1]) {
    const [ax, ay] = [cx + side * rx * (crab ? 0.9 : 0.86), cy + ry * (crab ? -0.1 : 0.1)];
    const rest = crab ? { x: ax + side * length * 0.7, y: ay - length * 0.75 + Math.sin(f.wave + side) * 0.5 } : { x: ax + side * length * 0.45, y: ay + length * 0.8 + Math.sin(f.wave + side) * 0.5 };
    const mouthSpot = { x: f.mouth.x + side * rx * 0.35, y: f.mouth.y + 1 };
    const up = { x: ax + side * length * 0.7, y: ay - length * 1.05 + Math.sin(t * 0.8 + side) * 0.8 };
    const posed = pose(s, f, side, ax, ay, length, rest);
    let hand = rest;
    if (f.calling) {
      hand = { x: ax + side * length * (0.6 + 0.35 * Math.sin(t * 0.9 + side)), y: ay - length * 1.1 };
    } else if (f.cheering || f.leveling || s.finish?.text === "K.O." && t - s.finish.at < 30) hand = up;
    else if (f.frenzy > 0.5) {
      const whirl = t * 1.9 + (side > 0 ? Math.PI : 0);
      hand = { x: ax + side * length * (0.55 + 0.45 * Math.cos(whirl)), y: ay - length * 0.9 * Math.sin(whirl * 1.3) };
    } else if (f.power > 0.5) hand = { x: ax + side * length * 0.75, y: ay + length * 0.45 + (hash(t, side) - 0.5) };
    else if (f.eating) {
      const scoop = Math.max(0, Math.sin(s.chew * 0.5 + (side > 0 ? Math.PI : 0)));
      hand = { x: ease(rest.x, mouthSpot.x, scoop), y: ease(rest.y, mouthSpot.y, scoop) };
    } else if (posed !== null) hand = posed;
    else if (f.typing || f.perking) {
      const rub = Math.sin(t * 1.2) * side * 0.8;
      hand = { x: cx + side * rx * 0.25 + rub, y: cy + ry * 0.6 };
    } else if (f.thinking && side === 1) hand = { x: f.mouth.x + rx * 0.3, y: f.mouth.y + ry * 0.28 };
    else if (f.sleeping) hand = { x: ax + side * length * 0.2, y: ay + length * 0.7 };
    if (crab) {
      hand = {
        x: side > 0 ? Math.min(hand.x, c.width - 1 - reach) : Math.max(hand.x, reach),
        y: Math.max(hand.y, reach)
      };
    }
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
    if (crab) {
      const gape = f.eating ? Math.abs(Math.sin(s.chew)) : f.cheering ? 1 : 0.45 + 0.15 * Math.sin(t * 0.1 + side);
      claw(c, hand.x, hand.y, side, gape, thick, reach, arm);
    } else {
      c.blob(hand.x, hand.y, thick * 1.35, thick * 1.35, mix(arm, WHITE, 0.08), (nx, ny) => nx * nx + ny * ny < 1);
    }
  }
};
const claw = (c, x, y, side, gape, thick, reach, color) => {
  const toward = side > 0 ? -Math.PI / 3 : -2 * Math.PI / 3;
  c.blob(x, y, thick * 1.6, thick * 1.4, mix(color, WHITE, 0.08), (nx, ny) => nx * nx + ny * ny < 1);
  for (const [jaw, width] of [[-1, 0.62], [1, 0.45]]) {
    const angle = toward + jaw * side * (0.3 + gape * 0.5);
    for (let k = 0; k <= 8; k++) {
      const p = k / 8;
      const bend = angle - jaw * side * p * p * 0.3;
      const [jx, jy] = [x + Math.cos(bend) * reach * p, y + Math.sin(bend) * reach * p];
      c.disc(jx, jy, thick * width * (1 - p * 0.6) + 0.35, mix(color, INK, 0.55));
      c.disc(jx, jy, thick * width * (1 - p * 0.6), p > 0.8 ? mix(color, WHITE, 0.3) : mix(color, WHITE, 0.08));
    }
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
  if (monster === "crab") {
    const leg = mix(body, BLACK, 0.18);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const step2 = Math.sin(wave * 2.4 + k * 2.1 + (side > 0 ? 1 : 0)) * (f.eating ? 1.2 : 0.8);
        const [ax, ay] = [cx + side * rx * (0.82 - k * 0.12), cy + ry * (0.15 + k * 0.28)];
        const [kx, ky] = [ax + side * rx * (0.32 + k * 0.06), ay - ry * (0.3 - k * 0.12) + step2 * 0.3];
        const [fx, fy] = [kx + side * rx * (0.16 + k * 0.05) + step2, cy + ry + f.feet - 1];
        for (const [x0, y0, x1, y1] of [[ax, ay, kx, ky], [kx, ky, fx, fy]]) {
          for (let p = 0; p <= 1; p += 0.08) c.put(ease(x0, x1, p), ease(y0, y1, p), leg);
        }
      }
    }
  }
  const shapeOf = (nx, ny) => {
    const angle = Math.atan2(ny, nx);
    const d = Math.hypot(nx, ny);
    if (monster === "crab") return d < 1 + (ny < 0 ? 0.12 * Math.max(0, Math.cos(nx * 7.5)) * -ny : 0);
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
    belly: monster === "cookie" || monster === "gremlin" || monster === "crab"
  });
  if (monster === "crab") {
    for (let i = 0; i < 5; i++) {
      const [x, y] = [cx + (hash(i, 31) - 0.5) * rx * 1.3, cy - ry * (0.2 + hash(i, 32) * 0.5)];
      c.put(x, y, mix(body, WHITE, 0.35));
    }
  }
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
const eye = (c, x, y, r, look, lid, f, iris, big = false) => {
  const superEyes = f.power > 0.5;
  const sclera = f.monster === "ghost" ? 1708080 : f.monster === "gremlin" && !superEyes ? 16769357 : WHITE;
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      c.put(x + dx, y + dy, d > r - 0.7 ? mix(sclera, INK, 0.55) : dy < -r * 0.45 ? mix(sclera, 9081008, 0.25) : sclera);
    }
  }
  const ir = r * (f.monster === "cookie" ? 0.58 : 0.62) * (big ? 1.2 : 1);
  const [ix, iy] = [x + look.x * Math.max(0, r - ir - 0.4), y + look.y * Math.max(0, r - ir - 0.4)];
  if (big) {
    c.disc(ix, iy, ir, f.monster === "ghost" ? 9412607 : INK);
    c.disc(ix - ir * 0.35, iy - ir * 0.35, Math.max(0.7, ir * 0.38), WHITE);
    c.put(ix + ir * 0.4, iy + ir * 0.35, WHITE);
    for (let dx = -ir * 0.6; dx <= ir * 0.6; dx += 0.5) c.put(ix + dx, iy + ir * 0.75, 10475775, 0.7);
  } else if (f.monster === "gremlin" && !superEyes) {
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
  const eyes = monster === "slime" ? [[cx, cy - ry * 0.28, 0]] : monster === "crab" ? [[cx - rx * 0.3, cy - ry * 1.45, -1], [cx + rx * 0.3, cy - ry * 1.45, 1]] : monster === "cookie" ? [[cx - rx * 0.32, cy - ry * 0.8, -1], [cx + rx * 0.32, cy - ry * 0.8, 1]] : [[cx - rx * 0.34, cy - ry * 0.22, -1], [cx + rx * 0.34, cy - ry * 0.22, 1]];
  const re = eyeSize(f);
  const look = monster === "cookie" ? s.googly : s.gaze;
  const lid = m.eyes === "open" ? Math.max(s.lid, f.blink ? 1 : 0) : 0;
  const iris = { cookie: INK, slime: 1989170, ghost: 9412607, gremlin: INK, crab: INK }[monster] ?? 6961951;
  if (monster === "crab") {
    for (const [ex, ey] of eyes) {
      for (let y = ey; y <= cy - ry * 0.75; y += 0.5) {
        c.put(ex - 0.6, y, mix(body, INK, 0.5));
        c.put(ex + 0.6, y, mix(body, INK, 0.5));
        c.put(ex, y, mix(body, BLACK, 0.1));
      }
    }
  }
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
      if (monster === "cookie" || monster === "crab") {
        if (m.eyes === "happy") c.disc(ex, ey, re, WHITE);
        else {
          c.disc(ex, ey, re, mix(body, INK, 0.6));
          c.disc(ex, ey, re - 0.7, mix(body, WHITE, 0.15));
        }
      }
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
      eye(c, ex, ey, re, look, lid, f, iris, m.eyes === "plead");
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
    } else if (bit.kind === "heart") {
      const rows = bit.max >= 24 && fade > 0.35 ? [".X.X.", "XXXXX", ".XXX.", "..X.."] : ["X.X", "XXX", ".X."];
      const [x0, y0] = [Math.round(bit.x) - (rows[0].length >> 1), Math.round(bit.y) - 1];
      rows.forEach(
        (row, dy) => [...row].forEach((cell, dx) => {
          if (cell !== "X") return;
          const tone = dy === 0 || dy === 1 && dx === 1 ? mix(bit.color, WHITE, 0.45) : dy === rows.length - 1 ? mix(bit.color, BLACK, 0.25) : bit.color;
          c.put(x0 + dx, y0 + dy, tone, Math.min(1, fade * 2.5));
        })
      );
    } else {
      c.put(bit.x, bit.y, bit.color, bit.kind === "crumb" ? Math.min(1, fade * 2) : 1);
      if (bit.kind === "shell") {
        c.put(bit.x + 1, bit.y, mix(bit.color, BLACK, 0.25));
        c.put(bit.x, bit.y + 1, mix(bit.color, BLACK, 0.4));
      }
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
  L: [4, 4, 4, 4, 7],
  P: [7, 5, 7, 4, 4],
  V: [5, 5, 5, 5, 2],
  v: [0, 0, 5, 5, 2],
  E: [7, 4, 7, 4, 7],
  K: [5, 5, 6, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [7, 5, 5, 5, 7],
  R: [7, 5, 6, 5, 5],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  ".": [0, 0, 0, 0, 2],
  "!": [2, 2, 2, 0, 2],
  "?": [7, 1, 3, 0, 2],
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
const shout = (c, f) => {
  if (!f.calling || f.t % 10 >= 7) return;
  const scale = c.height >= 40 ? 2 : 1;
  write(
    c,
    "!",
    Math.min(c.width - 3 * scale, Math.round(f.cx + f.rx + 1)),
    Math.max(1, Math.round(headTop(f).y - 6 * scale)),
    scale,
    16769101,
    16742938
  );
};
const WARDROBE = [
  { level: 3, key: "bow", part: "a bow tie" },
  { level: 6, key: "cap", part: "a propeller cap" },
  { level: 10, key: "crown", part: "a crown" },
  { level: 15, key: "cape", part: "a cape" },
  { level: 25, key: "halo", part: "a halo" }
];
const UNLOCK = Object.fromEntries(WARDROBE.map((one) => [one.key, one.level]));
const eyeSize = ({ r0, monster }) => Math.max(2, r0 * (monster === "slime" ? 0.42 : monster === "cookie" ? 0.34 : monster === "crab" ? 0.3 : 0.26));
const sprite = (c, rows, x, y, colors) => {
  const [w, h] = [rows[0].length, rows.length];
  const [x0, y0] = [Math.round(x - (w - 1) / 2), Math.round(y) - h + 1];
  const at = (i, j) => (rows[j]?.[i] ?? ".") !== ".";
  for (let j = -1; j <= h; j++) {
    for (let i = -1; i <= w; i++) {
      if (at(i, j)) c.put(x0 + i, y0 + j, colors[rows[j][i]] ?? WHITE);
      else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) c.put(x0 + i, y0 + j, INK, 0.9);
    }
  }
};
const BOW_TIE = {
  small: ["LM...MD", "LMMKMMD", "MD...DD"],
  big: ["LL.....MD", "LMM...MMD", "LMMMKMMMD", "MMD...DDD", "MD.....DD"]
};
const CAP = {
  small: ["..RYB..", ".WRYBB.", "RRRYBBb", "rrryybb"],
  big: ["...RYB...", "..WRYBB..", ".WRRYBBb.", "RRRRYBBBb", "rrrryyybb"]
};
const CROWN = {
  small: ["W..W..W", "L..G..D", "LL.R.DD", "LGGGGGD", "DDDDDDD"],
  big: ["W...W...W", "L...G...D", "LL.GRG.DD", "LLGGGGGDD", "LRGGBGGRD", "DDDDDDDDD"]
};
const headTop = (f) => ({
  x: f.cx,
  y: f.monster === "cookie" ? f.cy - f.ry * 0.8 - eyeSize(f) : f.monster === "crab" ? f.cy - f.ry * 1.45 - eyeSize(f) : f.cy - f.ry * 0.9
});
const cape = (c, f) => {
  const { cx, cy, rx, ry, floor, wave, t } = f;
  const color = f.reddish ? 2899926 : 13115452;
  const top = cy - ry * 0.6;
  const bottom = Math.min(floor - 1, cy + ry * 1.1);
  const billow = Math.min(1, f.lift / 6 + f.heat * 0.6);
  for (let y = Math.floor(top); y <= Math.ceil(bottom) + 1; y++) {
    const p = clamp((y - top) / Math.max(1, bottom - top));
    const sway = Math.sin(wave * 1.6 + p * 2.2) * p * (1 + billow) * 1.2;
    const half = rx * (0.9 + p * (0.45 + billow * 0.35));
    for (let x = Math.floor(cx - half - 2); x <= Math.ceil(cx + half + 2); x++) {
      const nx = (x + 0.5 - cx - sway) / half;
      const hem = bottom + Math.sin(x * 0.9 + t * 0.15) * 0.8;
      if (Math.abs(nx) >= 1 || y > hem) continue;
      const edge = Math.abs(nx) > 1 - 1.2 / half || y > hem - 1;
      const fold = Math.sin(nx * 7 + wave * 1.2) > 0.55;
      const tone = edge ? mix(color, INK, 0.65) : fold ? mix(color, BLACK, 0.25) : nx < -0.3 ? mix(color, WHITE, 0.12) : color;
      c.put(x, y, tone);
    }
  }
  for (const side of [-1, 1]) c.disc(cx + side * rx * 0.78, top + 2, Math.max(0.8, rx * 0.08), GOLD);
};
const propeller = (c, x, y, f, size) => {
  const spin = f.t * (0.25 + f.heat * 1.2 + (f.leveling ? 1.5 : 0));
  const reach = size * Math.cos(spin);
  c.put(x, y + 1, INK);
  c.line(x, y, x + reach, y, 16734815);
  c.line(x, y, x - reach, y, 6080767);
  c.put(x, y, GOLD);
};
const halo = (c, x, y, rx, t) => {
  const ry = Math.max(1, rx * 0.3);
  const bob = Math.sin(t * 0.15) * 0.7;
  const shine = 0.75 + 0.25 * Math.sin(t * 0.3);
  for (let dy = -Math.ceil(ry) - 2; dy <= Math.ceil(ry) + 2; dy++) {
    for (let dx = -Math.ceil(rx) - 2; dx <= Math.ceil(rx) + 2; dx++) {
      const d = Math.hypot(dx / rx, dy / ry);
      const ring = Math.abs(d - 1) * Math.min(rx, ry * 2);
      if (ring < 0.7) c.add(x + dx, y + dy + bob, 16773544, shine);
      else if (ring < 2) c.add(x + dx, y + dy + bob, 16765503, 0.35 * shine * (1 - (ring - 0.7) / 1.3));
    }
  }
};
const wear = (c, f, back) => {
  const { rank, rx, ry, cx, cy, t, monster } = f;
  const size = f.r0 >= 11.5 ? "big" : "small";
  if (rank < UNLOCK.bow) return;
  if (back) {
    if (rank >= UNLOCK.cape) cape(c, f);
    return;
  }
  if (!f.back) {
    const bow = f.reddish ? 2344112 : 14826075;
    sprite(c, BOW_TIE[size], cx, cy + ry * (monster === "slime" ? 0.66 : 0.95) + (size === "big" ? 2 : 1), {
      L: mix(bow, WHITE, 0.3),
      M: bow,
      D: mix(bow, BLACK, 0.3),
      K: mix(bow, BLACK, 0.45)
    });
  }
  const head = headTop(f);
  let crest = head.y;
  if (rank >= UNLOCK.crown) {
    sprite(c, CROWN[size], head.x, head.y, { W: 16775400, L: GOLD_LIGHT, G: GOLD, D: 13076992, R: 16726876, B: 4037631 });
    crest -= CROWN[size].length;
    const glint = t % 70;
    if (glint < 6) c.add(head.x - rx * 0.4 + glint * 1.2, head.y - 1, WHITE, 0.9);
  } else if (rank >= UNLOCK.cap) {
    sprite(c, CAP[size], head.x, head.y, { R: 15749180, r: 12070954, Y: 16765503, y: 13146650, B: 4029439, b: 2773176, W: 16756896 });
    crest -= CAP[size].length + 1;
    propeller(c, Math.round(head.x), Math.round(crest), f, size === "big" ? 4 : 3);
    crest -= 1;
  }
  if (rank >= UNLOCK.halo) halo(c, head.x, crest - 3, Math.max(3, rx * 0.45), t);
};
const eggOf = (f) => {
  const e = f.egg;
  const [rx, ry] = [Math.max(4, f.r0 * 0.76), Math.max(5, f.r0 * 1)];
  const amp = e < 10 ? 0.2 : e < 20 ? 0.3 : 0.38;
  const tilt = e >= 20 || e % 9 < 5 ? amp * Math.sin(e * 1.4) : 0;
  return { x: Math.round(f.width / 2), y: f.floor - ry - (e >= 22 && e % 2 === 0 ? 1 : 0), rx, ry, tilt, color: mix(f.body, WHITE, 0.15) };
};
const CRACK = [[0, -0.2], [0.25, 0.02], [0.5, -0.22], [0.78, 0.02], [1.1, -0.15]];
const egg = (c, f, half = false) => {
  const g = eggOf(f);
  const [cos, sin] = [Math.cos(g.tilt), Math.sin(g.tilt)];
  const place = (u, v) => {
    const [px, py] = [u * g.rx, (v - 1) * g.ry];
    return [g.x + px * cos - py * sin, g.y + g.ry + px * sin + py * cos];
  };
  const crackY = (u) => {
    const side = Math.abs(u);
    const k = CRACK.findIndex(([x]) => x >= side);
    const [a, b] = [CRACK[Math.max(0, k - 1)], CRACK[Math.max(0, k)]];
    return a[1] + (b[1] - a[1]) * ((side - a[0]) / Math.max(0.01, b[0] - a[0]));
  };
  const inside = (nx, ny) => {
    const [px, py] = [nx * g.rx, ny * g.ry - g.ry];
    const [u, v] = [(px * cos + py * sin) / g.rx, (-px * sin + py * cos) / g.ry + 1];
    if (half && v < crackY(u) + 0.45) return false;
    return (u / (1 + 0.18 * v)) ** 2 + v * v < 1;
  };
  c.blob(g.x, g.y, g.rx, g.ry, g.color, inside);
  for (const [u, v, r] of [[-0.42, -0.45, 0.2], [0.38, -0.1, 0.24], [-0.2, 0.42, 0.18], [0.5, 0.55, 0.14], [0.05, -0.8, 0.12]]) {
    if (half && v < 0.55) continue;
    const [x, y] = place(u, v);
    c.disc(x, y, Math.max(0.6, r * g.rx), mix(g.color, WHITE, 0.45));
  }
  if (half) return;
  const e = f.egg;
  const reach = clamp((e - 8) / 16) * 1.1;
  for (const side of [-1, 1]) {
    for (let u = 0; u <= reach; u += 0.04) {
      const [x, y] = place(side * u, crackY(u));
      c.put(x, y, INK);
      if (e >= 21) c.add(x, y + 1, 16773544, 0.5 + 0.5 * Math.sin(e * 1.3));
    }
  }
  if (e >= 21) {
    for (let a = 0; a < 48; a++) {
      const angle = a / 48 * Math.PI * 2;
      const r = 1.25 + 0.1 * Math.sin(a * 3 + e);
      c.add(g.x + Math.cos(angle) * g.rx * r, g.y + Math.sin(angle) * g.ry * r, 16770688, 0.25 * ((e - 20) / 8));
    }
  }
};
const leftovers = (c, f) => {
  if (!f.cold) return;
  const w = Math.max(3, f.r0 * 0.55);
  const h = Math.max(2, Math.round(w * 0.55));
  const x = Math.min(c.width - w - 2, f.home + f.r0 * 1.15 + w);
  const y = f.floor - h;
  for (let dx = -w * 0.8; dx <= w * 0.8; dx += 0.5) {
    const top = Math.round((1 - (dx / w) ** 2) * h * 0.8);
    for (let dy = 0; dy <= top; dy++) c.put(x + dx, y - dy, dy === top ? INK : dy === top - 1 ? 15398655 : 10473717);
  }
  for (let dy = 0; dy <= h; dy++) {
    const half = w * Math.sqrt(1 - (dy / (h + 0.5)) ** 2);
    for (let dx = -half; dx <= half; dx += 0.5) {
      c.put(x + dx, y + dy, Math.abs(dx) > half - 0.7 || dy === h ? INK : dy === 1 ? 5999574 : 14673648);
    }
  }
  if (f.t % 16 < 12) {
    const [sx, sy] = [Math.round(x), Math.max(2, Math.round(y - h - 4))];
    c.put(sx, sy, WHITE);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) c.put(sx + dx, sy + dy, 13626111);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) c.put(sx + dx, sy + dy, 10473717, 0.7);
  }
};
const bowl = (c, f) => {
  if (f.egg >= EGG_CRACK && f.egg < EGG) egg(c, { ...f, egg: 0 }, true);
};
const beam = (c, f) => {
  const p = f.grown;
  if (!f.leveling || p > 34) return;
  const fade = p < 26 ? 1 : 1 - (p - 26) / 8;
  const half = f.r0 * 0.9;
  for (let y = 0; y < f.floor; y++) {
    for (let x = Math.floor(f.cx - half - 2); x <= Math.ceil(f.cx + half + 2); x++) {
      const d = Math.abs(x + 0.5 - f.cx) / half;
      const shimmer = 0.75 + 0.25 * Math.sin(y * 0.7 - p * 1.4 + x);
      if (d < 1) c.add(x, y, mix(GOLD_LIGHT, WHITE, 1 - d), 0.55 * (1 - d * d) * fade * shimmer);
    }
  }
};
const cheer = (c, f) => {
  const p = f.grown;
  if (!f.leveling || p < 2 || p > 44 || p > 38 && p % 3 === 0) return;
  const text = p < 22 ? "LV UP" : `LV ${f.rank}`;
  const scale = c.width >= 40 ? 2 : 1;
  const width = text.length * 4 * scale - scale;
  const rise = clamp((p - 2) / 9);
  const y = Math.round(ease(f.floor - 5 * scale, 2, 1 - (1 - rise) ** 3));
  write(c, text, Math.round((c.width - width) / 2), y, scale, p % 4 < 2 ? 16774048 : 16765503, 16747039);
};
const flash = (c, { leveling, grown }) => {
  if (!leveling || grown >= 4) return;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) c.add(x, y, WHITE, 0.6 * (1 - grown / 4));
};
const badge = (c, rank) => {
  if (rank < 1) return;
  const text = `Lv${rank}`;
  const width = text.length * 4 + 1;
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < width; x++) {
      const corner = (x === 0 || x === width - 1) && (y === 0 || y === 6);
      if (!corner) c.put(1 + x, 1 + y, INK, 0.55);
    }
  }
  ;
  [...text].forEach((char, i) => {
    ;
    (GLYPHS[char] ?? GLYPHS[" "]).forEach((row, y) => {
      for (let x = 0; x < 3; x++) if (row & 4 >> x) c.put(2 + i * 4 + x, 2 + y, i < 2 ? 13226984 : GOLD);
    });
  });
};
const paint = (s, width, height) => {
  const c = new Canvas(width, height);
  const f = shape(s, width, height);
  world(c, f);
  if (f.egg >= 0 && f.egg < EGG_CRACK) {
    shadow(c, { ...f, rx: f.r0 * 0.6 });
    egg(c, f);
    bits(c, s);
    return c.px;
  }
  glow(c, f, s.pantry.length > 0);
  aura(c, f, s.flashAt);
  beam(c, f);
  cheer(c, f);
  blaze(c, f, false);
  shadow(c, f);
  leftovers(c, f);
  wear(c, f, true);
  torso(c, f);
  limbs(c, f, s);
  blaze(c, f, true);
  helpers(c, f, s.minions);
  hair(c, f);
  wear(c, f, false);
  if (!f.back) face(c, f, s);
  antics(c, s, f);
  bowl(c, f);
  for (const mote of s.motes) {
    c.put(mote.px, mote.py, mote.color, 0.4);
    c.put(mote.x, mote.y, mote.color);
  }
  bits(c, s);
  if (f.pressure >= RED || f.bursting || f.heat > 0.8) {
    const p = f.t * 0.06 % 1;
    c.disc(f.cx + f.rx * 0.78, f.cy - f.ry * 0.55 + p * f.ry * 0.5, 0.9, 12577279);
  }
  frenzy(c, f);
  hud(c, s);
  shout(c, f);
  flash(c, f);
  badge(c, f.egg >= 0 && f.egg < EGG || f.leveling ? 0 : s.rank);
  return glitch(c.px, width, height, f);
};
const frenzy = (c, { t, cx, cy, rx, frenzy: k }) => {
  if (k < 0.15) return;
  for (let i = 0; i < 18; i++) {
    const angle = hash(i, Math.floor(t / 2)) * Math.PI * 2;
    const from = rx + 3 + hash(i, t) * 4;
    const to = Math.hypot(c.width, c.height);
    for (let r = from; r < to; r += 0.6) {
      c.add(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.8, 16777215, 0.22 * k * (1 - r / to));
    }
  }
  if (t % 6 === 0) {
    for (let i = 0; i < c.px.length; i++) c.add(i % c.width, Math.floor(i / c.width), rainbow(t * 0.05), 0.12 * k);
  }
};
const glitch = (px, width, height, { t, frenzy: k }) => {
  if (k < 0.25) return px;
  const sx = Math.round((hash(t, 8) - 0.5) * 4 * k);
  const sy = Math.round((hash(t, 9) - 0.5) * 3 * k);
  const split = k > 0.55 && t % 5 < 2 ? 1 : 0;
  const at = (x, y) => px[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))] ?? 0;
  const out = new Uint32Array(px.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = [at(x - sx - split, y - sy), at(x - sx, y - sy), at(x - sx + split, y - sy)];
      out[y * width + x] = r & 16711680 | g & 65280 | b & 255;
    }
  }
  return out;
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
  EGG,
  EGG_CRACK,
  HATCH_WINDOW,
  LEVEL_UP,
  MINUTE,
  PALETTE,
  PROMPT,
  RED,
  SAD,
  STARVING,
  TEXT,
  THINKING,
  WARDROBE,
  asleep,
  createScene,
  encode,
  finishTurn,
  fondness,
  hatch,
  hatching,
  hit,
  levelUp,
  lively,
  paint,
  perk,
  pet,
  serve,
  settle,
  startTurn,
  step,
  to256,
  toolColor,
  typed,
  wait
};
