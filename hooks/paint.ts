import type { Belly, Limit, Look } from '../types'

// Everything the sprite reads. The gauges (belly, pantry, look) come from the
// hooks; the motion (heat, phases, motes, combo) moves only in step(), one frame
// at a time, and only as fast as tokens actually arrive.
export type Scene = {
  tick: number
  at: number
  belly: Belly | null
  look: Look
  pantry: Limit[]
  busy: boolean
  tools: Map<string, string>
  minions: number
  level: number
  typedAt: number
  errorAt: number
  arrived: number
  rate: number
  heat: number
  servings: Serving[]
  motes: Mote[]
  chew: number
  bob: number
  breathe: number
  blinkAt: number
  gaze: Point
  gazeTo: Point
  gazeUntil: number
  power: number
  combo: number
  comboAt: number
  finish: { text: string; at: number } | null
}

type Point = { x: number; y: number }
type Serving = { tokens: number; color: number; fromPrompt: boolean }
type Mote = { x: number; y: number; px: number; py: number; color: number }

export const MINUTE = 60_000
export const SAD = 15 * MINUTE
export const STARVING = 60 * MINUTE
export const BURP = MINUTE
// One pair of limit thresholds for the bars, the glow, the sweat and the remarks.
export const AMBER = 50
export const RED = 80
// Tool calls closer together than this many frames chain into a combo.
export const COMBO_GAP = 40

export const PALETTE: Record<string, number> = {
  blue: 0x3d7bff,
  cyan: 0x22c7d6,
  green: 0x46d160,
  yellow: 0xf2c230,
  magenta: 0xd25cf0,
  red: 0xf0503c,
  white: 0xdfe6f0,
}

const WHITE = 0xffffff
const BLACK = 0x000000
const INK = 0x120a18
const SKY_TOP = 0x0a0f24
const SKY_BOTTOM = 0x251642
const GROUND = 0x121829
const GRASS = 0x2b3b5c
const GOLD = 0xffd23f
const GOLD_LIGHT = 0xfff3a0
const GOLD_DARK = 0x8a5a00
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

export const mix = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t))
  const channel = (shift: number) => {
    const from = (a >> shift) & 255

    return Math.round(from + (((b >> shift) & 255) - from) * k) << shift
  }

  return channel(16) | channel(8) | channel(0)
}

// A repeatable 0..1 from integers, so paint() flickers without moving the scene.
const hash = (a: number, b = 0) => {
  let h = (a * 374761393 + b * 668265263) | 0

  h = Math.imul(h ^ (h >>> 13), 1274126177)

  return ((h ^ (h >>> 16)) >>> 0) / 2 ** 32
}

let seed = 7
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32

export const scene = (look: Look): Scene => ({
  tick: 0,
  at: 0,
  belly: null,
  look,
  pantry: [],
  busy: false,
  tools: new Map(),
  minions: 0,
  level: 0,
  typedAt: -100,
  errorAt: -100,
  arrived: 0,
  rate: 0,
  heat: 0,
  servings: [],
  motes: [],
  chew: 0,
  bob: 0,
  breathe: 0,
  blinkAt: -100,
  gaze: { x: 0, y: 0 },
  gazeTo: { x: 0, y: 0 },
  gazeUntil: 0,
  power: 0,
  combo: 0,
  comboAt: -100,
  finish: null,
})

// Tokens arriving: they heat the monster up and fly into its mouth. Typing only
// drools; it is not tokens spent.
export const feed = (s: Scene, tokens: number, color: number, fromPrompt = false, heats = true) => {
  if (tokens <= 0) return
  if (heats) s.arrived += tokens

  s.servings.push({ tokens: Math.min(tokens, 3000), color, fromPrompt })
  s.servings = s.servings.slice(-24)
}

export const hit = (s: Scene, isError: boolean) => {
  s.combo = s.tick - s.comboAt > COMBO_GAP ? 1 : s.combo + 1
  s.comboAt = s.tick

  if (isError) s.finish = { text: 'COUNTER', at: s.tick }
}

export const finishTurn = (s: Scene) => {
  if (s.combo >= 3 && s.tick - s.comboAt <= COMBO_GAP) s.finish = { text: 'K.O.', at: s.tick }

  s.combo = 0
}

// What a frame reads off the scene: the monster's place and size, and how it feels.
const shape = (s: Scene, width: number, height: number) => {
  const t = s.tick
  const full = (s.belly?.percent ?? 0) / 100
  const idle = s.belly === null ? 0 : s.at - s.belly.fedAt
  const starving = idle >= STARVING
  const monster = s.look.monster
  const eating = s.heat > 0.02
  const floor = height - 3
  const r0 = Math.min(width * 0.5, height * 0.75) * 0.5
  const wobble = monster === 'slime' ? 1 + 0.04 * Math.sin(s.breathe * 2) : 1
  // Powering up, it tightens to make room for the hair.
  const tight = 1 - s.power * 0.18
  const rx = Math.min(width * 0.45, r0 * (0.75 + 0.6 * full) * (starving ? 0.85 : 1) * wobble) * tight
  const ry = Math.min(height * 0.36, r0 * (0.8 + 0.35 * full) + Math.sin(s.breathe) * 0.5) * tight
  const lift =
    (monster === 'ghost' ? 3 + Math.sin(s.breathe * 1.3) * 1.2 : 0) +
    (eating ? Math.abs(Math.sin(s.bob)) * (0.4 + s.heat * 2) : 0) +
    s.power * 1.5
  const shake = s.heat > 0.7 || s.level >= 2 ? Math.round((hash(t, 1) - 0.5) * 2) : 0
  const cx = width / 2 + shake
  // However it floats, the head stays on screen.
  const cy = floor - ry - Math.min(lift, Math.max(0, floor - 2 * ry - 4))
  const typing = t - s.typedAt < 15

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
    eating,
    starving,
    heat: s.heat,
    power: s.power,
    level: s.level,
    wave: s.breathe,
    sad: idle >= SAD,
    burping: s.belly?.burpAt != null && s.at - s.belly.burpAt < BURP,
    bursting: full >= 0.9,
    stuffed: full >= 0.75,
    pressure: Math.max(0, ...s.pantry.map(limit => limit.percentUsed)),
    typing,
    thinking: s.busy && !eating,
    angry: t - s.errorAt < 20,
    blink: t - s.blinkAt < 2 && !typing,
    gaze: typing ? { x: 0, y: 0.9 } : s.gaze,
    body: starving ? mix(PALETTE[s.look.color] ?? 0x3d7bff, 0x8a8f99, 0.55) : (PALETTE[s.look.color] ?? 0x3d7bff),
    mouth: { x: cx, y: cy + ry * (monster === 'slime' ? 0.35 : 0.3) },
  }
}

type Shape = ReturnType<typeof shape>

// Moves the scene on one frame. Idle, only breath, blinks and glances; the chew,
// the bounce and the motes run as fast as tokens arrive.
export const step = (s: Scene, width: number, height: number) => {
  s.tick += 1
  s.rate = s.rate * 0.85 + s.arrived * 0.15
  s.arrived = 0
  s.heat = 1 - Math.exp(-s.rate / 8)
  s.breathe += 0.035

  if (s.heat > 0.02) {
    s.chew += 0.15 + s.heat * 0.9
    s.bob += 0.12 + s.heat * 0.7
  }

  if (s.tick - s.blinkAt > 2 && random() < 1 / 45) s.blinkAt = s.tick

  if (s.tick >= s.gazeUntil) {
    s.gazeTo =
      s.tools.size > 0
        ? { x: 0.8, y: 0 }
        : s.busy
          ? { x: -0.4, y: -0.8 }
          : { x: (random() * 2 - 1) * 0.7, y: (random() * 2 - 1) * 0.4 }
    s.gazeUntil = s.tick + 15 + random() * 50
  }

  s.gaze = { x: s.gaze.x + (s.gazeTo.x - s.gaze.x) * 0.35, y: s.gaze.y + (s.gazeTo.y - s.gaze.y) * 0.35 }
  s.power += ((s.level > 0 ? 1 : 0) - s.power) * 0.08

  const { mouth, floor } = shape(s, width, height)

  // Each mote carries a share of its serving; more heat, more motes a frame.
  for (let budget = 1 + Math.round(s.heat * 5); budget > 0 && s.servings.length > 0; budget--) {
    const serving = s.servings[0]!
    const bite = Math.max(25, serving.tokens / 40)
    const [x, y] = serving.fromPrompt
      ? [random() * width, height - 1]
      : [random() < 0.5 ? 0 : width - 1, 2 + random() * (floor - 6)]

    s.motes.push({ x, y, px: x, py: y, color: serving.color })
    serving.tokens -= bite

    if (serving.tokens <= 0) s.servings.shift()
  }

  const speed = 1.2 + s.heat * 2.2 + s.power

  s.motes = s.motes.slice(-120).filter(mote => {
    const [dx, dy] = [mouth.x - mote.x, mouth.y - mote.y]
    const dist = Math.hypot(dx, dy)

    if (dist < 1.5) return false

    mote.px = mote.x
    mote.py = mote.y
    mote.x += (dx / dist) * Math.min(dist, speed)
    mote.y += (dy / dist) * Math.min(dist, speed)

    return true
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

  line(x0: number, y0: number, x1: number, y1: number, color: number) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))

    for (let i = 0; i <= n; i++) this.put(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, color)
  }
}

// Night sky, slowly twinkling stars, the ground.
const sky = (c: Canvas, { t, floor }: Shape) => {
  for (let y = 0; y < c.height; y++) {
    const color = y >= floor ? (y === floor ? GRASS : GROUND) : mix(SKY_TOP, SKY_BOTTOM, y / c.height)

    for (let x = 0; x < c.width; x++) c.px[y * c.width + x] = color
  }

  for (let i = 0; i < 14; i++) {
    const bright = hash(i, Math.floor((t + i * 7) / 30)) > 0.7 ? 1 : 0.25

    c.put((i * 37 + 11) % c.width, (i * 23 + 5) % Math.max(1, floor - 4), mix(0x40507a, WHITE, bright))
  }
}

// The glow is the pantry: green with room to spare, amber, then pulsing red.
const glow = (c: Canvas, { t, cx, cy, rx, ry, floor, pressure, power }: Shape, hasLimits: boolean) => {
  if (!hasLimits || power > 0.5) return

  const color = pressure >= RED ? 0xff3b3b : pressure >= AMBER ? 0xffb02e : 0x2fd27a
  const pulse = (pressure >= RED ? 0.55 + 0.45 * Math.sin(t * 0.6) : 1) * (1 - power * 2)

  for (let y = 0; y < floor; y++) {
    for (let x = 0; x < c.width; x++) {
      const d = Math.hypot((x + 0.5 - cx) / (rx + 6), (y + 0.5 - cy) / (ry + 5))

      if (d < 1) c.put(x, y, color, 0.32 * (1 - d) * pulse)
    }
  }
}

// Super mode: a golden flame aura hugging the body and licking upward, rising
// sparks, and from level 2 lightning.
const aura = (c: Canvas, { t, cx, cy, rx, ry, floor, power, level }: Shape) => {
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

      c.add(x, y, mix(0xffd000, 0xff5a00, out), power * (1 - out) * 0.8)
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

// A shadow on the ground, fainter the higher it floats; one minion per running subagent.
const ground = (c: Canvas, { t, cx, rx, floor, lift, body, power }: Shape, minions: number) => {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const k = 1 - ((x + 0.5 - cx) / rx) ** 2

    if (k > 0) c.put(x, floor, BLACK, 0.45 * k * Math.max(0.2, 1 - lift / 8))
  }

  for (let i = 0; i < Math.min(4, minions); i++) {
    const x = i % 2 === 0 ? 4 + (i >> 1) * 6 : c.width - 5 - (i >> 1) * 6
    const y = floor - 2 - Math.abs(Math.sin(t * 0.5 + i)) * 2

    c.disc(x, y, 2.8, mix(body, WHITE, 0.3))
    c.put(x - 1, y - 1, WHITE)
    c.put(x + 1, y - 1, WHITE)
    c.put(x - 1, y, INK)
    c.put(x + 1, y, INK)
  }
}

// The body: bigger as the context fills, thinner when starving.
const torso = (c: Canvas, { monster, cx, cy, rx, ry, body, wave }: Shape) => {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      let nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry

      if (monster === 'slime' && ny > 0) nx /= 1 + 0.3 * ny

      let d = Math.hypot(nx, ny)

      if (monster === 'cookie') d *= 1 + 0.07 * Math.sin(Math.atan2(ny, nx) * 11 + wave * 2)

      const inside =
        monster === 'ghost' ? (ny < 0 ? d < 1 : Math.abs(nx) < 1 && ny < 1 + 0.18 * Math.sin(nx * 9 + wave * 3)) : d < 1

      if (!inside) continue

      const rim = monster === 'ghost' && ny >= 0 ? Math.abs(nx) : d
      const light = -(nx * 0.5 + ny * 0.8) * 0.35
      let color = light > 0 ? mix(body, WHITE, light) : mix(body, BLACK, -light)

      if ((monster === 'cookie' || monster === 'gremlin') && (nx / 0.55) ** 2 + ((ny - 0.4) / 0.5) ** 2 < 1) {
        color = mix(color, WHITE, 0.22)
      }
      if (monster === 'slime' && Math.hypot(nx + 0.4, ny + 0.5) < 0.18) color = mix(color, WHITE, 0.6)
      if (rim > 0.88) color = mix(color, BLACK, 0.45)

      c.put(x, y, color, monster === 'ghost' ? 0.82 : monster === 'slime' ? 0.9 : 1)
    }
  }

  if (monster === 'slime') {
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * rx * 0.6

      for (let k = 0; k < 1 + ((wave * 2 + i * 1.3) % 3); k++) c.put(x, cy + ry * 0.92 + k, mix(body, BLACK, 0.2))
    }
  }

  if (monster === 'gremlin') {
    for (const side of [-1, 1]) {
      const [tipX, tipY] = [cx + side * rx * 0.85, cy - ry * 1.35]
      const [footX, footY] = [cx + side * rx * 0.5, cy - ry * 0.7]

      for (let y = Math.floor(tipY); y <= footY; y++) {
        const p = (y - tipY) / (footY - tipY)
        const x = tipX + (footX - tipX) * p

        for (let dx = -2 * p; dx <= 2 * p; dx++) c.put(x + dx, y, mix(0xeadfc8, BLACK, 0.25 * p))
      }
    }
  }
}

// Super mode hair: golden spikes, longer each level, swaying in the aura.
const hair = (c: Canvas, { t, cx, cy, rx, ry, power, level }: Shape) => {
  if (power < 0.3) return

  const spikes = 5
  const length = Math.min((2 + level * 3) * power, cy - ry - 1)

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

// Eyes: where they look says what is happening; the brows and tears say how it feels.
const face = (c: Canvas, f: Shape) => {
  const { t, monster, cx, cy, rx, ry, r0, body, gaze, bursting, burping, stuffed, starving, sad, angry, blink } = f
  const eyes: [number, number, number][] =
    monster === 'slime'
      ? [[cx, cy - ry * 0.3, 0]]
      : monster === 'cookie'
        ? [[cx - rx * 0.32, cy - ry * 0.78, -1], [cx + rx * 0.32, cy - ry * 0.78, 1]]
        : [[cx - rx * 0.33, cy - ry * 0.3, -1], [cx + rx * 0.33, cy - ry * 0.3, 1]]
  const re = Math.max(1.8, r0 * (monster === 'slime' ? 0.36 : monster === 'cookie' ? 0.27 : 0.21))
  const superEyes = f.power > 0.5
  const happy = !superEyes && (burping || (stuffed && !bursting && !f.eating && !f.thinking))
  const fierce = angry || superEyes

  for (const [ex, ey, side] of eyes) {
    if (bursting && !superEyes) {
      // Dizzy: a white eye, a dark ring turning, a dot.
      c.disc(ex, ey, re, WHITE)
      for (let a = 0; a < 16; a++) {
        const angle = (a / 16) * Math.PI * 2 + t * 0.4

        c.put(ex + Math.cos(angle) * re * 0.6, ey + Math.sin(angle) * re * 0.6, INK)
      }
      c.put(ex, ey, INK)
    } else if (blink || happy) {
      for (let dx = -re; dx <= re; dx++) c.put(ex + dx, ey - (happy ? (re - Math.abs(dx)) * 0.6 : 0), INK)
    } else {
      c.disc(ex, ey, re, monster === 'ghost' ? 0x1a1030 : monster === 'gremlin' && !superEyes ? 0xffe14d : WHITE)

      if (monster === 'ghost') {
        c.disc(ex + gaze.x * 0.6, ey + gaze.y * 0.6, re * 0.45, superEyes ? TEAL : f.eating ? 0x7ff6ff : 0x5f6fbf)
      } else if (monster === 'gremlin' && !superEyes) {
        for (let k = -re + 1; k <= re - 1; k++) c.put(ex + gaze.x * re * 0.5, ey + k, INK)
      } else {
        const pr = re * 0.5
        const [px, py] = [ex + gaze.x * (re - pr - 0.3), ey + gaze.y * (re - pr - 0.3)]

        c.disc(px, py, pr, superEyes ? TEAL : INK)
        c.put(px - pr * 0.4, py - pr * 0.4, WHITE)
      }

      if (starving) {
        for (let dy = -re; dy <= 0; dy++) {
          for (let dx = -re; dx <= re; dx++) if (dx * dx + dy * dy <= re * re) c.put(ex + dx, ey + dy, body)
        }
      }
    }

    if ((fierce || sad) && side !== 0) {
      for (let dx = -re; dx <= re; dx++) c.put(ex + dx, ey - re - 1.2 + ((dx * -side) / re) * (fierce ? 1.2 : -1.2), INK)
    }

    if (sad && !starving && !superEyes && side !== 0) c.put(ex + side * re * 0.6, ey + re + ((t * 0.4) % 6), 0x6ec6ff)
  }

  if (f.pressure >= RED || bursting || f.heat > 0.8) c.put(cx + rx * 0.75, cy - ry * 0.5 + ((t * 0.3) % 4), 0xbfe9ff)

  if (starving) {
    const [zx, zy] = [cx + rx * 0.8, cy - ry - 2 - ((t * 0.1) % 4)]

    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]] as const) {
      c.put(zx + dx, zy + dy, 0xcfd6e6, 0.8)
    }
  }
}

// Mouth: shut when nothing flows, chomping harder the more tokens arrive, an
// expectant "o" while you type, a battle cry in super mode, wide for a burp.
const mouth = (c: Canvas, f: Shape, chew: number) => {
  const { monster, rx, ry, typing, burping, sad, starving, angry, eating, heat, power } = f
  const { x: mx, y: my } = f.mouth
  const open = burping
    ? 1
    : eating
      ? (0.2 + 0.8 * heat) * Math.abs(Math.sin(chew))
      : power > 0.5
        ? 0.45
        : typing
          ? 0.35
          : 0
  const mw = rx * (monster === 'slime' ? 0.35 : 0.55) * (typing && !eating ? 0.5 : 1)
  const mh = 0.6 + open * ry * 0.5

  if (mh < 1.2) {
    const frown = sad || starving || angry

    for (let dx = -mw; dx <= mw; dx++) {
      const curve = (dx / mw) ** 2

      c.put(mx + dx, frown ? my + curve * 1.2 - 0.6 : my - curve * 1.2 + 0.6, INK)
    }
  } else {
    for (let y = Math.floor(my - mh); y <= Math.ceil(my + mh); y++) {
      for (let x = Math.floor(mx - mw); x <= Math.ceil(mx + mw); x++) {
        const [nx, ny] = [(x + 0.5 - mx) / mw, (y + 0.5 - my) / mh]

        if (nx * nx + ny * ny >= 1) continue

        const tooth = ny < -0.5 && x % 2 === 0 && monster !== 'slime'

        c.put(x, y, tooth ? WHITE : ny > 0.35 ? 0xd94a6e : 0x3a0614)
      }
    }

    if (monster === 'gremlin') {
      for (const side of [-0.5, 0.5]) for (let k = 0; k < 2; k++) c.put(mx + side * mw, my - mh + 1 + k, WHITE)
    }
  }

  if (typing && !eating) c.put(mx + mw * 0.6, my + mh + ((f.t * 0.3) % 3), PROMPT)

  if (burping) {
    for (let i = 0; i < 3; i++) c.disc(mx + (i - 1) * 3, my - mh - 2 - ((f.t * 0.3 + i) % 6), 1.2, 0xd6f5c8, 0.6)
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
  '.': [0, 0, 0, 0, 2],
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

// The fight HUD: a combo counter while tool calls chain, then the finish.
const hud = (c: Canvas, s: Scene) => {
  const since = s.tick - s.comboAt

  if (s.combo >= 2 && since <= COMBO_GAP) write(c, `${s.combo} HITS`, since < 2 ? 3 : 2, 2, 1, 0xffe04d, 0xff7a1a)

  if (s.finish !== null && s.tick - s.finish.at < 18 && (s.tick - s.finish.at) % 6 < 5) {
    const big = s.finish.text === 'K.O.'
    const scale = big ? 2 : 1
    const width = s.finish.text.length * 4 * scale - scale

    write(
      c,
      s.finish.text,
      Math.round((c.width - width) / 2),
      big ? 5 : 9,
      scale,
      big ? 0xff3b3b : 0xffe04d,
      big ? 0xb3122e : 0xff7a1a,
    )
  }
}

// One frame, `width` by `height` pixels, 0xRRGGBB each. Reads the scene, never moves it.
export const paint = (s: Scene, width: number, height: number): Uint32Array => {
  const c = new Canvas(width, height)
  const f = shape(s, width, height)

  sky(c, f)
  glow(c, f, s.pantry.length > 0)
  aura(c, f)
  ground(c, f, s.minions)
  torso(c, f)
  hair(c, f)
  face(c, f)
  mouth(c, f, s.chew)

  for (const mote of s.motes) {
    c.put(mote.px, mote.py, mote.color, 0.4)
    c.put(mote.x, mote.y, mote.color)
  }

  hud(c, s)

  return c.px
}

// Two pixels a cell: the upper half block, foreground the top pixel, background the bottom.
export const encode = (px: Uint32Array, columns: number, rows: number) => {
  const words = new Uint32Array(columns * rows * 3)

  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < columns; x++) {
      const i = (row * columns + x) * 3

      words[i] = 0x2580
      words[i + 1] = px[2 * row * columns + x] ?? 0
      words[i + 2] = px[(2 * row + 1) * columns + x] ?? 0
    }
  }

  const bytes = new Uint8Array(words.buffer)
  let text = ''

  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))

  return btoa(text)
}
