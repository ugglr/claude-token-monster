import type { Belly, Limit, Look } from '../types'

// Everything the sprite reads. The gauges (belly, pantry, look, hour) come from
// the hooks; serve(), hit(), perk() and the turn calls record what happened, and
// step() turns it into motion one frame at a time, only as fast as tokens arrive.
export type Scene = {
  tick: number
  at: number
  hour: number
  belly: Belly | null
  look: Look
  pantry: Limit[]
  busy: boolean
  tools: Map<string, string>
  minions: number
  level: number
  lastLevel: number
  typedAt: number
  errorAt: number
  activeAt: number
  perkAt: number
  cheerAt: number
  flashAt: number
  arrived: number
  rate: number
  heat: number
  servings: Serving[]
  motes: Mote[]
  bits: Bit[]
  chew: number
  bob: number
  breathe: number
  blinkAt: number
  gaze: Point
  gazeTo: Point
  gazeUntil: number
  googly: Point
  googlyV: Point
  squash: number
  squashV: number
  lid: number
  open: number
  smile: number
  blush: number
  power: number
  // Full tilt: the token rate pegged, with subagents on top. 0 to 1, eased.
  frenzy: number
  // How the last main turn ended, for the sound: a K.O., a cheer, or nothing (aborted).
  ended: 'ko' | 'cheer' | 'quiet'
  // When the person last typed, in $.clock ms (typedAt counts frames, which stop with the pane).
  typedMs: number
  combo: number
  best: number
  comboAt: number
  lastHitAt: number
  finish: { text: string; at: number } | null
  // Petting: when, how it took it, and an affection that builds and fades over minutes.
  petAt: number
  fuss: Fuss
  affection: number
  lovedAt: number
  // Typing after a long quiet: it waves hello first.
  greetAt: number
  // The idle antic running, the frame the next may start (-1 until it is calm), the last one.
  antic: { kind: Antic; at: number; len: number; seed: number } | null
  anticAt: number
  lastAntic: Antic | null
  // How far it has stepped from the middle, chasing something.
  shift: number
  // Growing up: tokens eaten since this scene began (the hooks bank them for good),
  // the lifetime level (0 until known), when it last went up, and the egg a new
  // session hatches from: `eggDue` holds the session's start until the pane shows.
  eaten: number
  rank: number
  rankUpAt: number
  eggDue: number | null
  eggAt: number
}

type Point = { x: number; y: number }
type Serving = { tokens: number; color: number }
type Mote = { x: number; y: number; px: number; py: number; color: number }
type Bit = {
  kind: 'crumb' | 'spark' | 'confetti' | 'z' | 'puff' | 'tear' | 'drool' | 'firefly' | 'ember' | 'heart' | 'shell'
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: number
}

export const MINUTE = 60_000
export const SAD = 15 * MINUTE
export const STARVING = 60 * MINUTE
export const BURP = MINUTE
// One pair of limit thresholds for the bars, the glow, the sweat and the remarks.
export const AMBER = 50
export const RED = 80
// The context fill, in percent, where the monster is about to burst: time to /compact.
export const BURST = 90
// Tool calls closer together than this chain into a combo, and the fire burns this many frames after the last.
export const COMBO_MS = 4000
const COMBO_FRAMES = 40
// Frames (at 10 a second) of nothing happening before it yawns, then dozes off.
const DOZE = 1800
const YAWN = 40
const CHEER = 26
const HOP = 12
const PERK = 18
// A level-up, in frames: crouch, a spinning jump, the landing, then a pose.
export const LEVEL_UP = 50
// The egg wobbles and cracks this many frames, bursts, and the shell is gone by EGG.
export const EGG_CRACK = 28
export const EGG = 42
// A pane first painted later than this after the session started skips the egg.
export const HATCH_WINDOW = 20_000

export const PALETTE: Record<string, number> = {
  blue: 0x3d7bff,
  cyan: 0x22c7d6,
  green: 0x46d160,
  yellow: 0xf2c230,
  magenta: 0xd25cf0,
  red: 0xf0503c,
  white: 0xdfe6f0,
  // CrabStack's amber.
  amber: 0xffb000,
}

const WHITE = 0xffffff
const BLACK = 0x000000
const INK = 0x1a0f24
const MOUTH = 0x2a0410
const TONGUE = 0xe8607e
const BLUSH = 0xff7aa8
const GOLD = 0xffd23f
const GOLD_LIGHT = 0xfff3a0
const GOLD_DARK = 0x8a5a00
const RAINBOW = [0xff5a5f, 0xffd23f, 0x5cff8a, 0x5cc8ff, 0xc77dff, 0xffffff]
const TEAL = 0x2fe0c8
const BOLT = 0xcff6ff
export const TEXT = 0xffd166
export const THINKING = 0xb59cff
export const PROMPT = 0x9ad7ff
const TOOL_COLORS: [RegExp, number][] = [
  [/^Bash/, 0x5cff8a],
  [/^(Read|Grep|Glob|LS)/, 0x5cc8ff],
  [/^(Edit|Write|MultiEdit|NotebookEdit)/, 0xffa94d],
  [/^Web/, 0xc77dff],
  [/^Agent/, 0xff6fd8],
  [/^mcp__/, 0xffe066],
]

export const toolColor = (tool: string | undefined) =>
  tool === undefined ? TEXT : (TOOL_COLORS.find(([match]) => match.test(tool))?.[1] ?? TEXT)

const mix = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t))
  const channel = (shift: number) => {
    const from = (a >> shift) & 255

    return Math.round(from + (((b >> shift) & 255) - from) * k) << shift
  }

  return channel(16) | channel(8) | channel(0)
}

// A fully saturated color going round the hue wheel, for the frenzy.
const rainbow = (turn: number) => {
  const h = ((turn % 1) + 1) % 1 * 6
  const x = 1 - Math.abs((h % 2) - 1)
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x]

  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255)
}

// A repeatable 0..1 from integers, so paint() flickers without moving the scene.
const hash = (a: number, b = 0) => {
  let h = (a * 374761393 + b * 668265263) | 0

  h = Math.imul(h ^ (h >>> 13), 1274126177)

  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32
}

let seed = 7
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
const ease = (from: number, to: number, k: number) => from + (to - from) * k
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v))

export const createScene = (look: Look): Scene => ({
  tick: 0,
  at: 0,
  hour: 22,
  belly: null,
  look,
  pantry: [],
  busy: false,
  tools: new Map(),
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
  ended: 'quiet',
  typedMs: -Infinity,
  combo: 0,
  best: 0,
  comboAt: -100,
  lastHitAt: -Infinity,
  finish: null,
  petAt: -100,
  fuss: 'purr',
  affection: 0,
  lovedAt: 0,
  greetAt: -100,
  antic: null,
  anticAt: -1,
  lastAntic: null,
  shift: 0,
  eaten: 0,
  rank: 0,
  rankUpAt: -1000,
  eggDue: null,
  eggAt: -1000,
})

// Tokens arriving: they heat the monster up and fly into its mouth. Typing only
// drools; it is not tokens spent. Prompt-colored servings rise from the prompt.
export const serve = (s: Scene, tokens: number, color: number, heats = true) => {
  if (tokens <= 0) return
  if (heats) {
    s.arrived += tokens
    s.eaten += tokens
  }

  s.activeAt = s.tick
  s.servings.push({ tokens: Math.min(tokens, 3000), color })
  s.servings = s.servings.slice(-24)
}

// You sent a prompt: it perks up and looks forward to it.
export const perk = (s: Scene) => {
  s.perkAt = s.tick
  s.activeAt = s.tick
}

// A main-loop tool call landed at `at` ($.clock milliseconds): it chains if close to the last.
export const hit = (s: Scene, isError: boolean, at: number) => {
  s.combo = at - s.lastHitAt > COMBO_MS ? 1 : s.combo + 1
  s.best = Math.max(s.best, s.combo)
  s.lastHitAt = at
  s.comboAt = s.tick
  s.activeAt = s.tick
  // Every hit stokes the fire: a jolt now, a flare of embers on the next frame.
  s.squashV += 0.05

  if (isError) {
    s.errorAt = s.tick
    s.finish = { text: 'COUNTER', at: s.tick }
  }
}

export const startTurn = (s: Scene) => {
  s.busy = true
  s.combo = 0
  s.best = 0
  s.activeAt = s.tick
}

// Every finished turn is a little celebration; one that landed a combo of three
// or more ends in a K.O., however long the answer took.
export const finishTurn = (s: Scene, isAborted = false) => {
  // An interrupted turn gets neither: no K.O., no cheer.
  s.ended = isAborted ? 'quiet' : s.best >= 3 ? 'ko' : 'cheer'

  if (!isAborted) {
    if (s.best >= 3) s.finish = { text: 'K.O.', at: s.tick }
    s.cheerAt = s.tick
  }

  s.busy = false
  s.tools.clear()
  s.combo = 0
  s.best = 0
  s.activeAt = s.tick
}

// Asleep: three quiet minutes with nothing flowing, and well fed. A hungry monster
// stays up, so the sprite, a pet and the snore all agree on this one rule.
export const asleep = (s: Scene) =>
  !s.busy && s.heat <= 0.02 && s.tick - s.activeAt > DOZE && (s.belly === null || s.at - s.belly.fedAt < SAD)

// It grew a level: the big moment. A first reading of the level is no moment.
export const levelUp = (s: Scene, rank: number) => {
  if (s.rank > 0 && rank > s.rank) {
    s.rankUpAt = s.tick
    s.activeAt = s.tick
  }

  s.rank = Math.max(s.rank, rank)
}

// The pane is painting: a session's first look at the monster starts with the egg,
// unless the pane came too long after the start (`at` and `eggDue` in ms). Once only.
export const hatch = (s: Scene, at: number) => {
  const due = s.eggDue

  s.eggDue = null
  if (due === null || at - due >= HATCH_WINDOW) return false

  s.eggAt = s.tick
  s.activeAt = s.tick

  return true
}

export const hatching = (s: Scene) => s.tick - s.eggAt >= 0 && s.tick - s.eggAt < EGG

// What piled up while nothing was drawing is not a meal to replay.
export const settle = (s: Scene) => {
  s.arrived = 0
  s.rate = 0
  s.heat = 0
  s.servings = []
  s.motes = []
  s.bits = []
  s.antic = null
}

const comboShown = (s: Scene) => s.combo >= 2 && s.tick - s.comboAt <= COMBO_FRAMES

// Whether anything moves beyond breathing and blinking, so a frame is worth painting.
export const lively = (s: Scene) =>
  s.busy ||
  s.heat > 0.02 ||
  s.power > 0.02 ||
  s.frenzy > 0.02 ||
  s.motes.length > 0 ||
  s.servings.length > 0 ||
  s.bits.some(bit => bit.kind !== 'z' && bit.kind !== 'firefly') ||
  s.tick - s.typedAt < 15 ||
  s.tick - s.cheerAt < CHEER ||
  s.tick - s.perkAt < PERK ||
  Math.abs(s.squashV) > 0.01 ||
  comboShown(s) ||
  (s.finish !== null && s.tick - s.finish.at < 18) ||
  s.antic !== null ||
  s.tick - s.petAt < PET ||
  s.tick - s.greetAt < GREET ||
  Math.abs(s.shift) > 0.05 ||
  s.tick - s.rankUpAt < LEVEL_UP ||
  hatching(s)

// What a frame reads off the scene: the monster's place and size, and how it feels.
const shape = (s: Scene, width: number, height: number) => {
  const t = s.tick
  const full = (s.belly?.percent ?? 0) / 100
  const fill = s.belly?.fill ?? 0
  const idle = s.belly === null ? 0 : s.at - s.belly.fedAt
  const starving = idle >= STARVING
  const monster = s.look.monster
  const eating = s.heat > 0.02
  const quiet = t - s.activeAt
  const hungry = idle >= SAD
  const sleeping = asleep(s)
  const yawning = !s.busy && !eating && quiet > DOZE - YAWN && !sleeping && !hungry
  const floor = height - 4
  // Powering up, it tightens to make room for the hair.
  const tight = 1 - s.power * 0.18
  const r0 = Math.min(width * 0.5, height * 0.62) * 0.5
  const wobble = monster === 'slime' ? 1 + 0.05 * Math.sin(s.breathe * 2.2) : 1
  const breath = 1 + Math.sin(s.breathe) * (sleeping ? 0.05 : 0.025)
  // The crab's shell is wide and low.
  const [wide, low] = monster === 'crab' ? [1.18, 0.7] : [1, 1]
  const rx0 = Math.min(width * 0.38, r0 * (0.78 + 0.5 * full) * (starving ? 0.85 : 1) * wobble * wide) * tight
  const ry0 = Math.min(height * 0.3, r0 * (0.82 + 0.3 * full) * low) * tight * breath
  const move = motion(s, r0)
  // A level-up jumps high and spins twice in the air: seen edge-on, it is thin.
  const grown = t - s.rankUpAt
  const leveling = grown >= 0 && grown < LEVEL_UP
  const flight = (grown - 4) / 14
  const flying = flight > 0 && flight < 1
  const spin = flying ? Math.cos(flight * Math.PI * 4) : 1
  // Out of the egg it pops up from small.
  const egg = t - s.eggAt
  const pop = egg >= EGG_CRACK && egg < EGG_CRACK + 6 ? 0.55 + 0.45 * ((egg - EGG_CRACK) / 6) : 1
  const rx = rx0 * (1 + s.squash * 0.7) * pop * Math.max(0.14, Math.abs(spin)) * move.sx
  const ry = ry0 * (1 - s.squash) * pop * move.sy
  const hopP = (t - s.cheerAt) / HOP
  const hop = (hopP >= 0 && hopP < 1 ? Math.sin(Math.PI * hopP) * r0 * 0.45 : 0) + (flying ? Math.sin(Math.PI * flight) * r0 * 1.5 : 0)
  const lift =
    (monster === 'ghost' ? 3 + Math.sin(s.breathe * 1.3) * 1.4 : 0) +
    (eating ? Math.abs(Math.sin(s.bob)) * (0.3 + s.heat * 1.8) : 0) +
    s.power * 1.5 +
    hop +
    move.lift
  const shake =
    s.heat > 0.7 || s.level >= 2 || t - s.errorAt < 6 ? Math.round((hash(t, 1) - 0.5) * 2 * (1 + s.frenzy * 2)) : 0
  // A crab never stands still: it shuffles a step to the side and back.
  const shuffle = monster === 'crab' ? Math.round(Math.sin(s.breathe * 0.8) * 2) : 0
  const cx = width / 2 + shake + shuffle + Math.round(s.shift + move.dx)
  const feet = monster === 'ghost' || monster === 'slime' ? 0 : r0 * (monster === 'crab' ? 0.4 : 0.18)
  // However it floats, the head stays on screen.
  const cy = floor - feet - ry - Math.min(lift, Math.max(0, floor - feet - 2 * ry - 4))

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
    pressure: Math.max(0, ...s.pantry.map(limit => limit.percentUsed)),
    typing: t - s.typedAt < 15,
    perking: t - s.perkAt < PERK,
    cheering: t - s.cheerAt < CHEER,
    thinking: s.busy && !eating,
    angry: t - s.errorAt < 20,
    blink: t - s.blinkAt < 3 && t - s.typedAt >= 15,
    body: starving
      ? mix(PALETTE[s.look.color] ?? 0x3d7bff, 0x8a8f99, 0.55)
      : mix(PALETTE[s.look.color] ?? 0x3d7bff, rainbow(t * 0.08), s.frenzy * 0.4),
    frenzy: s.frenzy,
    mouth: { x: cx, y: cy + ry * (monster === 'slime' ? 0.3 : monster === 'crab' ? 0.05 : 0.34) },
    // Where it stands at rest, and the middle of its body there, for the antics' props.
    home: width / 2,
    rest: floor - feet - ry,
    // Turned away, by an antic or mid level-up spin: no face to draw.
    back: move.back || spin < 0.3,
    petting: t - s.petAt < PET,
    greeting: t - s.greetAt < GREET,
    leveling,
    grown,
    egg,
    rank: s.rank,
    width,
    // Red and magenta monsters wear their reds in blue and teal, so they show.
    reddish: s.look.color === 'red' || s.look.color === 'magenta',
  }
}

type Shape = ReturnType<typeof shape>

type Eyes = 'open' | 'happy' | 'closed' | 'dizzy' | 'squeeze' | 'plead'
type Brows = 'none' | 'fierce' | 'sad'

// How it looks right now: eyes, brows, and the targets the face eases toward.
const mood = (s: Scene, f: Shape) => {
  const chomp = Math.abs(Math.sin(s.chew))
  const set = (eyes: Eyes, brows: Brows, lid: number, open: number, smile: number, blush: number) => ({
    eyes,
    brows,
    lid,
    open,
    smile,
    blush,
  })

  if (f.leveling) return set('happy', 'none', 0, 0.85, 1, 1)
  if (f.bursting && f.power <= 0.5) return set('dizzy', 'sad', 0, 0.35 + 0.15 * Math.sin(f.t * 0.3), -0.3, 0.3)
  if (f.angry && f.t - s.errorAt < 10) return set('squeeze', 'sad', 0, 0.15, -0.8, 0)
  if (f.petting) {
    if (s.fuss === 'stir') return set('closed', 'none', 1, 0.1, 0.9, 1)
    if (s.fuss === 'plead') return set('plead', 'sad', 0, 0, -0.35, 0.6)

    return set('happy', 'none', 0, f.eating ? 0.3 + 0.6 * chomp : s.fuss === 'spin' ? 0.45 : 0, 1, 1)
  }
  if (f.greeting) return set('happy', 'none', 0, 0.45, 1, 0.5)
  if (f.burping) return set('happy', 'none', 0, 1, 0.6, 0.6)
  if (f.cheering) return set('happy', 'none', 0, 0.75, 1, 1)
  if (f.frenzy > 0.55) return set('dizzy', 'fierce', 0, 0.55 + 0.45 * chomp, 0.9, 1)
  if (f.power > 0.5) return set('open', 'fierce', 0.1, f.eating ? 0.3 + 0.6 * chomp : 0.5, 0.3, 0.2)
  if (f.blaze > 0.3) return set('open', 'fierce', 0.15, f.eating ? 0.3 + 0.6 * chomp : 0.25, 0.6, 0.4)
  if (s.antic !== null) {
    const [eyes, brows, lid, open, smile, blush] = feel(s, f, s.antic)

    return set(eyes, brows, lid, open, smile, blush)
  }
  if (f.sleeping) return set('closed', 'none', 1, 0.12 + 0.06 * Math.sin(f.wave), 0.1, 0.35)
  if (f.yawning) return set('closed', 'none', 1, 1, 0, 0)
  if (f.eating) return set('open', 'none', 0.1 + f.heat * 0.35, (0.25 + 0.75 * f.heat) * chomp, 0.6, 0.2 + f.heat * 0.7)
  if (f.typing || f.perking) return set('open', 'none', 0, 0.3, 0.4, 0.3)
  if (f.thinking) return set('open', 'none', 0.25, 0, -0.1, 0)
  if (f.starving) return set('open', 'sad', 0.55, 0, -1, 0)
  if (f.sad) return set('open', 'sad', 0.3, 0, -0.7, 0)
  if (f.stuffed) return set('open', 'none', 0.45, 0, 0.8, 0.6)
  return set('open', 'none', 0.05, 0, 0.35, 0.15)
}

// Life: petting, the idle antics and the greeting. Each is a few seconds of
// motion read off the scene, so paint() stays pure and step() moves it on.

export type Fuss = 'purr' | 'wiggle' | 'spin' | 'stir' | 'plead'
export type Antic = 'stretch' | 'scratch' | 'look' | 'wave' | 'chase' | 'juggle' | 'hop' | 'peek' | 'star'

// Frames each antic runs (1.5 to 4 seconds), and how often it comes up.
const ANTICS: Record<Antic, { len: number; weight: number }> = {
  stretch: { len: 32, weight: 3 },
  scratch: { len: 30, weight: 3 },
  look: { len: 40, weight: 3 },
  wave: { len: 24, weight: 2 },
  chase: { len: 40, weight: 3 },
  juggle: { len: 40, weight: 2 },
  hop: { len: 18, weight: 2 },
  peek: { len: 34, weight: 2 },
  star: { len: 38, weight: 2 },
}
const PET = 22
const GREET = 24
// Two minutes of frames: typing after that long a quiet earns a hello.
const AWAY = 1200
// 15 to 45 seconds of calm between antics.
const LULL = 150
const LULL_MORE = 300
const HEART = 0xff4f7b

// How fond of you it is right now: each pet adds one, and it halves every two minutes.
export const fondness = (s: Scene, at: number) => s.affection * 0.5 ** (Math.max(0, at - s.lovedAt) / (2 * MINUTE))

// You petted it, at `at` ($.clock milliseconds). Asleep, it stirs and smiles without
// waking; starving, it pleads; otherwise the fonder it is, the bigger the fuss.
export const pet = (s: Scene, at: number): Fuss => {
  const dozing = asleep(s)
  const starving = s.belly !== null && at - s.belly.fedAt >= STARVING

  s.affection = Math.min(6, fondness(s, at) + 1)
  s.lovedAt = at
  s.petAt = s.tick
  s.fuss = dozing ? 'stir' : starving ? 'plead' : s.affection > 3.5 ? 'spin' : s.affection > 1.5 ? 'wiggle' : 'purr'
  s.antic = null
  if (!dozing) s.activeAt = s.tick

  return s.fuss
}

// A key pressed in the prompt. After a long quiet it waves hello first; says whether it does.
export const typed = (s: Scene) => {
  const away = s.tick - s.activeAt >= AWAY && s.tick - s.typedAt >= AWAY

  if (away) s.greetAt = s.tick
  s.typedAt = s.tick

  return away
}

// Whether nothing at all is going on, so an antic may run.
const calm = (s: Scene, f: Shape) =>
  !s.busy &&
  !f.eating &&
  !f.typing &&
  !f.perking &&
  !f.cheering &&
  !f.sleeping &&
  !f.yawning &&
  !f.starving &&
  !f.angry &&
  !f.petting &&
  !f.greeting &&
  s.power < 0.05 &&
  s.servings.length === 0 &&
  s.motes.length === 0 &&
  !comboShown(s)

// A weighted pick, never the one just done; the falling star only after dark,
// the side scratch only for a monster with arms.
const choose = (s: Scene, f: Shape): Antic => {
  const night = daylight(s.hour) < 0.4
  const options = (Object.keys(ANTICS) as Antic[]).filter(
    kind => kind !== s.lastAntic && (kind !== 'star' || night) && (kind !== 'scratch' || f.monster !== 'ghost'),
  )
  let roll = random() * options.reduce((sum, kind) => sum + ANTICS[kind].weight, 0)

  return options.find(kind => (roll -= ANTICS[kind].weight) < 0) ?? options[0]!
}

const progress = (s: Scene) => (s.antic === null ? 0 : (s.tick - s.antic.at) / s.antic.len)
// Up over the first `rise` of the way, held, down over the last `fall`.
const swell = (p: number, rise: number, fall: number) => clamp(Math.min(p / rise, (1 - p) / fall))

// How the body moves: a step aside, a lift, a stretch, and for a spin whether its back is turned.
const motion = (s: Scene, r0: number) => {
  const t = s.tick
  const m = { dx: 0, lift: 0, sx: 1, sy: 1, back: false }
  const ghost = s.look.monster === 'ghost'

  if (t - s.petAt < PET) {
    const p = (t - s.petAt) / PET

    if (s.fuss === 'purr') m.dx = Math.sin(t * 1.5) * 1.2 * (1 - p)
    if (s.fuss === 'wiggle') {
      m.dx = Math.sin(t * 1.5) * 2 * (1 - p)
      m.lift = Math.abs(Math.sin(p * Math.PI * 2)) * r0 * 0.18
    }
    if (s.fuss === 'spin') {
      const q = clamp(p / 0.6)
      const turn = Math.cos(q * Math.PI * 2)

      m.sx = Math.max(0.25, Math.abs(turn))
      m.back = turn < 0
      m.lift = Math.sin(Math.PI * q) * r0 * 0.4
    }
    if (s.fuss === 'stir') m.dx = p < 0.6 ? Math.sin(t * 0.9) * 0.8 : 0
    if (s.fuss === 'plead') m.lift = Math.abs(Math.sin(t * 0.45)) * 0.8

    return m
  }

  if (t - s.greetAt < GREET) {
    const p = (t - s.greetAt) / GREET

    m.lift = p < 0.4 ? Math.sin((Math.PI * p) / 0.4) * r0 * 0.25 : 0
    if (ghost) m.dx = Math.sin(t * 0.9) * 2

    return m
  }

  const a = s.antic

  if (a === null) return m

  const p = progress(s)

  if (a.kind === 'stretch') {
    const k = swell(p, 0.25, 0.25)

    m.sy = 1 + 0.16 * k
    m.sx = 1 - 0.08 * k
    // A satisfied shake to finish.
    if (p > 0.8) m.dx = Math.sin(t * 2.2) * 0.8
  }
  if (a.kind === 'look') {
    m.dx = p < 0.1 ? 0 : p < 0.32 ? -1 : p < 0.56 ? 1 : 0
    // The shrug: shoulders up and down.
    m.lift = p >= 0.62 ? Math.sin(clamp((p - 0.62) / 0.3) * Math.PI) * 1.6 : 0
  }
  // No arms to wave with: the ghost rocks side to side instead.
  if (a.kind === 'wave' && ghost) {
    m.dx = Math.sin(t * 0.9) * 2
    m.lift = Math.abs(Math.sin(t * 0.45)) * 1.5
  }
  // Leaning into the itch.
  if (a.kind === 'scratch') m.dx = swell(p, 0.15, 0.15)
  if (a.kind === 'chase') {
    m.lift =
      p < 0.56
        ? Math.abs(Math.sin(p * Math.PI * 6)) * r0 * 0.12
        : p < 0.74
          ? Math.sin(((p - 0.56) / 0.18) * Math.PI) * r0 * 0.3
          : 0
  }
  if (a.kind === 'hop') m.lift = Math.abs(Math.sin(p * Math.PI * 3)) * r0 * 0.3
  if (a.kind === 'peek') {
    const k = swell(p, 0.15, 0.2)

    m.sy = 1 - 0.07 * k
    m.sx = 1 + 0.04 * k
    if (p >= 0.8) m.lift = Math.abs(Math.sin(((p - 0.8) / 0.2) * Math.PI * 2)) * 1.2
  }
  if (a.kind === 'star' && hash(a.at, 4) < 0.7 && p > 0.62 && p < 0.86) m.lift = Math.sin(((p - 0.62) / 0.24) * Math.PI) * r0 * 0.25
  if (a.kind === 'juggle' && p > 0.9) m.lift = Math.sin(((p - 0.9) / 0.1) * Math.PI) * 1.2

  return m
}

// The thing an antic plays with, where it is at `p`: the firefly or butterfly, the
// falling star, the token. Null when there is none (yet, or any more).
const prop = (s: Scene, f: Shape, p = progress(s)) => {
  const a = s.antic

  if (a === null) return null

  const side = a.seed < 0.5 ? -1 : 1

  if (a.kind === 'chase') {
    const away = clamp((p - 0.66) / 0.34)
    const y0 = f.rest - f.ry * 0.9

    return {
      x: f.home + side * f.rx * 1.3 * Math.cos(Math.PI * 2 * 1.15 * Math.min(p, 0.66)) + side * away * f.rx * 2.5,
      y: y0 + Math.sin(Math.PI * 2 * 2.3 * p) * f.ry * 0.3 - away * away * (y0 + 6),
    }
  }

  if (a.kind === 'star') {
    const { aim, caught, start } = falling(s, f)
    const land = caught ? aim : aim - side * (f.rx + 3)
    const q = clamp((p - 0.12) / (caught ? 0.48 : 0.6))

    if ((caught && p >= 0.6) || p >= 0.72) return null

    return {
      x: ease(start, land, q),
      y: ease(2, caught ? f.rest + f.ry * 0.34 : f.floor - 1, q ** 1.4),
    }
  }

  if (a.kind === 'juggle') {
    const head = { x: f.cx, y: f.cy - f.ry - 1.5 }
    const [left, right] =
      f.monster === 'ghost' ? [head, head] : [-1, 1].map(side => ({ x: f.cx + side * f.rx * 0.95, y: f.cy + f.ry * 0.15 }))
    const arc = (from: Point, to: Point, u: number, height: number) => ({
      x: ease(from.x, to.x, u),
      y: ease(from.y, to.y, u) - 4 * height * u * (1 - u),
    })

    // Three throws hand to hand (bounces on the head, for the ghost), then a high one into the mouth.
    if (p < 0.72) {
      const q = (p / 0.72) * 3
      const k = Math.floor(q)

      return arc(k % 2 === 0 ? left! : right!, k % 2 === 0 ? right! : left!, q - k, f.monster === 'ghost' ? 5 : f.ry * 1.3 + 2)
    }

    return p < 0.9 ? arc(right!, f.mouth, (p - 0.72) / 0.18, f.ry * 1.4 + 4) : null
  }

  return null
}

// Where the star falls from, where it is aimed, and whether the monster gets it.
const falling = (s: Scene, f: Shape) => {
  const a = s.antic!
  const side = a.seed < 0.5 ? -1 : 1
  const aim = f.home + (hash(a.at, 3) - 0.5) * f.rx * 1.2

  return { aim, caught: hash(a.at, 4) < 0.7, start: aim + side * f.home * 0.7 }
}

type Feel = [Eyes, Brows, number, number, number, number]

// The face for each antic, as targets for mood(): eyes, brows, lid, mouth open, smile, blush.
const feel = (s: Scene, f: Shape, a: NonNullable<Scene['antic']>): Feel => {
  const p = progress(s)

  if (a.kind === 'stretch') return p < 0.78 ? ['closed', 'none', 1, 0.55, 0.3, 0.2] : ['happy', 'none', 0, 0, 0.8, 0.4]
  if (a.kind === 'scratch') return ['open', 'none', 0.5, 0, 0.7, 0.3]
  if (a.kind === 'look') return p < 0.6 ? ['open', 'none', 0, 0, 0.1, 0] : ['open', 'sad', 0, 0, -0.05, 0]
  if (a.kind === 'wave' || a.kind === 'hop') return ['happy', 'none', 0, 0.35, 1, 0.5]
  if (a.kind === 'chase') {
    if (p < 0.6) return ['open', 'none', 0, 0.2, 0.6, 0.3]
    if (p < 0.74) return ['open', 'fierce', 0, 0.5, 0.4, 0.3]
    return p < 0.88 ? ['open', 'none', 0, 0.3, 0.3, 0.2] : ['happy', 'none', 0, 0, 0.9, 0.4]
  }
  if (a.kind === 'juggle') {
    if (p < 0.78) return ['open', 'none', 0, 0.1, 0.7, 0.3]
    if (p < 0.9) return ['open', 'none', 0, 0.8, 0.5, 0.3]
    return ['happy', 'none', 0, Math.abs(Math.sin(f.t * 0.8)) * 0.4, 1, 0.7]
  }
  if (a.kind === 'peek') return p < 0.8 ? ['open', 'none', 0, 0.15, 0, 0] : ['happy', 'none', 0, 0, 0.8, 0.3]

  const { caught } = falling(s, f)

  if (p < 0.12) return ['open', 'none', 0, 0, 0.4, 0]
  if (p < 0.35) return ['open', 'none', 0, 0.2, 0.5, 0.2]
  if (p < 0.6) return ['open', 'none', 0, 0.9, 0.4, 0.3]
  if (caught) return ['happy', 'none', 0, 0, 1, 1]
  return p < 0.72 ? ['open', 'none', 0, 0.5, 0.2, 0] : ['open', 'sad', 0.2, 0, -0.6, 0]
}

// Where the eyes look: up at you to plead, after the critter, the star or the
// token, around the garden, or down at the readout under the picture.
const glance = (s: Scene, f: Shape): Point | null => {
  if (f.petting) return s.fuss === 'plead' ? { x: 0, y: -0.7 } : null
  if (f.greeting) return { x: 0, y: 0 }

  const a = s.antic

  if (a === null) return null

  const p = progress(s)
  const thing = prop(s, f)

  if (thing !== null) {
    const [dx, dy] = [thing.x - f.cx, thing.y - (f.cy - f.ry * 0.4)]
    const d = Math.max(1, Math.hypot(dx, dy))

    return { x: dx / d, y: dy / d }
  }

  if (a.kind === 'look') return p < 0.1 ? { x: 0, y: 0 } : p < 0.32 ? { x: -0.95, y: 0.1 } : p < 0.56 ? { x: 0.95, y: 0.1 } : { x: 0, y: 0 }
  if (a.kind === 'scratch') return { x: 0.8, y: 0.6 }
  if (a.kind === 'peek') return p < 0.8 ? { x: Math.sin(p * Math.PI * 5) * 0.8, y: 1 } : { x: 0, y: 0.3 }
  if (a.kind === 'chase') return { x: (a.seed < 0.5 ? -1 : 1) * 0.6, y: -0.9 }
  if (a.kind === 'star') return falling(s, f).caught ? { x: 0, y: 0 } : { x: (a.seed < 0.5 ? 1 : -1) * 0.7, y: 0.9 }

  return null
}

// Where a hand goes for a pet, the greeting or an antic, or null to leave it to the usual poses.
const pose = (s: Scene, f: Shape, side: number, ax: number, ay: number, length: number, rest: Point): Point | null => {
  const { t } = f
  const up = { x: ax + side * length * 0.6, y: ay - length * 1.1 }
  const wave = { x: ax + side * length * 0.55 + Math.sin(t * 1.1) * length * 0.45, y: ay - length * 1.05 }

  if (f.petting) {
    const p = (t - s.petAt) / PET

    // Hands clasped under the chin to beg; out wide to spin; on its blushing cheeks to purr.
    if (s.fuss === 'plead') return { x: f.mouth.x + side * 1.5, y: f.mouth.y + 2.5 }
    if (s.fuss === 'stir') return null
    if (s.fuss === 'spin') return p < 0.6 ? { x: ax + side * length * 0.9, y: ay - length * 0.2 } : up

    return { x: f.cx + side * f.rx * 0.8, y: f.cy + f.ry * 0.2 }
  }

  if (f.greeting) return side === -1 ? wave : null

  const a = s.antic

  if (a === null) return null

  const p = progress(s)

  if (a.kind === 'stretch') {
    const k = swell(p, 0.25, 0.25)

    return { x: ax + side * length * (0.6 - 0.25 * k), y: ay - length * (0.2 + 1.2 * k) }
  }
  if (a.kind === 'scratch') {
    return side === 1 ? { x: f.cx + f.rx * 0.78, y: f.cy + f.ry * 0.2 + Math.sin(t * 1.6) * 2 } : null
  }
  if (a.kind === 'look') return p >= 0.6 ? { x: ax + side * length * 0.95, y: ay - length * 0.15 } : null
  if (a.kind === 'wave') return side === -1 ? wave : null
  if (a.kind === 'hop') return { x: ax + side * length * 0.8, y: ay - length * 0.6 }
  if (a.kind === 'peek') return { x: f.cx + side * f.rx * 0.5, y: f.cy + f.ry * 0.8 }

  if (a.kind === 'chase') {
    const clap = prop(s, f, 0.66)!
    const k = p < 0.54 ? 0 : p < 0.64 ? (p - 0.54) / 0.1 : p < 0.78 ? 1 : 1 - (p - 0.78) / 0.12

    return k <= 0 ? null : { x: ease(rest.x, clap.x + side * 1.3, k), y: ease(rest.y, clap.y, k) }
  }

  if (a.kind === 'juggle') {
    const thing = prop(s, f)
    const base = { x: f.cx + side * f.rx * 0.95, y: f.cy + f.ry * 0.15 }
    const near = thing === null ? 0 : clamp(1 - Math.hypot(thing.x - base.x, thing.y - base.y) / 5)

    return p < 0.92 ? { x: base.x, y: base.y + 1 - near * 2 } : { x: f.cx + side * f.rx * 0.35, y: f.cy + f.ry * 0.55 }
  }

  // The star: reach up for it; caught, pat the belly.
  if (p < 0.3) return null
  if (p < 0.62) return up
  if (falling(s, f).caught) return { x: f.cx + side * f.rx * 0.35, y: f.cy + f.ry * (0.55 + (t % 6 < 3 ? 0.05 : 0)) }

  return null
}

// One frame of life: start, run and stop the antics, step toward what it chases,
// and send up the hearts, sparkles and crumbs.
const live = (s: Scene, f: Shape) => {
  const a = s.antic

  if (!calm(s, f)) {
    s.antic = null
    s.anticAt = -1
  } else if (a !== null && s.tick - a.at >= a.len) {
    s.antic = null
    s.anticAt = s.tick + LULL + random() * LULL_MORE
  } else if (a === null && s.anticAt < 0) {
    s.anticAt = s.tick + LULL + random() * LULL_MORE
  } else if (a === null && s.tick >= s.anticAt && s.tick - s.activeAt + 40 < DOZE - YAWN) {
    const kind = choose(s, f)

    s.antic = { kind, at: s.tick, len: ANTICS[kind].len, seed: random() }
    s.lastAntic = kind
  }

  const now = s.antic
  const p = progress(s)
  const room = Math.max(0, f.home - f.rx - 2)
  let target = 0

  if (now?.kind === 'chase' && p < 0.62) target = ((prop(s, f)?.x ?? f.home) - f.home) * 0.45
  if (now?.kind === 'star' && p > 0.1 && p < 0.85) target = falling(s, f).aim - f.home

  s.shift = ease(s.shift, clamp(target, -room, room), 0.15)
  if (target === 0 && Math.abs(s.shift) < 0.05) s.shift = 0

  const sparkle = (x: number, y: number, n: number, color: number) => {
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2

      s.bits.push({ kind: 'spark', x, y, vx: Math.cos(angle) * 0.45, vy: Math.sin(angle) * 0.45 - 0.1, life: 16, max: 16, color })
    }
  }
  const heart = (x: number, y: number, vx: number, vy: number, life = 28) =>
    s.bits.push({ kind: 'heart', x, y, vx, vy, life, max: life, color: HEART })

  if (now !== null) {
    const e = s.tick - now.at
    const at = (q: number) => e === Math.round(now.len * q)

    if (now.kind === 'star' && falling(s, f).caught && at(0.6)) {
      sparkle(f.mouth.x, f.mouth.y - 1, 10, GOLD_LIGHT)
      s.squashV += 0.1
    }
    if (now.kind === 'star' && !falling(s, f).caught && at(0.72)) {
      s.bits.push({ kind: 'puff', x: f.home + (falling(s, f).aim - f.home) - (now.seed < 0.5 ? -1 : 1) * (f.rx + 3), y: f.floor - 2, vx: 0, vy: -0.2, life: 18, max: 18, color: 0xfff1b0 })
    }
    if (now.kind === 'chase' && at(0.66)) {
      const clap = prop(s, f, 0.66)!

      sparkle(clap.x, clap.y, 4, WHITE)
    }
    if (now.kind === 'juggle' && at(0.9)) {
      s.squashV += 0.08
      for (let i = 0; i < 5; i++) {
        s.bits.push({ kind: 'crumb', x: f.mouth.x, y: f.mouth.y, vx: (random() - 0.5) * 1.2, vy: -0.4 - random() * 0.6, life: 22, max: 22, color: GOLD })
      }
    }
    if (now.kind === 'hop' && (at(1 / 3) || at(2 / 3))) s.squashV += 0.1
    if (now.kind === 'scratch' && e % 7 === 3 && f.monster !== 'ghost') {
      s.bits.push({ kind: 'crumb', x: f.cx + f.rx * 0.95, y: f.cy + f.ry * 0.3, vx: 0.3 + random() * 0.4, vy: -0.5, life: 16, max: 16, color: mix(f.body, WHITE, 0.45) })
    }
  }

  // Petting: hearts float up, more the fonder it is, and a ring of them for a spin.
  const since = s.tick - s.petAt

  if (since >= 1 && since < PET) {
    const top = f.cy - f.ry * (f.monster === 'cookie' ? 1.3 : 1) - 2
    const above = () => [f.cx + (random() - 0.5) * f.rx * 1.2, top] as const

    if ((s.fuss === 'purr' || s.fuss === 'wiggle') && (since === 1 || since % 7 === 0)) heart(...above(), (random() - 0.5) * 0.3, -0.3)
    if (s.fuss === 'wiggle' && since === 1) heart(...above(), (random() - 0.5) * 0.5, -0.4)
    if (s.fuss === 'stir' && since === 4) heart(f.cx - f.rx * 0.5, top, -0.1, -0.2, 22)
    if (s.fuss === 'spin' && since === Math.round(PET * 0.6)) {
      s.squashV += 0.12
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2

        heart(f.cx + Math.cos(angle) * (f.rx + 3), f.cy + Math.sin(angle) * (f.ry + 2), Math.cos(angle) * 1.1, Math.sin(angle) * 0.7)
      }
    }
    if (s.fuss === 'plead' && since === 8 && f.monster !== 'slime') {
      s.bits.push({ kind: 'tear', x: f.cx - f.rx * 0.45, y: f.cy - f.ry * 0.1, vx: 0, vy: 0.2, life: 16, max: 16, color: 0x6ec6ff })
    }
  }
}

// What the antics play with, drawn over the monster: the critter, the star, the
// token, a question mark over a shrug, and the glow of a star it swallowed.
const antics = (c: Canvas, s: Scene, f: Shape) => {
  const a = s.antic

  if (a === null) return

  const p = progress(s)
  const thing = prop(s, f)

  if (a.kind === 'look' && p >= 0.62 && p < 0.97) write(c, '?', f.cx + f.rx * 0.75, f.cy - f.ry - 5, 1, WHITE, 0xc8d0e0)

  if (a.kind === 'star' && thing === null && falling(s, f).caught && p >= 0.6) {
    const fade = 1 - (p - 0.6) / 0.4

    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + f.t * 0.15

      if (hash(i, f.t >> 1) < 0.75) c.add(f.cx + Math.cos(angle) * (f.rx + 2), f.cy + Math.sin(angle) * (f.ry + 2), GOLD_LIGHT, fade)
    }
  }

  if (thing === null) return

  const { x, y } = thing

  if (a.kind === 'chase' && daylight(s.hour) < 0.4) {
    const glow = 0.6 + 0.4 * Math.sin(f.t * 0.5)

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = Math.hypot(dx, dy)

        if (d <= 2.3) c.add(x + dx, y + dy, 0xd8ff7a, (d < 1.2 ? 0.6 : 0.25) * glow)
      }
    }
    c.put(x, y, 0xf4ffc8)
  } else if (a.kind === 'chase') {
    // A butterfly: wings open and shut every other frame.
    const open = (f.t >> 1) % 2 === 0
    const wings: [number, number][] = open ? [[-2, -1], [-1, -1], [-1, 0], [1, -1], [2, -1], [1, 0]] : [[-1, -1], [1, -1]]

    for (const [dx, dy] of wings) c.put(x + dx, y + dy, Math.abs(dx) === 2 ? 0xffe066 : 0xff8a3d)
    c.put(x, y - 1, INK)
    c.put(x, y, INK)
  } else if (a.kind === 'star') {
    if (p < 0.12) {
      // It appears as a twinkle before it falls.
      const r = 1 + Math.round((p / 0.12) * 1.5)

      for (let k = -r; k <= r; k++) {
        c.add(x + k, y, 0xfff6c0, 1 - Math.abs(k) / (r + 1))
        c.add(x, y + k, 0xfff6c0, 1 - Math.abs(k) / (r + 1))
      }
    } else {
      const before = prop(s, f, p - 0.06) ?? thing
      const [dx, dy] = [x - before.x, y - before.y]

      for (let k = 1; k <= 5; k++) c.add(x - (dx * k) / 3, y - (dy * k) / 3, 0xffe9a0, 0.7 - k * 0.12)
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) c.put(x + ox, y + oy, GOLD_LIGHT)
      c.put(x, y, WHITE)
    }
  } else if (a.kind === 'juggle') {
    // A spinning gold token.
    const w = Math.max(0.5, Math.abs(Math.cos(f.t * 0.6)) * 1.6)

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = (dx / w) ** 2 + (dy / 1.7) ** 2

        if (d <= 1) c.put(x + dx, y + dy, d > 0.55 ? GOLD_DARK : dx < 0 && dy < 0 ? GOLD_LIGHT : GOLD)
      }
    }
  }
}

// Moves the scene on one frame. Idle, only breath, blinks and glances; the chew,
// the bounce, the arms and the motes run as fast as tokens arrive.
export const step = (s: Scene, width: number, height: number) => {
  s.tick += 1
  s.rate = s.rate * 0.85 + s.arrived * 0.15
  s.arrived = 0
  s.heat = 1 - Math.exp(-s.rate / 8)
  s.breathe += s.tick - s.activeAt > DOZE ? 0.02 : 0.035

  if (s.heat > 0.02) {
    s.chew += 0.15 + s.heat * 0.9
    s.bob += 0.12 + s.heat * 0.7
  }

  if (s.tick - s.blinkAt > 3 && random() < 1 / 50) s.blinkAt = s.tick

  if (s.tick >= s.gazeUntil) {
    s.gazeTo =
      s.tools.size > 0
        ? { x: 0.8, y: 0 }
        : s.busy
          ? { x: -0.5, y: -0.8 }
          : { x: (random() * 2 - 1) * 0.8, y: (random() * 2 - 1) * 0.5 }
    s.gazeUntil = s.tick + 15 + random() * 60
  }

  if (s.level > s.lastLevel) s.flashAt = s.tick
  s.lastLevel = s.level
  s.power += ((s.level > 0 ? 1 : 0) - s.power) * 0.08

  // The frenzy is a moment, not the weather: only with subagents running and the
  // rate pegged. It builds fast and burns off slower; more subagents and a combo stoke it.
  const goal = s.level > 0 ? clamp((s.heat - 0.8) / 0.2) * clamp(0.4 + s.level * 0.2 + (s.combo >= 3 ? 0.15 : 0)) : 0

  s.frenzy += (goal - s.frenzy) * (goal > s.frenzy ? 0.15 : 0.04)

  // Squash and stretch: a spring pulled back to round, kicked by bites and landings.
  if (s.tick - s.cheerAt === HOP) s.squashV += 0.14

  // A level-up crouches, launches stretched, and lands with a squash.
  const grown = s.tick - s.rankUpAt

  if (grown === 1) s.squashV += 0.2
  if (grown === 4) s.squashV -= 0.3
  if (grown === 18) s.squashV += 0.3
  s.squashV = (s.squashV + (0 - s.squash) * 0.35) * 0.7
  // Never so far that the body turns inside out.
  s.squash = clamp(s.squash + s.squashV, -0.35, 0.35)

  const f = shape(s, width, height)

  live(s, f)

  const face = mood(s, f)
  const quick = face.eyes === 'open' && f.eating ? 0.6 : 0.25

  s.lid = ease(s.lid, face.lid, 0.25)
  s.open = ease(s.open, face.open, quick)
  s.smile = ease(s.smile, face.smile, 0.2)
  s.blush = ease(s.blush, face.blush, 0.1)

  const looking = s.tick - s.typedAt < 15 || s.tick - s.perkAt < PERK ? { x: 0, y: 0.9 } : (glance(s, f) ?? s.gazeTo)

  s.gaze = { x: ease(s.gaze.x, looking.x, 0.35), y: ease(s.gaze.y, looking.y, 0.35) }

  // Googly pupils chase the gaze on a spring, and every bounce jiggles them.
  s.googlyV = {
    x: (s.googlyV.x + (s.gaze.x - s.googly.x) * 0.25) * 0.72,
    y: (s.googlyV.y + (s.gaze.y + 0.25 - s.googly.y) * 0.25 + s.squashV * 3) * 0.72,
  }
  s.googly = { x: clamp(s.googly.x + s.googlyV.x, -1, 1), y: clamp(s.googly.y + s.googlyV.y, -1, 1) }

  // Each mote carries a share of its serving; more heat, more motes a frame.
  // In a frenzy the tokens come many times thicker, from every edge.
  for (let budget = 1 + Math.round(s.heat * 5 + s.frenzy * 24); budget > 0 && s.servings.length > 0; budget--) {
    const serving = s.servings[0]!
    const bite = Math.max(25, serving.tokens / 40) / (1 + s.frenzy * 4)
    const edge = random()
    const [x, y] =
      serving.color === PROMPT
        ? [random() * width, height - 1]
        : s.frenzy > 0.2 && edge < s.frenzy * 0.5
          ? [random() * width, edge < s.frenzy * 0.25 ? 0 : height - 1]
          : [random() < 0.5 ? 0 : width - 1, 2 + random() * (f.floor - 6)]

    s.motes.push({ x, y, px: x, py: y, color: serving.color })
    serving.tokens -= bite

    if (serving.tokens <= 0) s.servings.shift()
  }

  const speed = 1.2 + s.heat * 2.2 + s.power + s.frenzy * 2
  const { mouth } = f

  let bites = 0

  s.motes = s.motes.slice(-(120 + Math.round(s.frenzy * 320))).filter(mote => {
    const [dx, dy] = [mouth.x - mote.x, mouth.y - mote.y]
    const dist = Math.hypot(dx, dy)

    if (dist < 1.5) {
      // A bite: a little squash (the kick is capped per frame below), and crumbs fly.
      bites += 1

      if (random() < 0.5) {
        s.bits.push({
          kind: 'crumb',
          x: mouth.x + (random() - 0.5) * 3,
          y: mouth.y,
          vx: (random() - 0.5) * 1.4,
          vy: -0.4 - random() * 0.8,
          life: 26,
          max: 26,
          color: mix(mote.color, 0xc68a4a, 0.4),
        })
      }

      return false
    }

    mote.px = mote.x
    mote.py = mote.y
    // A frenzy turns the stream into a vortex: tokens swirl round as they fall in.
    const swirl = dist > 4 ? s.frenzy * 0.9 : 0

    mote.x += (dx / dist) * Math.min(dist, speed) - (dy / dist) * speed * swirl
    mote.y += (dy / dist) * Math.min(dist, speed) + (dx / dist) * speed * swirl

    return true
  })

  // Hundreds of bites a frame in a frenzy must not kick the spring inside out.
  s.squashV += Math.min(0.045, bites * 0.015)

  // The moments: sparkles for a finished turn, Zs while it sleeps, tears, drool,
  // a burp's puffs, and fireflies on a quiet night.
  if (s.tick - s.cheerAt === 1) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2

      s.bits.push({
        kind: 'spark',
        x: f.cx + Math.cos(angle) * (f.rx + 3),
        y: f.cy + Math.sin(angle) * (f.ry + 3),
        vx: Math.cos(angle) * 0.3,
        vy: Math.sin(angle) * 0.3 - 0.1,
        life: 22,
        max: 22,
        color: i % 2 ? GOLD_LIGHT : WHITE,
      })
    }
  }

  if (s.finish?.text === 'K.O.' && s.tick - s.finish.at === 1) {
    for (let i = 0; i < 24; i++) {
      s.bits.push({
        kind: 'confetti',
        x: random() * width,
        y: -random() * 8,
        vx: (random() - 0.5) * 0.4,
        vy: 0.2 + random() * 0.3,
        life: 40,
        max: 40,
        color: [0xff5a5f, 0xffd23f, 0x5cff8a, 0x5cc8ff, 0xff6fd8][i % 5]!,
      })
    }
  }

  if (f.sleeping && s.tick % 28 === 0) {
    s.bits.push({ kind: 'z', x: f.cx + f.rx * 0.6, y: f.cy - f.ry, vx: 0.15, vy: -0.25, life: 50, max: 50, color: 0xdde6ff })
  }

  if (f.sad && !f.starving && !f.sleeping && s.tick % 20 === 0) {
    const side = s.tick % 40 === 0 ? -1 : 1

    s.bits.push({ kind: 'tear', x: f.cx + side * f.rx * 0.45, y: f.cy - f.ry * 0.1, vx: 0, vy: 0.3, life: 20, max: 20, color: 0x6ec6ff })
  }

  if ((f.typing || f.perking) && !f.eating && s.tick % 12 === 0) {
    s.bits.push({ kind: 'drool', x: mouth.x + f.rx * 0.2, y: mouth.y + 1, vx: 0, vy: 0.25, life: 14, max: 14, color: 0xbfe9ff })
  }

  if (f.burping && s.tick % 6 === 0 && s.bits.filter(bit => bit.kind === 'puff').length < 4) {
    s.bits.push({ kind: 'puff', x: mouth.x, y: mouth.y - 2, vx: (random() - 0.5) * 0.4, vy: -0.35, life: 24, max: 24, color: 0xd6f5c8 })
  }

  for (let i = 0; s.tick - s.comboAt === 1 && s.combo >= 2 && i < 3 + Math.min(s.combo, 9); i++) {
    s.bits.push({
      kind: 'ember',
      x: f.cx + (random() - 0.5) * f.rx * 1.6,
      y: f.cy + f.ry * 0.3,
      vx: (random() - 0.5) * 1.2,
      vy: -0.6 - random() * 0.8,
      life: 18 + random() * 12,
      max: 30,
      color: random() < 0.5 ? 0xffb02e : 0xff5a1f,
    })
  }

  if (f.blaze > 0 && random() < 0.3 + f.blaze) {
    s.bits.push({
      kind: 'ember',
      x: f.cx + (random() - 0.5) * f.rx * 2,
      y: f.cy + f.ry * 0.5,
      vx: (random() - 0.5) * 0.5,
      vy: -0.5 - random() * 0.6 * (1 + f.blaze),
      life: 16 + random() * 14,
      max: 30,
      color: random() < 0.4 ? 0xffe14a : random() < 0.7 ? 0xff8a1f : 0xff3b1f,
    })
  }

  // Growing up: stars ride the beam of a level-up and burst on the landing; the
  // egg bursts into shell shards, the monster pops out cheering, then the shell
  // it stood in breaks too.
  if (grown >= 0 && grown < 32 && random() < 0.75) {
    s.bits.push({
      kind: 'spark',
      x: f.cx + (random() - 0.5) * f.r0 * 1.6,
      y: f.floor - random() * 4,
      vx: 0,
      vy: -0.8 - random() * 0.9,
      life: 18 + random() * 10,
      max: 28,
      color: random() < 0.5 ? GOLD_LIGHT : WHITE,
    })
  }

  for (let i = 0; grown === 18 && i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2

    s.bits.push({
      kind: 'spark',
      x: f.cx + Math.cos(angle) * f.rx,
      y: f.cy + Math.sin(angle) * f.ry,
      vx: Math.cos(angle) * (0.9 + (i % 2) * 0.5),
      vy: Math.sin(angle) * (0.7 + (i % 2) * 0.4) - 0.2,
      life: 24,
      max: 24,
      color: RAINBOW[i % RAINBOW.length]!,
    })
  }

  if (f.egg === EGG_CRACK || f.egg === EGG) {
    const g = eggOf(f)
    const top = f.egg === EGG_CRACK

    if (top) {
      s.flashAt = s.tick
      s.cheerAt = s.tick
      s.squash = -0.3
    }

    // Shards show their white inside as often as their colored outside.
    for (let i = 0; i < (top ? 12 : 6); i++) {
      const angle = top ? -Math.PI * (i / 11) : Math.PI * (i / 5)
      const side = Math.cos(angle)

      s.bits.push({
        kind: 'shell',
        x: g.x + side * g.rx * 0.9,
        y: top ? g.y + Math.sin(angle) * g.ry * 0.7 : f.floor - 2,
        vx: side * (0.5 + random() * 0.7),
        vy: top ? -1 - random() * 1.1 : -0.5 - random() * 0.6,
        life: 16 + random() * 10,
        max: 26,
        color: i % 2 === 0 ? 0xf6f1e7 : g.color,
      })
    }
  }

  // The ground can't take it: debris pops up around its feet.
  for (let i = 0; s.frenzy > 0.4 && i < 2 && random() < s.frenzy; i++) {
    s.bits.push({
      kind: 'crumb',
      x: f.cx + (random() - 0.5) * f.rx * 3,
      y: f.floor - 1,
      vx: (random() - 0.5) * 1.6,
      vy: -1 - random() * 1.6 * s.frenzy,
      life: 24,
      max: 24,
      color: random() < 0.5 ? mix(0x3f8f4f, 0x1b2a3f, 1 - daylight(s.hour)) : 0x8a6a4a,
    })
  }

  const night = 1 - daylight(s.hour)

  if (night > 0.6 && !s.busy && s.bits.filter(bit => bit.kind === 'firefly').length < 3 && random() < 0.02) {
    s.bits.push({ kind: 'firefly', x: random() * width, y: f.floor - 2 - random() * 8, vx: 0, vy: 0, life: 120, max: 120, color: 0xd8ff7a })
  }

  s.bits = s.bits.slice(-160).filter(bit => {
    bit.life -= 1

    if (bit.kind === 'crumb' || bit.kind === 'confetti' || bit.kind === 'tear' || bit.kind === 'drool' || bit.kind === 'shell') {
      bit.vy += bit.kind === 'confetti' ? 0.01 : 0.12
      if (bit.kind === 'confetti') bit.vx = Math.sin((bit.life + bit.color) * 0.3) * 0.3

      if (bit.y + bit.vy >= f.floor && (bit.kind === 'crumb' || bit.kind === 'shell')) {
        bit.vy *= -0.4
        bit.vx *= 0.6
      }
    }

    if (bit.kind === 'ember') {
      bit.vy -= 0.02
      bit.vx += (random() - 0.5) * 0.2
    }

    if (bit.kind === 'heart') {
      bit.vx = bit.vx * 0.9 + Math.sin(bit.life * 0.3) * 0.04
      bit.vy = ease(bit.vy, -0.28, 0.08)
    }

    if (bit.kind === 'firefly') {
      bit.vx = ease(bit.vx, (random() - 0.5) * 0.6, 0.1)
      bit.vy = ease(bit.vy, (random() - 0.5) * 0.4, 0.1)
    }

    bit.x += bit.vx
    bit.y += bit.vy

    return bit.life > 0 && bit.y < height + 2
  })
}

class Canvas {
  readonly width: number
  readonly height: number
  readonly px: Uint32Array

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.px = new Uint32Array(width * height)
  }

  get(x: number, y: number) {
    return this.px[Math.round(y) * this.width + Math.round(x)] ?? 0
  }

  put(x: number, y: number, color: number, alpha = 1) {
    const [cx, cy] = [Math.round(x), Math.round(y)]

    if (cx >= 0 && cy >= 0 && cx < this.width && cy < this.height) {
      this.px[cy * this.width + cx] = alpha >= 1 ? color : mix(this.get(cx, cy), color, alpha)
    }
  }

  // Light added, not painted over: a glow brightens the dark sky instead of muddying it.
  add(x: number, y: number, color: number, amount: number) {
    const [cx, cy] = [Math.round(x), Math.round(y)]

    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return

    const under = this.get(cx, cy)
    const channel = (shift: number) => Math.min(255, ((under >> shift) & 255) + Math.round(((color >> shift) & 255) * amount)) << shift

    this.px[cy * this.width + cx] = channel(16) | channel(8) | channel(0)
  }

  disc(x: number, y: number, r: number, color: number, alpha = 1) {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r * r) this.put(x + dx, y + dy, color, alpha)
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: number, alpha = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))

    for (let i = 0; i <= n; i++) this.put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color, alpha)
  }

  // A solid shape, lit from the upper left in cel-shaded bands, with an outline.
  // `inside` takes coordinates normalised to the shape's radii.
  blob(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    color: number,
    inside: (nx: number, ny: number) => boolean,
    { alpha = 1, rim = INK, belly = false }: { alpha?: number; rim?: number; belly?: boolean } = {},
  ) {
    const [x0, x1] = [Math.floor(cx - rx * 1.6 - 2), Math.ceil(cx + rx * 1.6 + 2)]
    const [y0, y1] = [Math.floor(cy - ry * 1.6 - 2), Math.ceil(cy + ry * 1.6 + 2)]
    const at = (x: number, y: number) => inside((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!at(x, y)) continue

        const [nx, ny] = [(x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry]
        const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)))
        const light = -0.45 * nx - 0.55 * ny + 0.7 * nz
        let tone =
          light > 0.82 ? mix(color, WHITE, 0.32) : light > 0.5 ? mix(color, WHITE, 0.12) : light > 0.12 ? color : mix(color, BLACK, 0.3)

        if (belly && (nx / 0.55) ** 2 + ((ny - 0.38) / 0.5) ** 2 < 1) tone = mix(tone, WHITE, 0.25)
        if ((nx + 0.38) ** 2 + (ny + 0.48) ** 2 < 0.018) tone = mix(tone, WHITE, 0.7)

        const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)

        this.put(x, y, edge ? mix(color, rim, 0.75) : tone, alpha)
      }
    }
  }
}

// How light it is outside, 0 at night to 1 at noon, from the local hour.
const daylight = (hour: number) => clamp(Math.sin(((hour - 6) / 12) * Math.PI) * 1.6, 0, 1)

const SKIES: [number, number, number][] = [
  [0, 0x070b1e, 0x1d1440],
  [5, 0x0d1030, 0x3a2350],
  [6.5, 0x3a3a7a, 0xff9e7a],
  [8, 0x4a90e2, 0xb8e2ff],
  [16.5, 0x4a90e2, 0xb8e2ff],
  [18.5, 0x40306e, 0xff7e5f],
  [20, 0x141030, 0x35204f],
  [24, 0x070b1e, 0x1d1440],
]

const skyAt = (hour: number) => {
  const h = ((hour % 24) + 24) % 24
  const i = Math.max(0, SKIES.findIndex(([at]) => at > h) - 1)
  const [a, top0, bottom0] = SKIES[i]!
  const [b, top1, bottom1] = SKIES[i + 1] ?? SKIES[i]!
  const k = b === a ? 0 : (h - a) / (b - a)

  return { top: mix(top0, top1, k), bottom: mix(bottom0, bottom1, k) }
}

// The world, by the local clock: a sky, the sun or the moon, stars, clouds, hills and grass.
const world = (c: Canvas, { t, floor, hour, wave }: Shape) => {
  const { top, bottom } = skyAt(hour)
  const day = daylight(hour)
  const night = 1 - day

  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) c.px[y * c.width + x] = mix(top, bottom, y / floor)
  }

  for (let i = 0; i < 18 && night > 0.3; i++) {
    const twinkle = hash(i, Math.floor((t + i * 7) / 30)) > 0.7 ? 1 : 0.35

    c.put((i * 37 + 11) % c.width, (i * 23 + 5) % Math.max(1, floor - 8), mix(top, WHITE, twinkle * night))
  }

  // A shooting star now and then on a clear night.
  const streak = t % 260

  if (night > 0.6 && streak < 9 && hash(Math.floor(t / 260), 7) < 0.5) {
    const [sx, sy] = [c.width * 0.15 + streak * 2.5, 2 + streak * 0.7]

    for (let k = 0; k < 5; k++) c.add(sx - k * 1.2, sy - k * 0.35, 0xffffff, 0.8 - k * 0.15)
  }

  // The sun crosses by day, the moon by night.
  const sunP = (hour - 6) / 12

  if (sunP > 0 && sunP < 1) {
    const [x, y] = [c.width * (0.12 + 0.76 * sunP), floor - 6 - Math.sin(Math.PI * sunP) * (floor - 10)]

    for (let r = 6; r > 2; r--) c.disc(x, y, r, 0xffd27a, 0.08)
    c.disc(x, y, 2.6, 0xfff1b0)
  } else {
    const p = ((hour + 6) % 24) / 12
    const [x, y] = [c.width * (0.12 + 0.76 * clamp(p)), floor - 6 - Math.sin(Math.PI * clamp(p)) * (floor - 10)]

    c.disc(x, y, 2.6, 0xf2f0e6)
    c.disc(x + 1.2, y - 0.8, 2.2, mix(top, bottom, y / floor))
  }

  for (let i = 0; i < 3 && day > 0.2; i++) {
    const x = ((hash(i, 11) * c.width + t * (0.03 + 0.02 * i)) % (c.width + 16)) - 8
    const y = 3 + hash(i, 12) * (floor * 0.35)

    for (const [dx, dy, r] of [[0, 0, 2.2], [2.5, -0.8, 2.6], [5, 0, 2]] as const) c.disc(x + dx, y + dy, r, WHITE, 0.75 * day)
  }

  for (let x = 0; x < c.width; x++) {
    const far = floor - 7 - 3 * Math.sin(x * 0.13 + 1.3) - 1.5 * Math.sin(x * 0.31)
    const near = floor - 3 - 2 * Math.sin(x * 0.21 + 4)

    for (let y = Math.floor(far); y < floor; y++) c.put(x, y, mix(bottom, mix(0x1b2a3f, 0x5a7d9a, day), 0.55))
    for (let y = Math.floor(near); y < floor; y++) c.put(x, y, mix(0x16233a, 0x3f7f5a, day))
  }

  const grass = mix(0x1b2a3f, 0x3f8f4f, day)

  for (let y = floor; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) c.px[y * c.width + x] = mix(grass, BLACK, 0.12 * (y - floor))
  }

  for (let i = 0; i < c.width; i += 5) {
    const x = i + Math.floor(hash(i, 3) * 3)
    const sway = Math.sin(wave * 1.5 + i) * 0.8

    c.line(x, floor, x + sway, floor - 2 - hash(i, 4) * 2, mix(grass, WHITE, 0.15))
  }
}

// The glow is the pantry: green with room to spare, amber, then pulsing red.
const glow = (c: Canvas, { t, cx, cy, rx, ry, floor, pressure, power }: Shape, hasLimits: boolean) => {
  // In super mode the aura takes over, save a limit past red: that warning always shows.
  if (!hasLimits || (power > 0.5 && pressure < RED)) return

  const color = pressure >= RED ? 0xff3b3b : pressure >= AMBER ? 0xffb02e : 0x2fd27a
  const pulse = pressure >= RED ? 0.55 + 0.45 * Math.sin(t * 0.6) : Math.max(0, 1 - power * 2)

  for (let y = 0; y < floor; y++) {
    for (let x = 0; x < c.width; x++) {
      const d = Math.hypot((x + 0.5 - cx) / (rx + 6), (y + 0.5 - cy) / (ry + 5))

      if (d < 1) c.add(x, y, color, 0.22 * (1 - d) * pulse)
    }
  }
}

// Super mode: a golden flame aura hugging the body and licking upward, rising
// sparks, from level 2 lightning, and a flash ring when it powers up.
const aura = (c: Canvas, { t, cx, cy, rx, ry, floor, power, level }: Shape, flashAt: number) => {
  const flash = t - flashAt

  if (flash >= 0 && flash < 10) {
    const r = 3 + flash * 3

    for (let a = 0; a < 64; a++) {
      const angle = (a / 64) * Math.PI * 2

      c.add(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.8, 0xffffff, 1 - flash / 10)
    }
  }

  if (power < 0.03) return

  const reach = rx + 4 + level

  for (let y = 0; y < floor; y++) {
    for (let x = 0; x < c.width; x++) {
      const nx = (x + 0.5 - cx) / reach
      let ny = (y + 0.5 - cy) / (ry + 3)

      // Flames stand taller than they are wide.
      if (ny < 0) ny *= 0.42 + 0.06 * (3 - level)

      const d = Math.hypot(nx, ny)
      const flame = 1 + 0.22 * Math.sin(Math.atan2(ny, nx) * 9 + t * 0.9) + 0.12 * Math.sin(y * 0.9 + t * 1.4)

      if (d >= flame) continue

      const out = Math.max(0, (d - 0.55) / (flame - 0.55))
      const color = mix(0xffd000, 0xff8a00, out)

      // Painted gold at the heart, so it shows against a daytime sky too; light at the fringe.
      if (out < 0.6) c.put(x, y, mix(color, 0xfff3a0, 0.3 * (1 - out)), Math.min(1, power * 1.2) * 0.85 * (1 - out * 0.6))
      else c.add(x, y, color, power * (1 - out) * 0.9)
    }
  }

  for (let i = 0; i < 6 + level * 4; i++) {
    const x = cx + (hash(i, 3) * 2 - 1) * reach
    const y = floor - ((t * (0.6 + hash(i, 4)) + hash(i, 5) * 40) % (floor - 2))

    c.add(x, y, GOLD_LIGHT, power)
  }

  if (level >= 2 && t % 4 < 2) {
    for (let b = 0; b < level - 1; b++) {
      const side = hash(t >> 2, b) < 0.5 ? -1 : 1
      let [x, y] = [cx + side * (rx + 1 + hash(t >> 2, b + 9) * 3), cy - ry + hash(t >> 2, b + 5) * ry]

      for (let k = 0; k < 6; k++) {
        const [nx, ny] = [x + (hash(t >> 2, b * 10 + k) - 0.5) * 4 + side, y + 1.5 + hash(t >> 2, b * 20 + k) * 2]

        c.line(x, y, nx, ny, BOLT)
        x = nx
        y = ny
      }
    }
  }
}

// The combo fire: the monster engulfed in flames from the second hit, climbing
// higher and burning hotter, red to orange to white-hot, with every hit in the chain.
// A ring of tongues around the body, stretched upward; `front` draws the lower
// tongues again over its edges, so it stands in the fire rather than before it.
const blaze = (c: Canvas, { t, cx, cy, rx, ry, floor, blaze: k, flare }: Shape, front: boolean) => {
  const fire = Math.max(k, flare * 0.5)

  if (fire <= 0.01) return

  const reach = rx + 3 + fire * 4
  // Small fires hug the body; a long combo stands tall above it.
  const stretch = 0.78 - fire * 0.45

  for (let y = 0; y < floor; y++) {
    for (let x = Math.floor(cx - reach * 1.5); x <= Math.ceil(cx + reach * 1.5); x++) {
      const nx = (x + 0.5 - cx) / reach
      let ny = (y + 0.5 - cy) / (ry + 2)

      if (ny < 0) ny *= stretch

      const d = Math.hypot(nx, ny)
      const angle = Math.atan2(ny, nx)
      const tongue = 0.26 * Math.sin(angle * 7 + t * 1.2) + 0.15 * Math.sin(angle * 13 - t * 2.1) + 0.12 * Math.sin(y * 0.8 + t * 2.4)
      const limit = 1 + tongue * (0.6 + fire * 0.6) + flare * 0.15

      if (d >= limit) continue
      if (front && (y < cy + ry * 0.25 || d < 0.8)) continue

      const out = clamp((d - 0.55) / (limit - 0.55))
      const color =
        out < 0.3
          ? mix(mix(0xffb000, 0xffe680, fire * 0.5), 0xff9a00, out / 0.3)
          : out < 0.65
            ? mix(0xff8a00, 0xe8480a, (out - 0.3) / 0.35)
            : mix(0xe0400a, 0x9a1408, (out - 0.65) / 0.35)

      // The body of the flame is painted, so it stays a saturated orange whatever the
      // sky; only its fringe is added light, glowing into the dark.
      if (out < 0.7) c.put(x, y, color, (front ? 0.75 : 0.92) * (1 - out * 0.4))
      else c.add(x, y, color, 0.5 * (1 - out) * 3 * (0.5 + fire * 0.5))
    }
  }
}

// A shadow on the ground, fainter the higher it floats.
const shadow = (c: Canvas, { cx, rx, floor, lift }: Shape) => {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const k = 1 - ((x + 0.5 - cx) / rx) ** 2

    if (k > 0) c.put(x, floor, BLACK, 0.45 * k * Math.max(0.2, 1 - lift / 8))
  }
}

const HELPERS = [0xff6fd8, 0x5cc8ff, 0xffd23f, 0x5cff8a]

// One helper per running subagent: a mini of the same monster in its own color.
// They dance in sync at the sides, and by turns run over with a token and toss
// it into the big one's mouth. Pure: every move is a function of the clock.
const helpers = (c: Canvas, f: Shape, count: number) => {
  const { t, monster, cx, rx, floor, mouth, power } = f

  for (let i = 0; i < Math.min(4, count); i++) {
    const side = i % 2 === 0 ? -1 : 1
    const home = side < 0 ? 5 + (i >> 1) * 8 : c.width - 6 - (i >> 1) * 8
    const target = cx + side * (rx + 4)
    const p = ((t + i * 23) % 70) / 70
    let x = home
    let toss = -1

    if (p >= 0.5 && p < 0.65) x = ease(home, target, (p - 0.5) / 0.15)
    else if (p >= 0.65 && p < 0.75) {
      x = target
      toss = (p - 0.65) / 0.1
    } else if (p >= 0.75) x = ease(target, home, (p - 0.75) / 0.25)

    // In a frenzy they sprint laps round the big one instead.
    const lap = f.frenzy > 0.5
    const orbit = t * 0.35 + (i * Math.PI) / 2

    if (lap) {
      x = cx + Math.cos(orbit) * (rx + 7)
      toss = -1
    }

    const running = lap || (p >= 0.5 && p < 0.65) || p >= 0.75
    const beat = Math.sin(t * 0.6)
    const hop = running ? Math.abs(Math.sin(t * 1.3 + i)) * 1.5 : Math.abs(beat) * 2.5
    const float = monster === 'ghost' ? 2 + Math.sin(t * 0.2 + i) : 0
    const y = floor - 3 - hop - float - (lap ? Math.max(0, Math.sin(orbit)) * 3 : 0)
    const color = mix(HELPERS[i]!, GOLD, power * 0.3)
    const squash = hop < 0.4 && !running ? 0.15 : 0
    const facing = running ? (p < 0.65 ? -side : side) : 0
    const mini = (nx: number, ny: number) => {
      const d = Math.hypot(nx, ny)

      if (monster === 'slime') return d < 1 && ny < 0.8
      if (monster === 'ghost') return ny < 0 ? d < 1 : Math.abs(nx) < 1 && ny < 1 + 0.25 * Math.sin(nx * 6 + t * 0.6)
      if (monster === 'cookie') return d < 1 + 0.12 * Math.sin(Math.atan2(ny, nx) * 9)
      if (monster === 'crab') return d < 1 && ny > -0.55

      return d < 1
    }

    c.blob(x, y, 3.2 * (1 + squash), 2.9 * (1 - squash), color, mini)

    if (monster === 'gremlin') {
      c.put(x - 2, y - 3.5, 0xeadfc8)
      c.put(x + 2, y - 3.5, 0xeadfc8)
    }

    if (monster === 'crab') {
      // Two little pincers up, and legs.
      for (const side of [-1, 1]) {
        c.put(x + side * 4, y - 2, mix(color, INK, 0.2))
        c.put(x + side * 4.5, y - 3, mix(color, INK, 0.2))
        c.put(x + side * 3.5, y - 3, mix(color, INK, 0.2))
        c.put(x + side * 3, y + 2.5, mix(color, INK, 0.4))
      }
    }

    // Dancing arms, up on the beat; carrying arms reach up to the token.
    const armUp = running || toss >= 0 ? 1 : beat > 0 ? 1 : 0

    if (monster !== 'ghost') {
      c.put(x - 3.5, y - armUp * 1.5, mix(color, INK, 0.3))
      c.put(x + 3.5, y - (1 - armUp) * 1.5 - (running ? 1.5 : 0), mix(color, INK, 0.3))
    }

    // Eyes look the way it runs, or at you while it dances.
    const [ey, gaze] = [monster === 'cookie' ? y - 2.5 : y - 0.8, facing * 0.6]

    c.put(x - 1, ey, WHITE)
    c.put(x + 1, ey, WHITE)
    c.put(x - 1 + gaze, ey + 0.4, INK)
    c.put(x + 1 + gaze, ey + 0.4, INK)

    if (p >= 0.5 && p < 0.65) {
      c.disc(x, y - 4.5, 1, TEXT)
      c.add(x, y - 4.5, 0xffffff, 0.4)
    }

    if (toss >= 0) {
      const [tx, ty] = [ease(x, mouth.x, toss), ease(y - 4.5, mouth.y, toss) - Math.sin(Math.PI * toss) * 6]

      c.disc(tx, ty, 1, TEXT)
      c.add(tx, ty, 0xffffff, 0.5)
    }
  }
}

// What the arms do: hang and sway, shovel food in, rub hands while you type,
// hold the chin while thinking, punch the air for a finished turn, brace in super mode.
const limbs = (c: Canvas, f: Shape, s: Scene) => {
  const { monster, cx, cy, rx, ry, r0, t, body, floor, feet } = f
  const thick = Math.max(1.2, r0 * 0.15)
  const length = r0 * 0.6

  if (feet > 0 && monster !== 'crab') {
    for (const side of [-1, 1]) {
      const tap = f.thinking && side === 1 && t % 10 < 3 ? 1 : 0
      const fx = cx + side * rx * 0.42
      const fy = Math.min(floor - 1, cy + ry + feet * 0.6) - tap

      c.blob(fx, fy, rx * 0.26, feet * 1.1, mix(body, BLACK, 0.15), (nx, ny) => nx * nx + ny * ny < 1)
    }
  }

  if (monster === 'ghost') return

  const crab = monster === 'crab'

  for (const side of [-1, 1]) {
    const [ax, ay] = [cx + side * rx * (crab ? 0.9 : 0.86), cy + ry * (crab ? -0.1 : 0.1)]
    // A crab holds its claws up and out, as in the CrabStack mark.
    const rest = crab
      ? { x: ax + side * length * 0.7, y: ay - length * 0.75 + Math.sin(f.wave + side) * 0.5 }
      : { x: ax + side * length * 0.45, y: ay + length * 0.8 + Math.sin(f.wave + side) * 0.5 }
    const mouthSpot = { x: f.mouth.x + side * rx * 0.35, y: f.mouth.y + 1 }
    const up = { x: ax + side * length * 0.7, y: ay - length * 1.05 + Math.sin(t * 0.8 + side) * 0.8 }
    const posed = pose(s, f, side, ax, ay, length, rest)
    let hand = rest

    if (f.cheering || f.leveling || (s.finish?.text === 'K.O.' && t - s.finish.at < 30)) hand = up
    else if (f.frenzy > 0.5) {
      // Flailing: each hand whirls on its own wild loop.
      const whirl = t * 1.9 + (side > 0 ? Math.PI : 0)

      hand = { x: ax + side * length * (0.55 + 0.45 * Math.cos(whirl)), y: ay - length * 0.9 * Math.sin(whirl * 1.3) }
    } else if (f.power > 0.5) hand = { x: ax + side * length * 0.75, y: ay + length * 0.45 + (hash(t, side) - 0.5) }
    else if (f.eating) {
      // Hands take turns shoveling.
      const scoop = Math.max(0, Math.sin(s.chew * 0.5 + (side > 0 ? Math.PI : 0)))

      hand = { x: ease(rest.x, mouthSpot.x, scoop), y: ease(rest.y, mouthSpot.y, scoop) }
    } else if (posed !== null) hand = posed
    else if (f.typing || f.perking) {
      const rub = Math.sin(t * 1.2) * side * 0.8

      hand = { x: cx + side * rx * 0.25 + rub, y: cy + ry * 0.6 }
    } else if (f.thinking && side === 1) hand = { x: f.mouth.x + rx * 0.3, y: f.mouth.y + ry * 0.28 }
    else if (f.sleeping) hand = { x: ax + side * length * 0.2, y: ay + length * 0.7 }

    if (crab) {
      // However small the pane, the whole pincer stays on screen.
      const reach = thick * 3.8

      hand = {
        x: side > 0 ? Math.min(hand.x, c.width - 1 - reach) : Math.max(hand.x, reach),
        y: Math.max(hand.y, reach),
      }
    }

    const arm = mix(body, BLACK, 0.08)
    const steps = Math.ceil(Math.hypot(hand.x - ax, hand.y - ay) * 2)

    for (let k = 0; k <= steps; k++) {
      const p = k / Math.max(1, steps)

      c.disc(ease(ax, hand.x, p), ease(ay, hand.y, p), thick + 0.6, mix(arm, INK, 0.75))
    }
    for (let k = 0; k <= steps; k++) {
      const p = k / Math.max(1, steps)

      c.disc(ease(ax, hand.x, p), ease(ay, hand.y, p), thick, arm)
    }

    if (crab) {
      // Pincers: they snap as it eats, gape when it cheers, and rest half open.
      const gape = f.eating ? Math.abs(Math.sin(s.chew)) : f.cheering ? 1 : 0.45 + 0.15 * Math.sin(t * 0.1 + side)

      claw(c, hand.x, hand.y, side, gape, thick, arm)
    } else {
      c.blob(hand.x, hand.y, thick * 1.35, thick * 1.35, mix(arm, WHITE, 0.08), (nx, ny) => nx * nx + ny * ny < 1)
    }
  }
}

// A crab's pincer at (x, y), pointing up and out on `side`: a heavy upper jaw and a
// thinner lower one, `gape` 0 shut to 1 wide open.
const claw = (c: Canvas, x: number, y: number, side: number, gape: number, thick: number, color: number) => {
  const toward = side > 0 ? -Math.PI / 3 : (-2 * Math.PI) / 3
  const reach = thick * 3.8

  c.blob(x, y, thick * 1.6, thick * 1.4, mix(color, WHITE, 0.08), (nx, ny) => nx * nx + ny * ny < 1)

  for (const [jaw, width] of [[-1, 0.62], [1, 0.45]] as const) {
    const angle = toward + jaw * side * (0.3 + gape * 0.5)

    for (let k = 0; k <= 8; k++) {
      const p = k / 8
      // Each jaw curves a little back toward the other at its tip.
      const bend = angle - jaw * side * p * p * 0.3
      const [jx, jy] = [x + Math.cos(bend) * reach * p, y + Math.sin(bend) * reach * p]

      c.disc(jx, jy, thick * width * (1 - p * 0.6) + 0.35, mix(color, INK, 0.55))
      c.disc(jx, jy, thick * width * (1 - p * 0.6), p > 0.8 ? mix(color, WHITE, 0.3) : mix(color, WHITE, 0.08))
    }
  }
}

// The body: bigger as the context fills, thinner when starving, each monster its own shape.
const torso = (c: Canvas, f: Shape) => {
  const { monster, cx, cy, rx, ry, body, wave, t } = f

  if (monster === 'gremlin') {
    // Tail first, behind: a curl that wags, with an arrow tip.
    const wag = Math.sin(t * (f.eating ? 0.6 : 0.15)) * 0.6

    for (let k = 0; k <= 12; k++) {
      const p = k / 12
      const [x, y] = [cx + rx * (0.7 + p * 0.9), cy + ry * (0.6 - p * 0.9 + Math.sin(p * 3 + wag) * 0.2)]

      c.disc(x, y, 1.1, mix(body, BLACK, 0.25))
      if (k === 12) c.disc(x + 0.5, y - 0.8, 1.6, mix(body, BLACK, 0.35))
    }
  }

  if (monster === 'crab') {
    // Three legs a side, behind the shell: out to a knee, then down to the ground,
    // stepping in turn as it shuffles or eats.
    const leg = mix(body, BLACK, 0.18)

    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const step = Math.sin(wave * 2.4 + k * 2.1 + (side > 0 ? 1 : 0)) * (f.eating ? 1.2 : 0.8)
        const [ax, ay] = [cx + side * rx * (0.82 - k * 0.12), cy + ry * (0.15 + k * 0.28)]
        const [kx, ky] = [ax + side * rx * (0.32 + k * 0.06), ay - ry * (0.3 - k * 0.12) + step * 0.3]
        // Feet hang the same way below the shell, so they leave the ground when it does.
        const [fx, fy] = [kx + side * rx * (0.16 + k * 0.05) + step, cy + ry + f.feet - 1]

        for (const [x0, y0, x1, y1] of [[ax, ay, kx, ky], [kx, ky, fx, fy]] as const) {
          for (let p = 0; p <= 1; p += 0.08) c.put(ease(x0, x1, p), ease(y0, y1, p), leg)
        }
      }
    }
  }

  const shapeOf = (nx: number, ny: number) => {
    const angle = Math.atan2(ny, nx)
    const d = Math.hypot(nx, ny)

    // The shell rises in three bumps along its top edge, as in the CrabStack mark.
    if (monster === 'crab') return d < 1 + (ny < 0 ? 0.12 * Math.max(0, Math.cos(nx * 7.5)) * -ny : 0)

    if (monster === 'cookie') return d < 1 + 0.06 * Math.sin(angle * 14 + wave * 2) + 0.04 * (hash(Math.floor(angle * 9 + 40)) - 0.5)
    if (monster === 'slime') {
      const sx = ny > 0 ? nx / (1 + 0.32 * ny) : nx

      return Math.hypot(sx, ny) < 1 && ny < 0.9
    }
    if (monster === 'ghost') return ny < 0 ? d < 1 : Math.abs(nx) < 1 && ny < 1.05 + 0.2 * Math.sin(nx * 9 + wave * 4)

    return d < 1
  }

  c.blob(cx, cy, rx, ry, body, shapeOf, {
    alpha: monster === 'ghost' ? 0.88 : 1,
    belly: monster === 'cookie' || monster === 'gremlin' || monster === 'crab',
  })

  if (monster === 'crab') {
    // Speckles on the shell.
    for (let i = 0; i < 5; i++) {
      const [x, y] = [cx + (hash(i, 31) - 0.5) * rx * 1.3, cy - ry * (0.2 + hash(i, 32) * 0.5)]

      c.put(x, y, mix(body, WHITE, 0.35))
    }
  }

  if (monster === 'slime') {
    // Bubbles rising inside the jelly.
    for (let i = 0; i < 4; i++) {
      const p = ((t * 0.02 + hash(i, 21)) % 1 + 1) % 1
      const [x, y] = [cx + (hash(i, 22) - 0.5) * rx * 1.1, cy + ry * (0.7 - p * 1.3)]

      if (shapeOf((x - cx) / rx, (y - cy) / ry)) c.disc(x, y, 0.8 + hash(i, 23), mix(body, WHITE, 0.45), 0.7)
    }
  }

  if (monster === 'gremlin') {
    for (const side of [-1, 1]) {
      // Pointed ears that twitch now and then.
      const twitch = hash(Math.floor(t / 40), side + 5) < 0.15 && t % 40 < 3 ? -1 : 0
      const [bx, by] = [cx + side * rx * 0.85, cy - ry * 0.35]
      const [tx, ty] = [cx + side * rx * 1.45, cy - ry * 0.7 + twitch]

      for (let k = 0; k <= 1; k += 0.1) {
        const half = 2.2 * (1 - k)

        for (let d = -half; d <= half; d += 0.5) c.put(ease(bx, tx, k), ease(by, ty, k) + d, k > 0.85 ? mix(body, INK, 0.6) : mix(body, BLACK, 0.12))
      }

      // Horns.
      const [hx, hy] = [cx + side * rx * 0.75, cy - ry * 1.3]
      const [fx, fy] = [cx + side * rx * 0.42, cy - ry * 0.75]

      for (let y = Math.floor(hy); y <= fy; y++) {
        const p = (y - hy) / (fy - hy)
        const x = hx + (fx - hx) * p

        for (let dx = -2 * p; dx <= 2 * p; dx++) c.put(x + dx, y, mix(0xeadfc8, BLACK, 0.25 * p))
      }
    }
  }
}

// Super mode hair: golden spikes, longer each level, swaying in the aura.
const hair = (c: Canvas, { t, cx, cy, rx, ry, r0, power, level }: Shape) => {
  if (power < 0.3) return

  const spikes = 5
  // Capped to the monster's size, so a narrow pane still shows a monster, not a haircut.
  const length = Math.min((2 + level * 3) * power, cy - ry - 1, r0 * 0.9)

  for (let i = 0; i < spikes; i++) {
    const offset = (i - (spikes - 1) / 2) / ((spikes - 1) / 2)
    const [bx, by] = [cx + offset * rx * 0.7, cy - ry * Math.sqrt(1 - offset * offset * 0.49) + 1]
    const tall = length * (i === 2 ? 1.4 : 1 - Math.abs(offset) * 0.2)
    const sway = Math.sin(t * 0.3 + i) * 0.6
    const [tx, ty] = [bx + offset * tall * 0.6 + sway, by - tall]

    for (let k = 0; k <= 1; k += 1 / Math.max(2, tall * 2)) {
      const half = 2.2 * (1 - k)
      const [x, y] = [bx + (tx - bx) * k, by + (ty - by) * k]

      for (let dx = -half; dx <= half; dx += 0.5) {
        c.put(x + dx, y, Math.abs(dx) > half - 0.6 ? GOLD_DARK : dx < 0 ? GOLD_LIGHT : GOLD)
      }
    }
  }
}

// One eye: white, an iris that looks where the monster looks, a pupil, two
// catchlights, and a lid that closes from the top.
// `big`: pleading, with wide pupils and a wet shine.
const eye = (c: Canvas, x: number, y: number, r: number, look: { x: number; y: number }, lid: number, f: Shape, iris: number, big = false) => {
  const superEyes = f.power > 0.5
  const sclera = f.monster === 'ghost' ? 0x1a1030 : f.monster === 'gremlin' && !superEyes ? 0xffe14d : WHITE

  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      const d = Math.hypot(dx, dy)

      if (d > r) continue
      c.put(x + dx, y + dy, d > r - 0.7 ? mix(sclera, INK, 0.55) : dy < -r * 0.45 ? mix(sclera, 0x8a90b0, 0.25) : sclera)
    }
  }

  const ir = r * (f.monster === 'cookie' ? 0.58 : 0.62) * (big ? 1.2 : 1)
  const [ix, iy] = [x + look.x * Math.max(0, r - ir - 0.4), y + look.y * Math.max(0, r - ir - 0.4)]

  if (big) {
    // Wide, wet pupils and two big shines: the look that gets it fed.
    c.disc(ix, iy, ir, f.monster === 'ghost' ? 0x8f9fff : INK)
    c.disc(ix - ir * 0.35, iy - ir * 0.35, Math.max(0.7, ir * 0.38), WHITE)
    c.put(ix + ir * 0.4, iy + ir * 0.35, WHITE)
    for (let dx = -ir * 0.6; dx <= ir * 0.6; dx += 0.5) c.put(ix + dx, iy + ir * 0.75, 0x9fd8ff, 0.7)
  } else if (f.monster === 'gremlin' && !superEyes) {
    for (let k = -ir; k <= ir; k += 0.5) c.put(ix, iy + k, INK)
  } else if (f.monster === 'cookie' && !superEyes) {
    // Googly: one solid black pupil with a shine.
    c.disc(ix, iy, ir, INK)
    c.disc(ix - ir * 0.35, iy - ir * 0.4, Math.max(0.6, ir * 0.3), WHITE)
  } else if (f.monster === 'ghost') {
    c.disc(ix, iy, ir * 0.8, superEyes ? TEAL : f.eating ? 0x7ff6ff : 0x8f9fff)
    c.add(ix, iy, 0xffffff, 0.5)
  } else {
    const color = superEyes ? TEAL : iris

    c.disc(ix, iy, ir, mix(color, BLACK, 0.15))
    c.disc(ix, iy + ir * 0.2, ir * 0.7, color)
    c.disc(ix, iy, ir * 0.48, INK)
    c.disc(ix - ir * 0.4, iy - ir * 0.45, Math.max(0.6, ir * 0.3), WHITE)
    c.put(ix + ir * 0.4, iy + ir * 0.4, WHITE)
  }

  if (lid > 0.02) {
    const cut = y - r + lid * 2 * r

    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = Math.hypot(dx, dy)

        if (d > r || y + dy > cut) continue
        c.put(x + dx, y + dy, Math.abs(y + dy - cut) < 0.8 || d > r - 0.7 ? mix(f.body, INK, 0.7) : mix(f.body, BLACK, 0.1))
      }
    }
  }
}

// The face: eyes, brows, cheeks and the mouth, with tears, drool and the rest.
const face = (c: Canvas, f: Shape, s: Scene) => {
  const { t, monster, cx, cy, rx, ry, r0, body } = f
  const m = mood(s, f)
  const eyes: [number, number, number][] =
    monster === 'slime'
      ? [[cx, cy - ry * 0.28, 0]]
      : monster === 'crab'
        ? [[cx - rx * 0.3, cy - ry * 1.45, -1], [cx + rx * 0.3, cy - ry * 1.45, 1]]
        : monster === 'cookie'
          ? [[cx - rx * 0.32, cy - ry * 0.8, -1], [cx + rx * 0.32, cy - ry * 0.8, 1]]
          : [[cx - rx * 0.34, cy - ry * 0.22, -1], [cx + rx * 0.34, cy - ry * 0.22, 1]]
  const re = eyeSize(f)
  const look = monster === 'cookie' ? s.googly : s.gaze
  const lid = m.eyes === 'open' ? Math.max(s.lid, f.blink ? 1 : 0) : 0
  const iris = { cookie: INK, slime: 0x1e5a32, ghost: 0x8f9fff, gremlin: INK, crab: INK }[monster] ?? 0x6a3b1f

  if (monster === 'crab') {
    // Eye stalks, from the shell up to each eye.
    for (const [ex, ey] of eyes) {
      for (let y = ey; y <= cy - ry * 0.75; y += 0.5) {
        c.put(ex - 0.6, y, mix(body, INK, 0.5))
        c.put(ex + 0.6, y, mix(body, INK, 0.5))
        c.put(ex, y, mix(body, BLACK, 0.1))
      }
    }
  }

  // Cheeks first, so the eyes sit over them.
  if (monster !== 'ghost' && s.blush > 0.05) {
    for (const side of [-1, 1]) {
      const [bx, by] = [cx + side * rx * 0.55, cy + ry * 0.14]

      for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx / 5 + dy * dy / 1.5 < 1) c.put(bx + dx, by + dy, BLUSH, 0.6 * s.blush)
    }
  }

  for (const [ex, ey, side] of eyes) {
    if (m.eyes === 'dizzy') {
      c.disc(ex, ey, re, WHITE)
      for (let a = 0; a < 20; a++) {
        const angle = (a / 20) * Math.PI * 2 + t * 0.4
        const rr = re * (0.25 + 0.5 * (a / 20))

        c.put(ex + Math.cos(angle) * rr, ey + Math.sin(angle) * rr, INK)
      }
    } else if (m.eyes === 'happy' || m.eyes === 'closed') {
      // ^ ^ for joy, a sleepy curve for rest. The cookie's and the crab's eyes stand
      // above the head: joy keeps their whites, and sleep closes them as lidded balls,
      // so neither vanishes into the sky.
      if (monster === 'cookie' || monster === 'crab') {
        if (m.eyes === 'happy') c.disc(ex, ey, re, WHITE)
        else {
          c.disc(ex, ey, re, mix(body, INK, 0.6))
          c.disc(ex, ey, re - 0.7, mix(body, WHITE, 0.15))
        }
      }

      for (let dx = -re; dx <= re; dx += 0.5) {
        const curve = (1 - (dx / re) ** 2) * re * 0.55

        c.put(ex + dx, ey + (m.eyes === 'happy' ? -curve + re * 0.2 : curve - re * 0.2), INK)
        c.put(ex + dx, ey + (m.eyes === 'happy' ? -curve + re * 0.2 + 1 : curve - re * 0.2 + 1), INK, 0.5)
      }
    } else if (m.eyes === 'squeeze') {
      // The point of each chevron faces the nose: > on the left eye, < on the right.
      const dir = side === 0 ? 1 : -side

      // Screwed shut: > < over the whites, so the face still reads.
      if (monster !== 'ghost') c.disc(ex, ey, re, WHITE)

      c.line(ex - re * 0.8 * dir, ey - re * 0.6, ex + re * 0.6 * dir, ey, INK)
      c.line(ex + re * 0.6 * dir, ey, ex - re * 0.8 * dir, ey + re * 0.6, INK)
    } else {
      eye(c, ex, ey, re, look, lid, f, iris, m.eyes === 'plead')
    }

    if (m.brows !== 'none' && side !== 0) {
      for (let dx = -re; dx <= re; dx += 0.5) {
        const inner = (dx * -side) / re
        const by = ey - re - 1.4 + inner * (m.brows === 'fierce' ? 1.3 : -1.3)

        c.put(ex + dx, by, mix(body, INK, 0.85))
        c.put(ex + dx, by - 0.6, mix(body, INK, 0.85))
      }
    }
  }

  mouth(c, f, s)
}

// Mouth: a smile or a frown when shut, chomping open as tokens arrive, teeth and a tongue.
const mouth = (c: Canvas, f: Shape, s: Scene) => {
  const { monster, rx, ry } = f
  const { x: mx, y: my } = f.mouth
  const open = clamp(s.open)
  const mw = rx * (monster === 'slime' ? 0.3 : 0.42) * (0.8 + 0.2 * open)
  const mh = 0.6 + open * ry * 0.55

  if (mh < 1.3) {
    // Shut: a curve that smiles or frowns, thinner toward the corners.
    for (let dx = -mw; dx <= mw; dx += 0.5) {
      const y = my + s.smile * 4 * (1 - (dx / mw) ** 2) - s.smile * 2

      c.put(mx + dx, y, INK)
      if (Math.abs(dx) < mw * 0.45) c.put(mx + dx, y - Math.sign(s.smile) * 0.6, INK, 0.45)
    }

    return
  }

  for (let y = Math.floor(my - mh); y <= Math.ceil(my + mh); y++) {
    for (let x = Math.floor(mx - mw); x <= Math.ceil(mx + mw); x++) {
      const [nx, ny] = [(x + 0.5 - mx) / mw, (y + 0.5 - my) / mh]
      // Smiling lifts the corners: the top edge bows down in the middle.
      const top = -1 + s.smile * 0.25 * (1 - nx * nx)

      if (ny < top || nx * nx + ny * ny >= 1) continue

      const edge = nx * nx + ny * ny > 0.75 || ny < top + 0.25
      const tooth = ny < top + 0.45 && x % 2 === 0 && (monster === 'cookie' || monster === 'gremlin')
      let color = ny > 0.3 ? mix(TONGUE, WHITE, ny > 0.55 && nx < 0 ? 0.2 : 0) : MOUTH

      if (tooth) color = WHITE
      if (edge && !tooth) color = mix(MOUTH, INK, 0.6)
      c.put(x, y, color)
    }
  }

  if (monster === 'gremlin') {
    for (const side of [-0.55, 0.55]) for (let k = 0; k < 3; k++) c.put(mx + side * mw, my - mh + 1 + k, WHITE)
  }
}

// The little things in the air: crumbs, sparkles, confetti, Zs, tears, drool, puffs, fireflies.
const bits = (c: Canvas, s: Scene) => {
  for (const bit of s.bits) {
    const fade = bit.life / bit.max

    if (bit.kind === 'spark') {
      const r = 1 + fade * 1.5

      c.add(bit.x, bit.y, bit.color, fade)
      c.add(bit.x - r, bit.y, bit.color, fade * 0.6)
      c.add(bit.x + r, bit.y, bit.color, fade * 0.6)
      c.add(bit.x, bit.y - r, bit.color, fade * 0.6)
      c.add(bit.x, bit.y + r, bit.color, fade * 0.6)
    } else if (bit.kind === 'z') {
      const size = fade > 0.5 ? 3 : 2

      for (let k = 0; k < size; k++) {
        c.put(bit.x + k, bit.y, bit.color, fade)
        c.put(bit.x + k, bit.y + size - 1, bit.color, fade)
        c.put(bit.x + size - 1 - k, bit.y + k, bit.color, fade)
      }
    } else if (bit.kind === 'puff') {
      c.disc(bit.x, bit.y, 1.2 + (1 - fade) * 2, bit.color, 0.5 * fade)
    } else if (bit.kind === 'ember') {
      c.add(bit.x, bit.y, bit.color, Math.min(1, fade * 1.5))
    } else if (bit.kind === 'firefly') {
      const glow = 0.5 + 0.5 * Math.sin(bit.life * 0.3)

      c.add(bit.x, bit.y, bit.color, 0.9 * glow * Math.min(1, fade * 4))
    } else if (bit.kind === 'heart') {
      // Five wide while fresh, three as it fades.
      const rows = bit.max >= 24 && fade > 0.35 ? ['.X.X.', 'XXXXX', '.XXX.', '..X..'] : ['X.X', 'XXX', '.X.']
      const [x0, y0] = [Math.round(bit.x) - (rows[0]!.length >> 1), Math.round(bit.y) - 1]

      rows.forEach((row, dy) =>
        [...row].forEach((cell, dx) => {
          if (cell !== 'X') return

          const tone = dy === 0 || (dy === 1 && dx === 1) ? mix(bit.color, WHITE, 0.45) : dy === rows.length - 1 ? mix(bit.color, BLACK, 0.25) : bit.color

          c.put(x0 + dx, y0 + dy, tone, Math.min(1, fade * 2.5))
        }),
      )
    } else {
      c.put(bit.x, bit.y, bit.color, bit.kind === 'crumb' ? Math.min(1, fade * 2) : 1)
      if (bit.kind === 'shell') {
        c.put(bit.x + 1, bit.y, mix(bit.color, BLACK, 0.25))
        c.put(bit.x, bit.y + 1, mix(bit.color, BLACK, 0.4))
      }
    }
  }
}

// A 3x5 pixel font for the fight HUD, one row of three bits a line.
const GLYPHS: Record<string, number[]> = {
  '0': [7, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7],
  '2': [7, 1, 7, 4, 7],
  '3': [7, 1, 7, 1, 7],
  '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7],
  '6': [7, 4, 7, 5, 7],
  '7': [7, 1, 1, 2, 2],
  '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 7],
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
  '.': [0, 0, 0, 0, 2],
  '?': [7, 1, 3, 0, 2],
  ' ': [0, 0, 0, 0, 0],
}

// Text with a dark outline, the top rows `fill` and the bottom rows `shade`.
const write = (c: Canvas, text: string, x0: number, y0: number, scale: number, fill: number, shade: number) => {
  const cells: [number, number, number][] = []

  ;[...text].forEach((char, i) => {
    ;(GLYPHS[char] ?? GLYPHS[' ']!).forEach((row, y) => {
      for (let x = 0; x < 3; x++) if (row & (4 >> x)) cells.push([x0 + (i * 4 + x) * scale, y0 + y * scale, y])
    })
  })

  for (const [x, y] of cells) {
    for (let dy = -1; dy <= scale; dy++) for (let dx = -1; dx <= scale; dx++) c.put(x + dx, y + dy, INK)
  }
  for (const [x, y, row] of cells) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) c.put(x + dx, y + dy, row < 3 ? fill : shade)
  }
}

// The fight HUD: the finish of a combo, and a counter for a failed call.
const hud = (c: Canvas, s: Scene) => {
  if (s.finish !== null && s.tick - s.finish.at < 18 && (s.tick - s.finish.at) % 6 < 5) {
    const big = s.finish.text === 'K.O.'
    const scale = big ? 2 : 1
    const width = s.finish.text.length * 4 * scale - scale

    // K.O. big and centered; COUNTER small in the top corner, clear of the face.
    write(
      c,
      s.finish.text,
      big ? Math.round((c.width - width) / 2) : c.width - width - 2,
      big ? 3 : 2,
      scale,
      big ? 0xff3b3b : 0xffe04d,
      big ? 0xb3122e : 0xff7a1a,
    )
  }
}

// What it wears as it grows up. Each part stays once earned; the crown takes the cap's place.
export const WARDROBE = [
  { level: 3, key: 'bow', part: 'a bow tie' },
  { level: 6, key: 'cap', part: 'a propeller cap' },
  { level: 10, key: 'crown', part: 'a crown' },
  { level: 15, key: 'cape', part: 'a cape' },
  { level: 25, key: 'halo', part: 'a halo' },
] as const

// The level each part unlocks at, by key: the one place those levels live.
const UNLOCK = Object.fromEntries(WARDROBE.map(one => [one.key, one.level])) as Record<(typeof WARDROBE)[number]['key'], number>

const eyeSize = ({ r0, monster }: Shape) =>
  Math.max(2, r0 * (monster === 'slime' ? 0.42 : monster === 'cookie' ? 0.34 : monster === 'crab' ? 0.3 : 0.26))

// Hand-drawn parts, one character a pixel and '.' clear, set bottom-centered on
// (x, y); every clear pixel touching a drawn one is the outline.
const sprite = (c: Canvas, rows: readonly string[], x: number, y: number, colors: Record<string, number>) => {
  const [w, h] = [rows[0]!.length, rows.length]
  const [x0, y0] = [Math.round(x - (w - 1) / 2), Math.round(y) - h + 1]
  const at = (i: number, j: number) => (rows[j]?.[i] ?? '.') !== '.'

  for (let j = -1; j <= h; j++) {
    for (let i = -1; i <= w; i++) {
      if (at(i, j)) c.put(x0 + i, y0 + j, colors[rows[j]![i]!] ?? WHITE)
      else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) c.put(x0 + i, y0 + j, INK, 0.9)
    }
  }
}

const BOW_TIE = {
  small: ['LM...MD', 'LMMKMMD', 'MD...DD'],
  big: ['LL.....MD', 'LMM...MMD', 'LMMMKMMMD', 'MMD...DDD', 'MD.....DD'],
}
const CAP = {
  small: ['..RYB..', '.WRYBB.', 'RRRYBBb', 'rrryybb'],
  big: ['...RYB...', '..WRYBB..', '.WRRYBBb.', 'RRRRYBBBb', 'rrrryyybb'],
}
const CROWN = {
  small: ['W..W..W', 'L..G..D', 'LL.R.DD', 'LGGGGGD', 'DDDDDDD'],
  big: ['W...W...W', 'L...G...D', 'LL.GRG.DD', 'LLGGGGGDD', 'LRGGBGGRD', 'DDDDDDDDD'],
}

// Where a hat sits: on top of the head, or on the cookie, up on its eye stalks.
const headTop = (f: Shape) => ({
  x: f.cx,
  y: f.monster === 'cookie' ? f.cy - f.ry * 0.8 - eyeSize(f) : f.cy - f.ry * 0.9,
})

// A cape behind the body: from the shoulders to the ground, swaying as it breathes
// and billowing out behind while it eats, hops or flies.
const cape = (c: Canvas, f: Shape) => {
  const { cx, cy, rx, ry, floor, wave, t } = f
  const color = f.reddish ? 0x2c3fd6 : 0xc8203c
  const top = cy - ry * 0.6
  const bottom = Math.min(floor - 1, cy + ry * 1.1)
  const billow = Math.min(1, f.lift / 6 + f.heat * 0.6)

  for (let y = Math.floor(top); y <= Math.ceil(bottom) + 1; y++) {
    const p = clamp((y - top) / Math.max(1, bottom - top))
    const sway = Math.sin(wave * 1.6 + p * 2.2) * p * (1 + billow) * 1.2
    const half = rx * (0.9 + p * (0.45 + billow * 0.35))

    for (let x = Math.floor(cx - half - 2); x <= Math.ceil(cx + half + 2); x++) {
      const nx = (x + 0.5 - cx - sway) / half
      const hem = bottom + Math.sin(x * 0.9 + t * 0.15) * 0.8

      if (Math.abs(nx) >= 1 || y > hem) continue

      const edge = Math.abs(nx) > 1 - 1.2 / half || y > hem - 1
      const fold = Math.sin(nx * 7 + wave * 1.2) > 0.55
      const tone = edge ? mix(color, INK, 0.65) : fold ? mix(color, BLACK, 0.25) : nx < -0.3 ? mix(color, WHITE, 0.12) : color

      c.put(x, y, tone)
    }
  }

  // Gold clasps at the shoulders.
  for (const side of [-1, 1]) c.disc(cx + side * rx * 0.78, top + 2, Math.max(0.8, rx * 0.08), GOLD)
}

// The propeller on the cap spins as it eats, and flat out in a level-up.
const propeller = (c: Canvas, x: number, y: number, f: Shape, size: number) => {
  const spin = f.t * (0.25 + f.heat * 1.2 + (f.leveling ? 1.5 : 0))
  const reach = size * Math.cos(spin)

  c.put(x, y + 1, INK)
  c.line(x, y, x + reach, y, 0xff5a5f)
  c.line(x, y, x - reach, y, 0x5cc8ff)
  c.put(x, y, GOLD)
}

const halo = (c: Canvas, x: number, y: number, rx: number, t: number) => {
  const ry = Math.max(1, rx * 0.3)
  const bob = Math.sin(t * 0.15) * 0.7
  const shine = 0.75 + 0.25 * Math.sin(t * 0.3)

  for (let dy = -Math.ceil(ry) - 2; dy <= Math.ceil(ry) + 2; dy++) {
    for (let dx = -Math.ceil(rx) - 2; dx <= Math.ceil(rx) + 2; dx++) {
      const d = Math.hypot(dx / rx, dy / ry)
      const ring = Math.abs(d - 1) * Math.min(rx, ry * 2)

      if (ring < 0.7) c.add(x + dx, y + dy + bob, 0xfff1a8, shine)
      else if (ring < 2) c.add(x + dx, y + dy + bob, 0xffd23f, 0.35 * shine * (1 - (ring - 0.7) / 1.3))
    }
  }
}

// Everything it has earned, drawn before the face so the eyes and mouth stay on top.
// `back` is the cape, behind the body; the rest go on after the body and the hair.
const wear = (c: Canvas, f: Shape, back: boolean) => {
  const { rank, rx, ry, cx, cy, t, monster } = f
  const size = f.r0 >= 11.5 ? 'big' : 'small'

  if (rank < UNLOCK.bow) return
  if (back) {
    if (rank >= UNLOCK.cape) cape(c, f)
    return
  }

  if (!f.back) {
    const bow = f.reddish ? 0x23c4b0 : 0xe23a5b

    sprite(c, BOW_TIE[size], cx, cy + ry * (monster === 'slime' ? 0.66 : 0.95) + (size === 'big' ? 2 : 1), {
      L: mix(bow, WHITE, 0.3),
      M: bow,
      D: mix(bow, BLACK, 0.3),
      K: mix(bow, BLACK, 0.45),
    })
  }

  const head = headTop(f)
  let crest = head.y

  if (rank >= UNLOCK.crown) {
    sprite(c, CROWN[size], head.x, head.y, { W: 0xfff8e8, L: GOLD_LIGHT, G: GOLD, D: 0xc78a00, R: 0xff3b5c, B: 0x3d9bff })
    crest -= CROWN[size].length

    // Now and then a glint runs across the band.
    const glint = t % 70

    if (glint < 6) c.add(head.x - rx * 0.4 + glint * 1.2, head.y - 1, WHITE, 0.9)
  } else if (rank >= UNLOCK.cap) {
    sprite(c, CAP[size], head.x, head.y, { R: 0xf0503c, r: 0xb8302a, Y: 0xffd23f, y: 0xc89a1a, B: 0x3d7bff, b: 0x2a50b8, W: 0xffb0a0 })
    crest -= CAP[size].length + 1
    propeller(c, Math.round(head.x), Math.round(crest), f, size === 'big' ? 4 : 3)
    crest -= 1
  }

  if (rank >= UNLOCK.halo) halo(c, head.x, crest - 3, Math.max(3, rx * 0.45), t)
}

// The egg it hatches from, in its color with lighter spots, standing on the ground:
// it rocks on its base in fits, cracks, glows through the cracks, and hops.
const eggOf = (f: Shape) => {
  const e = f.egg
  const [rx, ry] = [Math.max(4, f.r0 * 0.76), Math.max(5, f.r0 * 1.0)]
  const amp = e < 10 ? 0.2 : e < 20 ? 0.3 : 0.38
  const tilt = e >= 20 || e % 9 < 5 ? amp * Math.sin(e * 1.4) : 0

  return { x: Math.round(f.width / 2), y: f.floor - ry - (e >= 22 && e % 2 === 0 ? 1 : 0), rx, ry, tilt, color: mix(f.body, WHITE, 0.15) }
}

// The crack, in the egg's own coordinates, from the middle out.
const CRACK: [number, number][] = [[0, -0.2], [0.25, 0.02], [0.5, -0.22], [0.78, 0.02], [1.1, -0.15]]

const egg = (c: Canvas, f: Shape, half = false) => {
  const g = eggOf(f)
  const [cos, sin] = [Math.cos(g.tilt), Math.sin(g.tilt)]
  // Egg coordinates to the canvas, rocking about the bottom of the egg.
  const place = (u: number, v: number) => {
    const [px, py] = [u * g.rx, (v - 1) * g.ry]

    return [g.x + px * cos - py * sin, g.y + g.ry + px * sin + py * cos] as const
  }
  const crackY = (u: number) => {
    const side = Math.abs(u)
    const k = CRACK.findIndex(([x]) => x >= side)
    const [a, b] = [CRACK[Math.max(0, k - 1)]!, CRACK[Math.max(0, k)]!]

    return a[1] + (b[1] - a[1]) * ((side - a[0]) / Math.max(0.01, b[0] - a[0]))
  }
  const inside = (nx: number, ny: number) => {
    // Back into the egg's own frame: undo the rock about its base.
    const [px, py] = [nx * g.rx, ny * g.ry - g.ry]
    const [u, v] = [(px * cos + py * sin) / g.rx, (-px * sin + py * cos) / g.ry + 1]

    // The shell left standing is the lower part, low enough to show the mouth.
    if (half && v < crackY(u) + 0.45) return false

    return (u / (1 + 0.18 * v)) ** 2 + v * v < 1
  }

  c.blob(g.x, g.y, g.rx, g.ry, g.color, inside)

  for (const [u, v, r] of [[-0.42, -0.45, 0.2], [0.38, -0.1, 0.24], [-0.2, 0.42, 0.18], [0.5, 0.55, 0.14], [0.05, -0.8, 0.12]] as const) {
    if (half && v < 0.55) continue

    const [x, y] = place(u, v)

    c.disc(x, y, Math.max(0.6, r * g.rx), mix(g.color, WHITE, 0.45))
  }

  if (half) return

  // The crack spreads out from the middle, then light leaks through it.
  const e = f.egg
  const reach = clamp((e - 8) / 16) * 1.1

  for (const side of [-1, 1]) {
    for (let u = 0; u <= reach; u += 0.04) {
      const [x, y] = place(side * u, crackY(u))

      c.put(x, y, INK)
      if (e >= 21) c.add(x, y + 1, 0xfff1a8, 0.5 + 0.5 * Math.sin(e * 1.3))
    }
  }

  if (e >= 21) {
    for (let a = 0; a < 48; a++) {
      const angle = (a / 48) * Math.PI * 2
      const r = 1.25 + 0.1 * Math.sin(a * 3 + e)

      c.add(g.x + Math.cos(angle) * g.rx * r, g.y + Math.sin(angle) * g.ry * r, 0xffe680, 0.25 * ((e - 20) / 8))
    }
  }
}

// The shell it stood in, a moment after the burst, in front of its feet.
const bowl = (c: Canvas, f: Shape) => {
  if (f.egg >= EGG_CRACK && f.egg < EGG) egg(c, { ...f, egg: 0 }, true)
}

// A level-up: a flash, a beam of light it rides up, and LV UP rising, then the new level.
const beam = (c: Canvas, f: Shape) => {
  const p = f.grown

  if (!f.leveling || p > 34) return

  const fade = p < 26 ? 1 : 1 - (p - 26) / 8
  const half = f.r0 * 0.9

  for (let y = 0; y < f.floor; y++) {
    for (let x = Math.floor(f.cx - half - 2); x <= Math.ceil(f.cx + half + 2); x++) {
      const d = Math.abs(x + 0.5 - f.cx) / half
      const shimmer = 0.75 + 0.25 * Math.sin(y * 0.7 - p * 1.4 + x)

      if (d < 1) c.add(x, y, mix(GOLD_LIGHT, WHITE, 1 - d), 0.55 * (1 - d * d) * fade * shimmer)
    }
  }
}

// The words go up behind the monster, so it and all it wears stay in front.
const cheer = (c: Canvas, f: Shape) => {
  const p = f.grown

  if (!f.leveling || p < 2 || p > 44 || (p > 38 && p % 3 === 0)) return

  const text = p < 22 ? 'LV UP' : `LV ${f.rank}`
  const scale = c.width >= 40 ? 2 : 1
  const width = text.length * 4 * scale - scale
  const rise = clamp((p - 2) / 9)
  const y = Math.round(ease(f.floor - 5 * scale, 2, 1 - (1 - rise) ** 3))

  write(c, text, Math.round((c.width - width) / 2), y, scale, p % 4 < 2 ? 0xfff3a0 : 0xffd23f, 0xff8a1f)
}

const flash = (c: Canvas, { leveling, grown }: Shape) => {
  if (!leveling || grown >= 4) return

  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) c.add(x, y, WHITE, 0.6 * (1 - grown / 4))
}

// Its level, small in the top left corner.
const badge = (c: Canvas, rank: number) => {
  if (rank < 1) return

  const text = `Lv${rank}`
  const width = text.length * 4 + 1

  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < width; x++) {
      const corner = (x === 0 || x === width - 1) && (y === 0 || y === 6)

      if (!corner) c.put(1 + x, 1 + y, INK, 0.55)
    }
  }

  ;[...text].forEach((char, i) => {
    ;(GLYPHS[char] ?? GLYPHS[' ']!).forEach((row, y) => {
      for (let x = 0; x < 3; x++) if (row & (4 >> x)) c.put(2 + i * 4 + x, 2 + y, i < 2 ? 0xc9d3e8 : GOLD)
    })
  })
}

// One frame, `width` by `height` pixels, 0xRRGGBB each. Reads the scene, never moves it.
export const paint = (s: Scene, width: number, height: number): Uint32Array => {
  const c = new Canvas(width, height)
  const f = shape(s, width, height)

  world(c, f)

  // In the egg there is no monster yet: only the egg, rocking and cracking.
  if (f.egg >= 0 && f.egg < EGG_CRACK) {
    shadow(c, { ...f, rx: f.r0 * 0.6 })
    egg(c, f)
    bits(c, s)

    return c.px
  }

  glow(c, f, s.pantry.length > 0)
  aura(c, f, s.flashAt)
  beam(c, f)
  cheer(c, f)
  blaze(c, f, false)
  shadow(c, f)
  wear(c, f, true)
  torso(c, f)
  limbs(c, f, s)
  blaze(c, f, true)
  helpers(c, f, s.minions)
  hair(c, f)
  wear(c, f, false)
  // Mid spin, its back is to you.
  if (!f.back) face(c, f, s)
  antics(c, s, f)
  bowl(c, f)

  for (const mote of s.motes) {
    c.put(mote.px, mote.py, mote.color, 0.4)
    c.put(mote.x, mote.y, mote.color)
  }

  bits(c, s)

  if (f.pressure >= RED || f.bursting || f.heat > 0.8) {
    // A bead of sweat sliding down the temple.
    const p = (f.t * 0.06) % 1

    c.disc(f.cx + f.rx * 0.78, f.cy - f.ry * 0.55 + p * f.ry * 0.5, 0.9, 0xbfe9ff)
  }

  frenzy(c, f)
  hud(c, s)
  flash(c, f)
  // No level on an egg, and none in the corner while the big one shows.
  badge(c, (f.egg >= 0 && f.egg < EGG) || f.leveling ? 0 : s.rank)

  return glitch(c.px, width, height, f)
}

// The frenzy's overlay: anime speed lines bursting out from the monster, and the
// whole sky strobing on the beat.
const frenzy = (c: Canvas, { t, cx, cy, rx, frenzy: k }: Shape) => {
  if (k < 0.15) return

  for (let i = 0; i < 18; i++) {
    const angle = hash(i, Math.floor(t / 2)) * Math.PI * 2
    const from = rx + 3 + hash(i, t) * 4
    const to = Math.hypot(c.width, c.height)

    for (let r = from; r < to; r += 0.6) {
      c.add(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.8, 0xffffff, 0.22 * k * (1 - r / to))
    }
  }

  if (t % 6 === 0) {
    for (let i = 0; i < c.px.length; i++) c.add(i % c.width, Math.floor(i / c.width), rainbow(t * 0.05), 0.12 * k)
  }
}

// At full tilt the whole picture shakes, and now and then splits into red and blue.
const glitch = (px: Uint32Array, width: number, height: number, { t, frenzy: k }: Shape) => {
  if (k < 0.25) return px

  const sx = Math.round((hash(t, 8) - 0.5) * 4 * k)
  const sy = Math.round((hash(t, 9) - 0.5) * 3 * k)
  const split = k > 0.55 && t % 5 < 2 ? 1 : 0
  const at = (x: number, y: number) =>
    px[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))] ?? 0
  const out = new Uint32Array(px.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = [at(x - sx - split, y - sy), at(x - sx, y - sy), at(x - sx + split, y - sy)]

      out[y * width + x] = (r & 0xff0000) | (g & 0x00ff00) | (b & 0x0000ff)
    }
  }

  return out
}

// The xterm 256-color palette: a 6x6x6 cube and 24 greys.
const LEVELS = [0, 95, 135, 175, 215, 255]
const around = (v: number) => {
  const above = LEVELS.findIndex(level => level >= v)

  return above <= 0 ? [LEVELS[0]!] : [LEVELS[above - 1]!, LEVELS[above]!]
}

// A terminal without 24-bit color rounds each pixel to that palette, and a dark
// navy or purple lands on a grey. This picks the palette color itself: of the
// cube colors around the pixel and the nearest grey, the closest once a shift in
// hue costs extra, so a colored pixel keeps its color where it can.
const memo = new Map<number, number>()

export const to256 = (color: number) => {
  const hit = memo.get(color)

  if (hit !== undefined) return hit

  const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255]
  const mean = (r + g + b) / 3
  const level = Math.min(23, Math.max(0, Math.round((mean - 8) / 10)))
  const candidates: [number, number, number][] = [[8 + level * 10, 8 + level * 10, 8 + level * 10]]

  for (const x of around(r)) for (const y of around(g)) for (const z of around(b)) candidates.push([x, y, z])

  const cost = ([x, y, z]: [number, number, number]) => {
    const m = (x + y + z) / 3
    const hue = (x - m - (r - mean)) ** 2 + (y - m - (g - mean)) ** 2 + (z - m - (b - mean)) ** 2

    return (x - r) ** 2 + (y - g) ** 2 + (z - b) ** 2 + hue * 1.5
  }
  const [x, y, z] = candidates.reduce((best, one) => (cost(one) < cost(best) ? one : best))
  const out = (x << 16) | (y << 8) | z

  if (memo.size < 4096) memo.set(color, out)

  return out
}

// Two pixels a cell: the upper half block, foreground the top pixel, background the bottom.
export const encode = (px: Uint32Array, columns: number, rows: number, is256 = false) => {
  const words = new Uint32Array(columns * rows * 3)

  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < columns; x++) {
      const i = (row * columns + x) * 3

      const [top, bottom] = [px[2 * row * columns + x] ?? 0, px[(2 * row + 1) * columns + x] ?? 0]

      words[i] = 0x2580
      words[i + 1] = is256 ? to256(top) : top
      words[i + 2] = is256 ? to256(bottom) : bottom
    }
  }

  const bytes = new Uint8Array(words.buffer)
  let text = ''

  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))

  return btoa(text)
}
