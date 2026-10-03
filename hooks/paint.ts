import type { Belly, Limit, Look } from '../types'

// Everything the sprite reads: the gauges (belly, pantry, look) and the
// activity the hooks see (a turn, the tools in flight, subagents, typing).
export type Scene = {
  tick: number
  at: number
  belly: Belly | null
  look: Look
  pantry: Limit[]
  busy: boolean
  tools: Map<string, string>
  minions: number
  typedAt: number
  errorAt: number
  queued: number
  motes: Mote[]
}

type Mote = { x: number; y: number; px: number; py: number; color: number }

export const MINUTE = 60_000
export const SAD = 15 * MINUTE
export const STARVING = 60 * MINUTE
export const BURP = MINUTE
// One pair of limit thresholds for the bars, the glow, the sweat and the remarks.
export const AMBER = 50
export const RED = 80

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
const TOKEN = 0xffd166
const PROMPT = 0x9ad7ff
const TOOL_COLORS: [RegExp, number][] = [
  [/^Bash/, 0x5cff8a],
  [/^(Read|Grep|Glob|LS)/, 0x5cc8ff],
  [/^(Edit|Write|MultiEdit|NotebookEdit)/, 0xffa94d],
  [/^Web/, 0xc77dff],
  [/^Agent/, 0xff6fd8],
  [/^mcp__/, 0xffe066],
]

const toolColor = (tool: string | undefined) =>
  tool === undefined ? TOKEN : (TOOL_COLORS.find(([match]) => match.test(tool))?.[1] ?? TOKEN)

export const mix = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t))
  const channel = (shift: number) => {
    const from = (a >> shift) & 255

    return Math.round(from + (((b >> shift) & 255) - from) * k) << shift
  }

  return channel(16) | channel(8) | channel(0)
}

// What a frame reads off the scene: the monster's place and size, and how it feels.
const shape = (s: Scene, width: number, height: number) => {
  const t = s.tick
  const full = (s.belly?.percent ?? 0) / 100
  const idle = s.belly === null ? 0 : s.at - s.belly.fedAt
  const starving = idle >= STARVING
  const monster = s.look.monster
  const floor = height - 3
  const r0 = Math.min(width * 0.5, height * 0.75) * 0.5
  const wobble = monster === 'slime' ? 1 + 0.05 * Math.sin(t * 0.5) : 1
  const rx = Math.min(width * 0.45, r0 * (0.75 + 0.6 * full) * (starving ? 0.85 : 1) * wobble)
  const ry = Math.min(height * 0.36, r0 * (0.8 + 0.35 * full) + Math.sin(t * 0.2) * 0.4)
  const lift = monster === 'ghost' ? 3 + Math.sin(t * 0.15) * 1.5 : s.busy ? Math.abs(Math.sin(t * 0.45)) * 1.2 : 0
  const cx = width / 2 + (monster === 'ghost' ? Math.sin(t * 0.07) * 2 : 0)
  const cy = floor - ry - lift
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
    full,
    starving,
    sad: idle >= SAD,
    burping: s.belly?.burpAt != null && s.at - s.belly.burpAt < BURP,
    bursting: full >= 0.9,
    stuffed: full >= 0.75,
    pressure: Math.max(0, ...s.pantry.map(limit => limit.percentUsed)),
    typing,
    angry: t - s.errorAt < 20,
    tool: [...s.tools.values()].at(-1),
    body: starving ? mix(PALETTE[s.look.color] ?? 0x3d7bff, 0x8a8f99, 0.55) : (PALETTE[s.look.color] ?? 0x3d7bff),
    mouth: { x: cx, y: cy + ry * (monster === 'slime' ? 0.35 : 0.3) },
  }
}

type Shape = ReturnType<typeof shape>

let seed = 7
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32

// Moves the scene on one frame: new motes spawn, the rest fly toward the mouth.
export const step = (s: Scene, width: number, height: number) => {
  const { mouth, floor, tool } = shape(s, width, height)

  s.tick += 1

  if (s.busy) {
    for (let i = 0; i < (s.tools.size > 0 ? 2 : 1); i++) {
      const [x, y] = [random() < 0.5 ? 0 : width - 1, 2 + random() * (floor - 6)]

      s.motes.push({ x, y, px: x, py: y, color: toolColor(tool) })
    }
  }

  for (let i = 0; i < Math.min(3, s.queued); i++) {
    const x = random() * width

    s.motes.push({ x, y: height - 1, px: x, py: height - 1, color: PROMPT })
  }

  s.queued = Math.max(0, s.queued - 3)
  s.motes = s.motes.slice(-80).filter(mote => {
    const [dx, dy] = [mouth.x - mote.x, mouth.y - mote.y]
    const dist = Math.hypot(dx, dy)

    if (dist < 1.5) return false

    mote.px = mote.x
    mote.py = mote.y
    mote.x += (dx / dist) * Math.min(dist, 1.8)
    mote.y += (dy / dist) * Math.min(dist, 1.8)

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

  disc(x: number, y: number, r: number, color: number, alpha = 1) {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r * r) this.put(x + dx, y + dy, color, alpha)
      }
    }
  }
}

// Night sky, twinkling stars, the ground.
const sky = (c: Canvas, { t, floor }: Shape) => {
  for (let y = 0; y < c.height; y++) {
    const color = y >= floor ? (y === floor ? GRASS : GROUND) : mix(SKY_TOP, SKY_BOTTOM, y / c.height)

    for (let x = 0; x < c.width; x++) c.px[y * c.width + x] = color
  }

  for (let i = 0; i < 14; i++) {
    const bright = Math.sin(t * 0.15 + i * 1.7) > 0.6 ? 1 : 0.25

    c.put((i * 37 + 11) % c.width, (i * 23 + 5) % Math.max(1, floor - 4), mix(0x40507a, WHITE, bright))
  }
}

// The aura is the pantry: green with room to spare, amber, then pulsing red.
const aura = (c: Canvas, { t, cx, cy, rx, ry, floor, pressure }: Shape, hasLimits: boolean) => {
  if (!hasLimits) return

  const glow = pressure >= RED ? 0xff3b3b : pressure >= AMBER ? 0xffb02e : 0x2fd27a
  const pulse = pressure >= RED ? 0.55 + 0.45 * Math.sin(t * 0.6) : 1

  for (let y = 0; y < floor; y++) {
    for (let x = 0; x < c.width; x++) {
      const d = Math.hypot((x + 0.5 - cx) / (rx + 6), (y + 0.5 - cy) / (ry + 5))

      if (d < 1) c.put(x, y, glow, 0.32 * (1 - d) * pulse)
    }
  }
}

// A shadow on the ground, fainter the higher it floats; one minion per running subagent.
const ground = (c: Canvas, { t, cx, rx, floor, lift, body }: Shape, minions: number) => {
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const k = 1 - ((x + 0.5 - cx) / rx) ** 2

    if (k > 0) c.put(x, floor, BLACK, 0.45 * k * (1 - lift / 8))
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
const torso = (c: Canvas, { t, monster, cx, cy, rx, ry, body }: Shape) => {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      let nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry

      if (monster === 'slime' && ny > 0) nx /= 1 + 0.3 * ny

      let d = Math.hypot(nx, ny)

      if (monster === 'cookie') d *= 1 + 0.07 * Math.sin(Math.atan2(ny, nx) * 11 + t * 0.3)

      const inside =
        monster === 'ghost' ? (ny < 0 ? d < 1 : Math.abs(nx) < 1 && ny < 1 + 0.18 * Math.sin(nx * 9 + t * 0.5)) : d < 1

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

      for (let k = 0; k < 1 + ((t * 0.2 + i * 1.3) % 3); k++) c.put(x, cy + ry * 0.92 + k, mix(body, BLACK, 0.2))
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

// Eyes: where they look says what is happening; the brows and tears say how it feels.
const face = (c: Canvas, f: Shape, busy: boolean) => {
  const { t, monster, cx, cy, rx, ry, r0, body, typing, tool, bursting, burping, stuffed, starving, sad, angry } = f
  const eyes: [number, number, number][] =
    monster === 'slime'
      ? [[cx, cy - ry * 0.3, 0]]
      : monster === 'cookie'
        ? [[cx - rx * 0.32, cy - ry * 0.78, -1], [cx + rx * 0.32, cy - ry * 0.78, 1]]
        : [[cx - rx * 0.33, cy - ry * 0.3, -1], [cx + rx * 0.33, cy - ry * 0.3, 1]]
  const re = Math.max(1.8, r0 * (monster === 'slime' ? 0.36 : monster === 'cookie' ? 0.27 : 0.21))
  const [lx, ly] = typing
    ? [0, 0.9]
    : tool !== undefined
      ? [0.8, 0]
      : busy
        ? [-0.4, -0.8]
        : [Math.sin(t * 0.05) * 0.7, Math.cos(t * 0.031) * 0.4]
  const blink = t % 53 < 2 && !typing
  const happy = burping || (stuffed && !bursting && !busy)

  for (const [ex, ey, side] of eyes) {
    if (bursting) {
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
      c.disc(ex, ey, re, monster === 'ghost' ? 0x1a1030 : monster === 'gremlin' ? 0xffe14d : WHITE)

      if (monster === 'ghost') {
        c.disc(ex + lx * 0.6, ey + ly * 0.6, re * 0.45, busy ? 0x7ff6ff : 0x5f6fbf)
      } else if (monster === 'gremlin') {
        for (let k = -re + 1; k <= re - 1; k++) c.put(ex + lx * re * 0.5, ey + k, INK)
      } else {
        const pr = re * 0.5
        const [px, py] = [ex + lx * (re - pr - 0.3), ey + ly * (re - pr - 0.3)]

        c.disc(px, py, pr, INK)
        c.put(px - pr * 0.4, py - pr * 0.4, WHITE)
      }

      if (starving) {
        for (let dy = -re; dy <= 0; dy++) {
          for (let dx = -re; dx <= re; dx++) if (dx * dx + dy * dy <= re * re) c.put(ex + dx, ey + dy, body)
        }
      }
    }

    if ((angry || sad) && side !== 0) {
      for (let dx = -re; dx <= re; dx++) c.put(ex + dx, ey - re - 1.2 + ((dx * -side) / re) * (angry ? 1.2 : -1.2), INK)
    }

    if (sad && !starving && side !== 0) c.put(ex + side * re * 0.6, ey + re + ((t * 0.4) % 6), 0x6ec6ff)
  }

  if (f.pressure >= RED || bursting) c.put(cx + rx * 0.75, cy - ry * 0.5 + ((t * 0.3) % 4), 0xbfe9ff)

  if (starving) {
    const [zx, zy] = [cx + rx * 0.8, cy - ry - 2 - ((t * 0.1) % 4)]

    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]] as const) {
      c.put(zx + dx, zy + dy, 0xcfd6e6, 0.8)
    }
  }
}

// Mouth: chomps while Claude works, an expectant "o" while you type, wide open for a burp.
const mouth = (c: Canvas, f: Shape, busy: boolean) => {
  const { t, monster, rx, ry, typing, burping, sad, starving, angry } = f
  const { x: mx, y: my } = f.mouth
  const open = burping ? 1 : busy ? 0.45 + 0.55 * Math.abs(Math.sin(t * 0.9)) : typing ? 0.35 : 0
  const mw = rx * (monster === 'slime' ? 0.35 : 0.55) * (typing && !busy ? 0.5 : 1)
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

  if (typing && !busy) c.put(mx + mw * 0.6, my + mh + ((t * 0.3) % 3), PROMPT)

  if (burping) {
    for (let i = 0; i < 3; i++) c.disc(mx + (i - 1) * 3, my - mh - 2 - ((t * 0.3 + i) % 6), 1.2, 0xd6f5c8, 0.6)
  }
}

// One frame, `width` by `height` pixels, 0xRRGGBB each. Reads the scene, never moves it.
export const paint = (s: Scene, width: number, height: number): Uint32Array => {
  const c = new Canvas(width, height)
  const f = shape(s, width, height)

  sky(c, f)
  aura(c, f, s.pantry.length > 0)
  ground(c, f, s.minions)
  torso(c, f)
  face(c, f, s.busy)
  mouth(c, f, s.busy)

  for (const mote of s.motes) {
    c.put(mote.px, mote.py, mote.color, 0.4)
    c.put(mote.x, mote.y, mote.color)
  }

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
