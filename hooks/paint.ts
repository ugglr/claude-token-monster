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

type Mote = { x: number; y: number; color: number }

export const MINUTE = 60_000
export const SAD = 15 * MINUTE
export const STARVING = 60 * MINUTE
export const BURP = MINUTE

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
  [/^(Agent|Task)/, 0xff6fd8],
  [/^mcp__/, 0xffe066],
]

export const toolColor = (tool: string | undefined) =>
  tool === undefined ? TOKEN : (TOOL_COLORS.find(([match]) => match.test(tool))?.[1] ?? TOKEN)

export const mix = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, t))
  const channel = (shift: number) => {
    const from = (a >> shift) & 255

    return Math.round(from + (((b >> shift) & 255) - from) * k) << shift
  }

  return channel(16) | channel(8) | channel(0)
}

let seed = 7
const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32

// One frame, `width` by `height` pixels, 0xRRGGBB each.
export const paint = (s: Scene, width: number, height: number): Uint32Array => {
  const px = new Uint32Array(width * height)
  const get = (x: number, y: number) => px[Math.round(y) * width + Math.round(x)] ?? 0
  const put = (x: number, y: number, color: number, alpha = 1) => {
    const [cx, cy] = [Math.round(x), Math.round(y)]

    if (cx >= 0 && cy >= 0 && cx < width && cy < height) {
      px[cy * width + cx] = alpha >= 1 ? color : mix(get(cx, cy), color, alpha)
    }
  }
  const disc = (x: number, y: number, r: number, color: number, alpha = 1) => {
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy <= r * r) put(x + dx, y + dy, color, alpha)
      }
    }
  }

  const t = s.tick
  const full = (s.belly?.percent ?? 0) / 100
  const idle = s.belly === null ? 0 : s.at - s.belly.fedAt
  const starving = idle >= STARVING
  const sad = idle >= SAD
  const burping = s.belly?.burpAt != null && s.at - s.belly.burpAt < BURP
  const bursting = full >= 0.9
  const stuffed = full >= 0.75
  const pressure = Math.max(0, ...s.pantry.map(limit => limit.percentUsed))
  const typing = t - s.typedAt < 15
  const angry = t - s.errorAt < 20
  const tool = [...s.tools.values()].at(-1)
  const monster = s.look.monster
  const base = PALETTE[s.look.color] ?? 0x3d7bff
  const body = starving ? mix(base, 0x8a8f99, 0.55) : base
  const floor = height - 3

  // Night sky, twinkling stars, the ground.
  for (let y = 0; y < height; y++) {
    const sky = y >= floor ? (y === floor ? GRASS : GROUND) : mix(SKY_TOP, SKY_BOTTOM, y / height)

    for (let x = 0; x < width; x++) px[y * width + x] = sky
  }

  for (let i = 0; i < 14; i++) {
    put((i * 37 + 11) % width, (i * 23 + 5) % Math.max(1, floor - 4), mix(0x40507a, WHITE, Math.sin(t * 0.15 + i * 1.7) > 0.6 ? 1 : 0.25))
  }

  // The body: bigger as the context fills, thinner when starving.
  const r0 = Math.min(width * 0.5, height * 0.75) * 0.5
  const rx = Math.min(width * 0.45, r0 * (0.75 + 0.6 * full) * (starving ? 0.85 : 1) * (monster === 'slime' ? 1 + 0.05 * Math.sin(t * 0.5) : 1))
  const ry = Math.min(height * 0.36, r0 * (0.8 + 0.35 * full) + Math.sin(t * 0.2) * 0.4)
  const lift = monster === 'ghost' ? 3 + Math.sin(t * 0.15) * 1.5 : s.busy ? Math.abs(Math.sin(t * 0.45)) * 1.2 : 0
  const cx = width / 2 + (monster === 'ghost' ? Math.sin(t * 0.07) * 2 : 0)
  const cy = floor - ry - lift

  // The aura is the pantry: green with room to spare, amber, then pulsing red.
  if (s.pantry.length > 0) {
    const glow = pressure >= 80 ? 0xff3b3b : pressure >= 50 ? 0xffb02e : 0x2fd27a
    const pulse = pressure >= 80 ? 0.55 + 0.45 * Math.sin(t * 0.6) : 1

    for (let y = 0; y < floor; y++) {
      for (let x = 0; x < width; x++) {
        const d = Math.hypot((x + 0.5 - cx) / (rx + 6), (y + 0.5 - cy) / (ry + 5))

        if (d < 1) put(x, y, glow, 0.32 * (1 - d) * pulse)
      }
    }
  }

  // A shadow on the ground, smaller the higher it floats.
  for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const k = 1 - ((x + 0.5 - cx) / rx) ** 2

    if (k > 0) put(x, floor, 0x000000, 0.45 * k * (1 - lift / 8))
  }

  // Minions: one per running subagent.
  for (let i = 0; i < Math.min(4, s.minions); i++) {
    const x = i % 2 === 0 ? 4 + (i >> 1) * 6 : width - 5 - (i >> 1) * 6
    const y = floor - 2 - Math.abs(Math.sin(t * 0.5 + i)) * 2

    disc(x, y, 2.8, mix(body, WHITE, 0.3))
    put(x - 1, y - 1, WHITE)
    put(x + 1, y - 1, WHITE)
    put(x - 1, y, INK)
    put(x + 1, y, INK)
  }

  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 2); y++) {
    for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      let nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry

      if (monster === 'slime' && ny > 0) nx /= 1 + 0.3 * ny

      let d = Math.hypot(nx, ny)

      if (monster === 'cookie') d *= 1 + 0.07 * Math.sin(Math.atan2(ny, nx) * 11 + t * 0.3)

      const inside =
        monster === 'ghost'
          ? ny < 0
            ? d < 1
            : Math.abs(nx) < 1 && ny < 1 + 0.18 * Math.sin(nx * 9 + t * 0.5)
          : d < 1

      if (!inside) continue

      const rim = monster === 'ghost' && ny >= 0 ? Math.abs(nx) : d
      const light = -(nx * 0.5 + ny * 0.8) * 0.35
      let color = light > 0 ? mix(body, WHITE, light) : mix(body, 0x000000, -light)

      if ((monster === 'cookie' || monster === 'gremlin') && (nx / 0.55) ** 2 + ((ny - 0.4) / 0.5) ** 2 < 1) {
        color = mix(color, WHITE, 0.22)
      }
      if (monster === 'slime' && Math.hypot(nx + 0.4, ny + 0.5) < 0.18) color = mix(color, WHITE, 0.6)
      if (rim > 0.88) color = mix(color, 0x000000, 0.45)

      put(x, y, color, monster === 'ghost' ? 0.82 : monster === 'slime' ? 0.9 : 1)
    }
  }

  if (monster === 'slime') {
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * rx * 0.6

      for (let k = 0; k < 1 + ((t * 0.2 + i * 1.3) % 3); k++) put(x, cy + ry * 0.92 + k, mix(body, 0x000000, 0.2))
    }
  }

  if (monster === 'gremlin') {
    for (const side of [-1, 1]) {
      const [tipX, tipY] = [cx + side * rx * 0.85, cy - ry * 1.35]
      const [footX, footY] = [cx + side * rx * 0.5, cy - ry * 0.7]

      for (let y = Math.floor(tipY); y <= footY; y++) {
        const p = (y - tipY) / (footY - tipY)
        const x = tipX + (footX - tipX) * p

        for (let dx = -2 * p; dx <= 2 * p; dx++) put(x + dx, y, mix(0xeadfc8, 0x000000, 0.25 * p))
      }
    }
  }

  // Eyes: where they look says what is happening.
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
      : s.busy
        ? [-0.4, -0.8]
        : [Math.sin(t * 0.05) * 0.7, Math.cos(t * 0.031) * 0.4]
  const blink = t % 53 < 2 && !typing
  const happy = burping || (stuffed && !bursting && !s.busy)

  for (const [ex, ey, side] of eyes) {
    if (bursting) {
      // Dizzy: a white eye, a dark ring, a dot.
      disc(ex, ey, re, WHITE)
      for (let a = 0; a < 16; a++) put(ex + Math.cos((a / 16) * Math.PI * 2 + t * 0.4) * re * 0.6, ey + Math.sin((a / 16) * Math.PI * 2 + t * 0.4) * re * 0.6, INK)
      put(ex, ey, INK)
    } else if (blink || happy) {
      for (let dx = -re; dx <= re; dx++) put(ex + dx, ey - (happy ? (re - Math.abs(dx)) * 0.6 : 0), INK)
    } else {
      const sclera = monster === 'ghost' ? 0x1a1030 : monster === 'gremlin' ? 0xffe14d : WHITE
      const pr = monster === 'gremlin' ? 0 : re * 0.5

      disc(ex, ey, re, sclera)

      if (monster === 'ghost') {
        disc(ex + lx * 0.6, ey + ly * 0.6, re * 0.45, s.busy ? 0x7ff6ff : 0x5f6fbf)
      } else if (monster === 'gremlin') {
        for (let k = -re + 1; k <= re - 1; k++) put(ex + lx * re * 0.5, ey + k, INK)
      } else {
        const [pxx, pyy] = [ex + lx * (re - pr - 0.3), ey + ly * (re - pr - 0.3)]

        disc(pxx, pyy, pr, INK)
        put(pxx - pr * 0.4, pyy - pr * 0.4, WHITE)
      }

      if (starving) {
        for (let dy = -re; dy <= 0; dy++) for (let dx = -re; dx <= re; dx++) if (dx * dx + dy * dy <= re * re) put(ex + dx, ey + dy, body)
      }
    }

    if ((angry || sad) && side !== 0) {
      for (let dx = -re; dx <= re; dx++) {
        const inner = (dx * -side) / re

        put(ex + dx, ey - re - 1.2 + inner * (angry ? 1.2 : -1.2), INK)
      }
    }

    if (sad && !starving && side !== 0) put(ex + side * re * 0.6, ey + re + ((t * 0.4) % 6), 0x6ec6ff)
  }

  if (pressure >= 80 || bursting) put(cx + rx * 0.75, cy - ry * 0.5 + ((t * 0.3) % 4), 0xbfe9ff)

  // Mouth: chomps while Claude works, an expectant "o" while you type.
  const mx = cx
  const my = cy + ry * (monster === 'slime' ? 0.35 : 0.3)
  const open = burping ? 1 : s.busy ? 0.45 + 0.55 * Math.abs(Math.sin(t * 0.9)) : typing ? 0.35 : 0
  const mw = rx * (monster === 'slime' ? 0.35 : 0.55) * (typing && !s.busy ? 0.5 : 1)
  const mh = 0.6 + open * ry * 0.5

  if (mh < 1.2) {
    const frown = sad || starving || angry

    for (let dx = -mw; dx <= mw; dx++) {
      const curve = (dx / mw) ** 2

      put(mx + dx, frown ? my + curve * 1.2 - 0.6 : my - curve * 1.2 + 0.6, INK)
    }
  } else {
    for (let y = Math.floor(my - mh); y <= Math.ceil(my + mh); y++) {
      for (let x = Math.floor(mx - mw); x <= Math.ceil(mx + mw); x++) {
        const [nx, ny] = [(x + 0.5 - mx) / mw, (y + 0.5 - my) / mh]

        if (nx * nx + ny * ny >= 1) continue

        const tooth = ny < -0.5 && x % 2 === 0 && monster !== 'slime'

        put(x, y, tooth ? WHITE : ny > 0.35 ? 0xd94a6e : 0x3a0614)
      }
    }

    if (monster === 'gremlin') {
      for (const side of [-0.5, 0.5]) for (let k = 0; k < 2; k++) put(mx + side * mw, my - mh + 1 + k, WHITE)
    }
  }

  if (typing && !s.busy) put(mx + mw * 0.6, my + mh + ((t * 0.3) % 3), PROMPT)

  if (burping) {
    for (let i = 0; i < 3; i++) disc(mx + (i - 1) * 3, my - mh - 2 - ((t * 0.3 + i) % 6), 1.2, 0xd6f5c8, 0.6)
  }

  if (starving) {
    const [zx, zy] = [cx + rx * 0.8, cy - ry - 2 - ((t * 0.1) % 4)]

    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]] as const) {
      put(zx + dx, zy + dy, 0xcfd6e6, 0.8)
    }
  }

  // Token motes: from the edges while Claude works, from the prompt while you type.
  if (s.busy) {
    for (let i = 0; i < (s.tools.size > 0 ? 2 : 1); i++) {
      s.motes.push({ x: random() < 0.5 ? 0 : width - 1, y: 2 + random() * (floor - 6), color: toolColor(tool) })
    }
  }

  for (let i = 0; i < Math.min(3, s.queued); i++) s.motes.push({ x: random() * width, y: height - 1, color: PROMPT })

  s.queued = Math.max(0, s.queued - 3)
  s.motes = s.motes.slice(-80).filter(mote => {
    const [dx, dy] = [mx - mote.x, my - mote.y]
    const dist = Math.hypot(dx, dy)

    if (dist < 1.5) return false

    put(mote.x, mote.y, mote.color, 0.4)
    mote.x += (dx / dist) * Math.min(dist, 1.8)
    mote.y += (dy / dist) * Math.min(dist, 1.8)
    put(mote.x, mote.y, mote.color)

    return true
  })

  return px
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
