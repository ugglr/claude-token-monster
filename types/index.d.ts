// The contract must be self-contained (no imports), so Limit mirrors the
// engine's SessionRateLimit here rather than importing it.
export type Belly = {
  percent: number
  tokens: number
  window: number
  ate: number
  fedAt: number
  burpAt: number | null
  known: boolean
  // Where auto-compaction runs, in tokens, or null when it is off or unknown;
  // `fill` is the percent of that point used (of the window without one).
  compactAt: number | null
  fill: number
}
export type Look = { monster: string; color: string }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
// One category of the context window, as /context lists it: `used`, `free`, or the
// auto-compact `buffer`.
export type Slice = { name: string; tokens: number; kind: string }
export type Dish = { id: string; tool: string; label: string; tokens: number }

declare module 'claude-code' {
  interface PluginState {
    'token-monster': {
      belly: Belly | null
      look: Look
      now: number
      pantry: Limit[]
      doing: string
      menu: Dish[]
      picked: string[]
      armed: string[]
      serving: number
      view: string
      slices: Slice[]
      level: number
      combo: number
      chat: { eye: string; say: string } | null
      xp: number
      born: number | null
      hatching: boolean
    }
  }
}
