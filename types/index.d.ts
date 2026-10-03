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
}
export type Look = { monster: string; color: string }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
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
    }
  }
}
