export type Belly = { percent: number; tokens: number; window: number; ate: number; fedAt: number }
export type Look = { monster: string; color: string }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Dish = { id: string; tool: string; label: string; tokens: number }

declare module 'claude-code' {
  interface PluginState {
    'token-monster': {
      belly: Belly | null
      look: Look
      frame: number
      now: number
      pantry: Limit[]
      menu: Dish[]
      picked: string[]
    }
  }
}
