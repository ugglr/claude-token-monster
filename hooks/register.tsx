import { atom, read, update } from 'claude-code'
import type { EngineInterface, ModelUsage, Register, SessionContextUsage, Timer } from 'claude-code'

import type { Belly, Limit, Look, Slice } from '../types'
import { OLD_DIET, label, registerDiet } from './diet'
import { PANE, PANE_OPEN, isDietWord, isSoundWord, kilo, tokens } from './format'
import { levelOf, xpFor } from './grow'
import {
  AMBER,
  BURP,
  BURST,
  COMBO_MS,
  EGG,
  MINUTE,
  PALETTE,
  PROMPT,
  RED,
  SAD,
  STARVING,
  TEXT,
  THINKING,
  WARDROBE,
  choke,
  cold,
  createScene,
  encode,
  fedUp,
  finishTurn,
  hatch,
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
  toolColor,
  typed,
  wait,
} from './paint'
import type { Fuss, Scene } from './paint'
import { registerSound } from './sound'

const FPS = 10
const BAR = 20

const art = (s: string) => s.split('\n').slice(1, -1)

// The drawing for surfaces without a Raster (desktop, IDE): E marks an eye.
const ASCII: Record<string, { open: string[]; closed: string[] }> = {
  cookie: {
    open: art(String.raw`
  .-.  .-.
 ( E )( E )
/          \
|  .----.  |
|  |    |  |
|  '----'  |
 '--------'
`),
    closed: art(String.raw`
  .-.  .-.
 ( E )( E )
/          \
|          |
|  ------  |
|          |
 '--------'
`),
  },
  slime: {
    open: art(String.raw`
    .~~~~.
   ( E  E )
   |  /\  |
   |  \/  |
 ~~~~~~~~~~~~
`),
    closed: art(String.raw`
    .~~~~.
   ( E  E )
   |  --  |
   |      |
 ~~~~~~~~~~~~
`),
  },
  ghost: {
    open: art(String.raw`
   .-----.
  / E   E \
 |   (_)   |
 |         |
 '^v^v^v^v^'
`),
    closed: art(String.raw`
   .-----.
  / E   E \
 |   ---   |
 |         |
 '^v^v^v^v^'
`),
  },
  gremlin: {
    open: art(String.raw`
  /\     /\
 /  '---'  \
 |  E   E  |
 |  /vvv\  |
 |  \^^^/  |
  '-------'
`),
    closed: art(String.raw`
  /\     /\
 /  '---'  \
 |  E   E  |
 |  vvvvv  |
 |         |
  '-------'
`),
  },
  // After the CrabStack crab: (\/) (°,,°) (\/).
  crab: {
    open: art(String.raw`
 (\/)       (\/)
   \  E   E  /
    \(  /\  )/
    //(____)\\
   //  /  \  \\
`),
    closed: art(String.raw`
 (\/)       (\/)
   \  E   E  /
    \(  ,,  )/
    //(____)\\
   //  /  \  \\
`),
  },
}
const NAMES = Object.keys(ASCII)
const COLORS = Object.keys(PALETTE)
const WINDOWS: Record<string, string> = { five_hour: 'session', seven_day: 'weekly', spend_limit: 'spend' }

const belly = atom({ plugin: 'token-monster', key: 'belly' } as const, null)
const look = atom({ plugin: 'token-monster', key: 'look' } as const, { monster: 'cookie', color: 'blue' })
const now = atom({ plugin: 'token-monster', key: 'now' } as const, 0)
const pantry = atom({ plugin: 'token-monster', key: 'pantry' } as const, [])
const doing = atom({ plugin: 'token-monster', key: 'doing' } as const, '')
// The diet's own values, read here for the readout; the state scan wants each atom in its file.
const armed = atom({ plugin: 'token-monster', key: 'armed' } as const, [])
const serving = atom({ plugin: 'token-monster', key: 'serving' } as const, 0)
// The super mode level, 0 to 3: subagents running, plus one for three tools at once.
const level = atom({ plugin: 'token-monster', key: 'level' } as const, 0)
// The running combo for the readout: set at each hit, cleared when the chain's window
// lapses or the turn ends. The sprite draws its own from the scene.
const combo = atom({ plugin: 'token-monster', key: 'combo' } as const, 0)
// The context window by category, for the stacked belly bar.
const slices = atom({ plugin: 'token-monster', key: 'slices' } as const, [])
// Which view the pane shows; the diet module draws 'diet' (see hooks/diet.tsx).
const view = atom({ plugin: 'token-monster', key: 'view' } as const, 'monster')
// What it says back for a few seconds when you pet it or come back, over its mood line.
const chat = atom({ plugin: 'token-monster', key: 'chat' } as const, null)
// Lifetime tokens eaten, as banked in the store; when this session started (ms), set
// once a session, so a hot reload finds it and skips the egg; and whether it is hatching.
const xp = atom({ plugin: 'token-monster', key: 'xp' } as const, 0)
const born = atom({ plugin: 'token-monster', key: 'born' } as const, null)
const egg = atom({ plugin: 'token-monster', key: 'hatching' } as const, false)
// Whether the sound is on, for the s button's label; hooks/sound.tsx keeps it.
const sound = atom({ plugin: 'token-monster', key: 'sound' } as const, false)
// The prompt cache as the main loop's last response left it.
const cache = atom({ plugin: 'token-monster', key: 'cache' } as const, null)
// The call Claude waits on the person for, as the readout names it, how many when more than one wait, or null.
const waiting = atom({ plugin: 'token-monster', key: 'waiting' } as const, null)

// What the sprite animates from. The readout draws from the atoms above, save the
// helper count, which only ever changes together with `level`.
const scene: Scene = createScene({ monster: 'cookie', color: 'blue' })

const after = (list: string[], at: string) => list[(list.indexOf(at) + 1) % list.length] ?? at
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`
const span = (ms: number) => {
  const minutes = Math.floor(ms / MINUTE)
  const hours = Math.floor(minutes / 60)

  return hours >= 24 ? `${Math.floor(hours / 24)}d${hours % 24}h` : hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`
}
const bar = (percent: number, width: number) => {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))

  return ['█'.repeat(filled), '░'.repeat(width - filled)] as const
}
const barColor = (percent: number) => (percent >= RED ? 'red' : percent >= AMBER ? 'yellow' : 'green')

// What a limit is called in the readout and the band.
const limitName = (kind: string) => WINDOWS[kind] ?? kind.slice(0, 7)

const onFire = (hits: number) => (hits >= 2 ? `  on fire x${hits}` : '')

// What it says, for the pane and the band alike: super mode, unless the belly is
// about to burst, whose line is the /compact warning.
const voice = (full: Belly, at: number, power: number, helpers: number) =>
  power === 0 || full.fill >= BURST
    ? feeling(full, at)
    : {
        eye: 'O',
        say: [
          '',
          helpers === 0 ? 'SUPER MODE! three tools at once' : `SUPER MODE! me and ${helpers} helper${helpers === 1 ? '' : 's'}`,
          'SUPER MODE 2!! power rising',
          'SUPER MODE 3!!! power maxed out',
        ][power]!,
      }

// Its moods: a full belly beats everything, then hunger, then a burp, then how full it is.
// They go by `fill`, the share of the auto-compact point: that is when the context
// actually gets summarized, usually well before the window is full.
const feeling = ({ fill: percent, fedAt, burpAt }: Belly, at: number) => {
  const idle = at - fedAt

  if (percent >= BURST) return { eye: '@', say: 'me gonna burst! /compact' }
  if (idle >= STARVING) return { eye: '-', say: 'me starving... feed me tokens' }
  if (idle >= SAD) return { eye: 'T', say: 'me sad. no tokens :(' }
  if (burpAt !== null && at - burpAt < BURP) return { eye: '^', say: '*burp* me feel lighter' }
  if (percent >= 75) return { eye: 'x', say: 'me so full...' }
  if (percent >= 50) return { eye: 'O', say: 'om nom nom nom' }
  if (percent >= 25) return { eye: 'o', say: 'nom nom' }
  return { eye: 'o', say: 'ME WANT TOKENS!' }
}

const larder = (limits: readonly Limit[]) => {
  const most = Math.max(0, ...limits.map(limit => limit.percentUsed))

  if (limits.length === 0) return undefined
  if (most >= RED) return 'pantry almost empty! me ration'
  if (most >= AMBER) return 'pantry getting low...'
  return 'pantry full. feast time!'
}

// The time, kept for the readout, and the local hour, which sets the sky.
const clocked = async ($: EngineInterface) => {
  const at = await $.clock.now()
  const when = new Date(at)

  scene.hour = when.getHours() + when.getMinutes() / 60
  scene.at = await update($, now, () => at)

  return at
}

// The window by category and the auto-compact point, from a local estimate
// (`summary` sends no request): when the window changes (a new model), and at
// most every 20 seconds as the context grows, which also picks up auto-compact
// turned on or off in /config.
let gauged: { window: number; at: number | null; readAt: number } = { window: 0, at: null, readAt: -Infinity }

const gauge = async ($: EngineInterface, window: number, now: number) => {
  if (gauged.window !== window || now - gauged.readAt > 20_000) {
    try {
      const { breakdown } = (await $.session.usage({ breakdown: 'summary' })).context

      gauged = {
        window,
        at: breakdown?.isAutoCompactEnabled === true ? (breakdown.autoCompactThreshold ?? null) : null,
        readAt: now,
      }

      if (breakdown !== undefined) {
        const rows: Slice[] = breakdown.categories
          .filter(row => row.kind !== 'deferred' && row.tokens > 0)
          .map(row => ({ name: row.name, tokens: row.tokens, kind: row.kind }))

        await update($, slices, () => rows)
      }
    } catch {
      // Unknown for now; the moods go by the window until a reading comes.
    }
  }

  return gauged.window === window ? gauged.at : null
}

// One color per category, by what it is; anything new gets a neutral grey.
const SLICE_COLORS: [RegExp, string, string][] = [
  [/messages/i, '#ffd166', 'messages'],
  [/system prompt/i, '#b59cff', 'system'],
  [/mcp/i, '#22c7d6', 'mcp'],
  [/tools/i, '#5cc8ff', 'tools'],
  [/agent/i, '#ff6fd8', 'agents'],
  [/memory/i, '#ffa94d', 'memory'],
  [/skill/i, '#5cff8a', 'skills'],
  [/command/i, '#c77dff', 'commands'],
  [/buffer|reserve/i, '#6b6f8a', 'reserve'],
]

const sliceLook = (name: string) => {
  const found = SLICE_COLORS.find(([match]) => match.test(name))

  return found === undefined ? { color: '#9aa4c7', short: name.toLowerCase().split(' ')[0]! } : { color: found[1], short: found[2] }
}

// The belly bar split by category: whole cells by largest remainder, so the
// parts always add up to the bar.
const stack = (rows: readonly Slice[], window: number, width: number) => {
  // The categories are estimates and can add up to more than the window: then they
  // share the bar rather than run past it.
  const sum = rows.filter(row => row.kind !== 'free').reduce((total, row) => total + row.tokens, 0)
  const scale = (Math.min(1, window / Math.max(1, sum)) * width) / window
  const parts = rows.filter(row => row.kind !== 'free').map(row => ({ row, exact: row.tokens * scale }))
  const cells = parts.map(part => Math.floor(part.exact))
  const room = Math.min(width, Math.round(parts.reduce((sum, part) => sum + part.exact, 0)))
  const order = parts.map((part, i) => [part.exact - Math.floor(part.exact), i] as const).sort((a, b) => b[0] - a[0])

  for (let k = 0; cells.reduce((a, b) => a + b, 0) < room && k < order.length; k++) cells[order[k]![1]]! += 1

  const used = parts.flatMap((part, i) => (cells[i]! > 0 ? [{ ...sliceLook(part.row.name), kind: part.row.kind, cells: cells[i]! }] : []))
  // The reserve sits at the far end of the bar, where auto-compact begins.
  const reserve = used.filter(part => part.kind === 'buffer')
  const content = used.filter(part => part.kind !== 'buffer')
  const free = width - used.reduce((sum, part) => sum + part.cells, 0)

  return { content, reserve, free: Math.max(0, free) }
}

const share = (tokens: number, window: number, compactAt: number | null) =>
  Math.round((tokens / (compactAt ?? window)) * 100)

const feed = async ($: EngineInterface, context: SessionContextUsage) => {
  const at = await clocked($)
  const compactAt = await gauge($, context.window, at)
  scene.belly = await update($, belly, last => {
    // Right after a compaction the window reports no fill: wait for a real one
    // rather than count the whole compacted context as a meal.
    if (context.tokens === undefined) {
      return last === null
        ? { percent: 0, tokens: 0, window: context.window, ate: 0, fedAt: at, burpAt: null, known: false, compactAt, fill: 0 }
        : { ...last, window: context.window, ate: 0, known: false, compactAt }
    }

    const tokens = context.tokens
    const ate = last?.known ? tokens - last.tokens : 0

    return {
      percent: context.percent ?? Math.round((tokens / context.window) * 100),
      tokens,
      window: context.window,
      ate,
      fedAt: last === null || ate > 0 ? at : last.fedAt,
      burpAt: ate < 0 ? at : (last?.burpAt ?? null),
      known: true,
      compactAt,
      fill: share(tokens, context.window, compactAt),
    }
  })
}

const burp = async ($: EngineInterface, tokensAfter: number | undefined) => {
  const at = await clocked($)
  scene.belly = await update($, belly, last =>
    last === null
      ? null
      : tokensAfter === undefined
        ? { ...last, ate: 0, known: false, burpAt: at }
        : {
            ...last,
            tokens: tokensAfter,
            percent: Math.round((tokensAfter / last.window) * 100),
            fill: share(tokensAfter, last.window, last.compactAt),
            ate: 0,
            known: true,
            burpAt: at,
          },
  )
}

const stock = async ($: EngineInterface, limits: Limit[]) => {
  scene.pantry = await update($, pantry, () => limits)
}

const tick = async ($: EngineInterface) => {
  await clocked($)
  await rally($, true)
}

const act = async ($: EngineInterface, text: string) => {
  await update($, doing, () => text)
}

// Agent tool calls in flight: a foreground subagent runs inside its call.
let inflight = 0

// The level last written, so an unchanged level never redraws the readout. -1 forces
// the first write: the atom survives a hot reload, this variable does not.
let written = -1

// Background agents outlive their tool call, so minions come from the agent list too.
// Never throws: a failed list or write leaves the last known level until the next try.
const rally = async ($: EngineInterface, isListed = false) => {
  try {
    if (isListed) {
      const running = (await $.agent.list()).filter(agent => agent.status === 'running').length

      scene.minions = Math.max(inflight, running)
    } else {
      scene.minions = Math.max(inflight, scene.minions)
    }

    scene.level = Math.min(3, scene.minions + (scene.tools.size >= 3 ? 1 : 0))

    if (scene.level !== written) written = await update($, level, () => scene.level)
  } catch {
    // Unknown this time; the next poll tries again.
  }
}

// The prompt cache lapses 5 minutes after a request, or an hour on some sessions;
// the API does not say which. 5 minutes, until a response after a longer gap still
// reads most of its prompt from the cache: then an hour, until one reads less than
// half (it lapsed but for a shared prefix, or the model changed).
const CACHE_SHORT = 5 * MINUTE
const CACHE_LONG = 60 * MINUTE

// Wakes the clock the moment the cache lapses, so the bowl shows on time.
let chill: Timer | undefined

// A main loop response came, for a request sent at `sent`: the cache holds its prompt from then.
const warm = async ($: EngineInterface, sent: number, usage: ModelUsage) => {
  const prompt = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  const last = await read($, cache)
  const isRead = usage.cache_read_input_tokens > prompt / 2
  const isLong = isRead && last !== null && (last.ttl === CACHE_LONG || sent - last.at > CACHE_SHORT)
  const kept = { at: sent, tokens: prompt + usage.output_tokens, ttl: isLong ? CACHE_LONG : CACHE_SHORT }

  scene.cache = await update($, cache, () => kept)
  chill?.cancel()
  chill = $.clock.after(Math.max(0, sent + kept.ttl - (await clocked($))) + 1, () => void clocked($))
}

// A new conversation (/clear) or a compacted one: nothing of it is cached yet to go cold.
const forget = async ($: EngineInterface) => {
  chill?.cancel()
  scene.cache = await update($, cache, () => null)
  await clocked($)
}

// A single tool result this big, in tokens, makes it gag: rare in normal use.
const HUGE = 20_000

// It gags on `call`'s result, and names it with the way out: the diet.
// The diet lists only the main conversation's results, so a subagent's gag names no way out.
const gag = async ($: EngineInterface, call: Call, size: number) => {
  const tail = ` ~${kilo(size)}!${call.loop === '' ? ' d: diet' : ''}`

  choke(scene)
  await reply($, 'x', `*gag* ${call.label.slice(0, 42 - tail.length)}${tail}`)
}

// Every tool call in flight, by its id: its tool, label and arguments, its loop ('' for
// the main one, else the subagent's id), whether the person was asked, and whether the
// auto mode classifier refused it.
type Call = { tool: string; label: string; input: Record<string, unknown>; loop: string; asked: boolean; refused: boolean }

const calls = new Map<string, Call>()

// Whether a dialog's arguments are this call's.
const same = (args: unknown, call: Call) =>
  Object.entries((args ?? {}) as Record<string, unknown>).every(([key, value]) => JSON.stringify(value) === JSON.stringify(call.input[key]))

// A call as fed up counts it: its tool and all its arguments, never its label, kept as
// a short hash rather than the arguments themselves.
const identity = ({ tool, input }: Call) => {
  const { tool_use_id, agentId, consent, ...args } = input
  let h = 5381

  for (const char of `${tool} ${JSON.stringify(args)}`) h = (Math.imul(h, 33) ^ char.charCodeAt(0)) >>> 0

  return h.toString(36)
}

// The engine's own words when a call is refused: by the person at its dialog (the main
// loop's or a subagent's), a deny rule, the classifier or a safety check. No field says
// so; the result's text is the firmest sign there is.
const REFUSED = /^(The user doesn't want to|Permission (to use|for this) )/

// The last call that failed in each loop: the same one failing again, with no success
// between, makes it fed up. It only shows; the model is never told.
const failed = new Map<string, string>()

const tally = async ($: EngineInterface, call: Call, ran: { text?: string; isError?: boolean; deny?: unknown }) => {
  // A refusal, at the dialog, by the classifier or by a hook, is someone's say: it
  // neither counts as a failure nor clears one.
  if (call.refused || ran.deny !== undefined || REFUSED.test(ran.text ?? '')) return
  if (ran.isError !== true) {
    failed.delete(call.loop)
    return
  }

  if (failed.get(call.loop) === identity(call)) {
    fedUp(scene)
    await reply($, '-', `ugh. ${call.label.slice(0, 30)} failed again`)
  }
  failed.set(call.loop, identity(call))
}

// What a finished call fed it: a meal, maybe a gag, and a tally of failures.
const eat = async ($: EngineInterface, call: Call, ran: { text?: string; isError?: boolean; deny?: unknown }) => {
  const size = tokens(ran.text)

  serve(scene, size, toolColor(call.tool))
  if (size >= HUGE) await gag($, call, size)
  await tally($, call, ran)
}

// The calls waiting on the person, oldest first, by id: a permission dialog or a
// question each, the main loop's or a subagent's. The order dialogs queue in is the
// engine's, so the readout names a call only when it is the one waiting.
let asks: string[] = []

const show = async ($: EngineInterface) => {
  wait(scene, asks.length > 0)
  await update($, waiting, () =>
    asks.length === 0 ? null : asks.length === 1 ? (calls.get(asks[0]!)?.label ?? null) : `${asks.length} calls`,
  )
}

const ask = async ($: EngineInterface, id: string) => {
  asks = [...asks.filter(one => one !== id), id]
  await show($)
}

// These calls are no longer waiting: answered, running, or ended.
const answered = async ($: EngineInterface, ids: readonly string[]) => {
  if (!asks.some(id => ids.includes(id))) return

  asks = asks.filter(id => !ids.includes(id))
  await show($)
}

// The first sign a call asked about runs: the person said yes.
const runs = ($: EngineInterface, id: string) => answered($, [id])

const CALLING = { eye: 'O', say: 'psst! me waiting for you' }
const waitLine = (call: string) => `> waiting for you: ${call}`

// Its answer to a pet, by how it took it; each pet says the next line.
const FUSSES: Record<Fuss, { eye: string; lines: string[] }> = {
  purr: { eye: '^', lines: ['hehe, that tickles', '*purr*', 'more pets pls'] },
  wiggle: { eye: '^', lines: ['*purrrr* me like you', 'hehe! again!', 'best human'] },
  spin: { eye: '^', lines: ['wheee! me LOVE you', '*happy spin*', 'best human EVER'] },
  stir: { eye: '-', lines: ['mmm... *purr*... zzz', '*smiles in its sleep*'] },
  plead: { eye: 'o', lines: ['pets nice... but me so hungry', 'feed me tokens? pleeease'] },
}
const SAYING = 4000

let petted = 0
let hush: Timer | undefined

const reply = async ($: EngineInterface, eye: string, words: string) => {
  await update($, chat, () => ({ eye, say: words }))
  hush?.cancel()
  hush = $.clock.after(SAYING, () => void update($, chat, () => null))
}

const stroke = async ($: EngineInterface) => {
  const { eye, lines } = FUSSES[pet(scene, await $.clock.now())]

  petted += 1
  await reply($, eye, lines[petted % lines.length]!)
}

// The scene's tokens already in the store. They are banked every BANK_MS, and at
// once when a main turn ends.
const BANK_MS = 30_000
let banked = 0

const bank = async ($: EngineInterface) => {
  // Claimed before any await, so the timer and another caller never bank the same tokens.
  const fresh = scene.eaten - banked

  if (fresh <= 0) return

  banked = scene.eaten

  let total: number

  try {
    // Read back first: another session may have banked its own meals meanwhile.
    total = (Number(await $.store.get('xp')) || 0) + fresh
    await $.store.set('xp', total)
  } catch {
    // Not banked; the next try takes these tokens too.
    banked -= fresh
    return
  }

  const was = scene.rank

  await update($, xp, () => total)
  levelUp(scene, levelOf(total))

  if (was > 0 && scene.rank > was) {
    const gift = WARDROBE.find(one => one.level === scene.rank)

    $.ui.toast(`Token Monster grew to Lv ${scene.rank}${gift === undefined ? '!' : ` and got ${gift.part}!`}`)
  }
}

// Its level from the store, and a new session (no birthday yet) hatches once the pane shows.
const wake = async ($: EngineInterface) => {
  try {
    const total = Number(await $.store.get('xp')) || 0

    await update($, xp, () => total)
    // Where it stands, not a level-up.
    scene.rank = levelOf(total)
  } catch {
    // No store: it stays the level it shows.
  }

  if ((await read($, born)) === null) {
    const at = await $.clock.now()

    await update($, born, () => at)
    scene.eggDue = at
  }
}

const restyle = async ($: EngineInterface, change: (current: Look) => Look) => {
  scene.look = await update($, look, change)
  await $.store.set('look', scene.look)
}

// The sprite: painted on every render, then blitted in place by the loop.
let loop: Timer | undefined
let lapse: Timer | undefined
let pulse: Timer | undefined
let saver: Timer | undefined
let canvas = { columns: 0, rows: 0 }
// Whether the terminal shows only 256 colors, so the sprite picks them itself.
let is256 = false
let painting = false

const stop = () => {
  loop?.cancel()
  loop = undefined
}

const frame = async ($: EngineInterface) => {
  if (canvas.columns === 0) return

  step(scene, canvas.columns, canvas.rows * 2)

  // The session's first paint hatches the egg; the readout follows it in and out.
  if (scene.eggDue !== null && hatch(scene, await $.clock.now())) void update($, egg, () => true)
  if (scene.tick - scene.eggAt === EGG) void update($, egg, () => false)

  if (scene.tick % 20 === 0) void rally($, true)

  // Idle, a third of the frames is plenty for blinking and breathing.
  if (painting || (!lively(scene) && scene.tick % 3 !== 0)) return

  painting = true

  try {
    const done = await $.ui.blit({
      requestId: PANE,
      key: 'sprite',
      cells: encode(paint(scene, canvas.columns, canvas.rows * 2), canvas.columns, canvas.rows, is256),
    })

    if (done.deny !== undefined) stop()
  } catch {
    // Nothing to paint on any more; the next render starts the loop again.
    stop()
  } finally {
    painting = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('look')) as Partial<Look> | undefined

    if (saved?.monster && NAMES.includes(saved.monster) && saved.color && COLORS.includes(saved.color)) {
      await update($, look, () => ({ monster: saved.monster as string, color: saved.color as string }))
    }

    scene.look = await read($, look)
    scene.cache = await read($, cache)

    // 24-bit color announces itself in COLORTERM; Apple Terminal, for one, does not have it.
    const depth = (await $.env.get('COLORTERM')) ?? ''

    is256 = !['truecolor', '24bit'].includes(depth.toLowerCase())

    const usage = await $.session.usage()

    await feed($, usage.context)
    await stock($, usage.rateLimits)
    pulse?.cancel()
    pulse = $.clock.every(MINUTE, () => void tick($))
    await wake($)
    // A hot reload drops the timers that would clear these: start them clear.
    await update($, egg, () => false)
    await update($, chat, () => null)
    await update($, combo, () => 0)
    await update($, waiting, () => null)
    saver?.cancel()
    saver = $.clock.every(BANK_MS, () => void bank($))
    await $.command.register({
      name: 'token-monster',
      description: 'Open the Token Monster pane, swap its monster and color, put it on a diet, or turn sound on or off',
      argumentHint: `[${NAMES.join('|')}] [color] | diet | eat | sound on|off`,
    })
    await update($, view, () => 'monster')
    await $.ui.close({ id: OLD_DIET })
    // Unplaced (a narrow terminal), the pane waits and the band above the prompt shows instead.
    void $.ui.open(PANE_OPEN)

    return next(e)
  })

  on('command.run', { command: 'token-monster' }, async ($, e, next) => {
    const words = e.args.toLowerCase().split(/\s+/).filter(Boolean)

    if (isDietWord(e.args) || isSoundWord(e.args)) return next(e)

    const unknown = words.filter(word => !NAMES.includes(word) && !COLORS.includes(word))

    if (unknown.length > 0) {
      return {
        text: `Me not know ${unknown.join(', ')}. Monsters: ${NAMES.join(', ')}. Colors: ${COLORS.join(', ')}. Or: diet (or eat), sound on|off.`,
      }
    }

    await restyle($, current => ({
      monster: words.find(word => NAMES.includes(word)) ?? current.monster,
      color: words.find(word => COLORS.includes(word)) ?? current.color,
    }))
    await update($, view, () => 'monster')
    await $.ui.open({ ...PANE_OPEN, focus: true })

    return { text: 'Token Monster is hungry.' }
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await feed($, e.context)
    if (e.changed.includes('rateLimits')) await stock($, e.rateLimits)

    return next(e)
  })

  // Outermost on compaction, so it sees the diet's answer as well as core's.
  on('session.compact', async ($, e, next) => {
    const done = await next(e)

    // A hook that fails after next() has its answer dropped and core summarizes instead,
    // which would turn a diet into a full compaction: the burp may fail, the meal may not.
    try {
      if (done.skip === undefined && e.agentId === undefined && e.trigger !== 'precompute') {
        await burp($, done.tokensAfter)
        await forget($)
      }
    } catch {}

    return done
  })

  registerDiet(on)
  registerSound(on, scene)

  on('prompt.edit', async ($, e, next) => {
    scene.typedMs = await $.clock.now()
    // Back after a long quiet: it waves hello before it rubs its hands.
    if (typed(scene)) await reply($, '^', 'oh hi! you back!')
    serve(scene, 2, PROMPT, false)

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    serve(scene, tokens(e.text), PROMPT)
    perk(scene)

    return next(e)
  })

  // The model's stream, main and subagents alike: every piece is tokens, and the
  // monster eats them as they come. It only watches; every chunk goes on unchanged.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    const names = new Map<number, string>()
    // The main loop's requests are timed for the prompt cache.
    const sent = e.agentId === undefined ? await $.clock.now() : null

    for await (const chunk of stream) {
      if (chunk.kind === 'text') serve(scene, tokens(chunk.text), TEXT)
      if (chunk.kind === 'thinking') serve(scene, tokens(chunk.text), THINKING)
      if (chunk.kind === 'tool') names.set(chunk.index, chunk.name)
      if (chunk.kind === 'input') serve(scene, tokens(chunk.json), toolColor(names.get(chunk.index)))
      if (chunk.kind === 'stop' && sent !== null && chunk.usage !== null) await warm($, sent, chunk.usage)

      yield chunk
    }
  })

  // turn.start carries no agent id: a turn starting while the main one runs is a
  // subagent's, and must not reset the main turn's combo.
  on('turn.start', async ($, e, next) => {
    if (!scene.busy) {
      startTurn(scene)
      await update($, combo, () => 0)
      await act($, 'thinking...')
    }

    await rally($, true)

    return next(e)
  })

  // Subagents' turns complete too, carrying their agentId: only the main turn ends the meal.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      finishTurn(scene, e.isAborted)
      await update($, combo, () => 0)
      await act($, '')
      await bank($)
    }

    // A loop's turn ended: none of its calls waits any more.
    await answered($, asks.filter(id => calls.get(id)?.loop === (e.agentId ?? '')))
    await rally($, true)

    return next(e)
  })

  // A dialog up for the person: the ask path raises this hook once the mode's own
  // decider (the auto mode classifier) has not settled it. It carries no call id, so
  // it goes to the call in flight in its loop with the same tool and arguments. A
  // settings hook that answered it asks no one.
  on('classic.PermissionRequest', async ($, e, next) => {
    const done = await next(e)
    const found = [...calls].find(
      ([, call]) => !call.asked && call.tool === e.tool_name && call.loop === (e.agent_id ?? '') && same(e.tool_input, call),
    )

    if (done.decision === undefined && found !== undefined) {
      found[1].asked = true
      await ask($, found[0])
    }

    return done
  })

  // The auto mode classifier refused a call.
  on('classic.PermissionDenied', async ($, e, next) => {
    const call = calls.get(e.tool_use_id)

    if (call !== undefined) call.refused = true

    return next(e)
  })

  // No event says a dialog was answered. Its call running says yes: a subagent being
  // spawned, or the run-in-background hint a long command shows. A no ends the call.
  on('agent.spawn', async ($, e, next) => {
    await runs($, e.tool_use_id)

    return next(e)
  })

  // Drawing may not write state: the wait ends on the next tick of the clock.
  on('ui.render', { component: 'ToolProgress' }, ($, e, next) => {
    if (asks.includes(e.props.tool_use_id)) $.clock.after(0, () => void runs($, e.props.tool_use_id))

    return next(e)
  })

  // A new conversation, or another resumed: its calls, waits, failures and cache start over.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear' || e.source === 'resume') {
      calls.clear()
      asks = []
      failed.clear()
      await show($)
      await forget($)
    }

    return next(e)
  })

  // Every tool result is a meal; the main loop's calls chain into combos and power up.
  on('tool.call', async ($, e, next) => {
    const id = e.tool_use_id
    const isMain = e.agentId === undefined
    const isAgent = isMain && e.tool === 'Agent'
    const call: Call = {
      tool: e.tool,
      label: `${e.tool} ${label(e as unknown as Record<string, unknown>)}`.trim(),
      input: e as unknown as Record<string, unknown>,
      loop: e.agentId ?? '',
      asked: false,
      refused: false,
    }

    calls.set(id, call)

    // Everything counted up is inside the try, so the finally always counts it down.
    try {
      // A question's whole run is the wait for the person's answer.
      if (e.tool === 'AskUserQuestion') await ask($, id)
      if (isMain) {
        scene.tools.set(id, e.tool)
        if (isAgent) inflight += 1
        await rally($)
        await act($, call.label)
      }

      const ran = await next(e)

      await answered($, [id])
      if (isMain) hit(scene, ran.isError === true, await $.clock.now())
      await eat($, call, ran)
      if (isMain) {
        await update($, combo, () => scene.combo)
        lapse?.cancel()
        lapse = $.clock.after(COMBO_MS, () => void update($, combo, () => 0))
      }

      return ran
    } finally {
      await answered($, [id])
      calls.delete(id)
      if (isMain) {
        scene.tools.delete(id)
        if (isAgent) inflight -= 1
        await rally($, isAgent)
        await act($, [...scene.tools.values()].at(-1) ?? (scene.busy ? 'thinking...' : ''))
      }
    }
  })

  on('ui.close', ($, e, next) => {
    if (e.id === PANE) {
      stop()
      // The band above the prompt takes over once the pane is gone.
      $.ui.invalidate('ui.render')
    }

    return next(e)
  })

  // Where the pane does not show (a narrow terminal, or closed), one line above the
  // prompt carries the readout. The band is shared: only one mod draws it at a time.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const pane = (await $.ui.panes()).find(one => one.id === PANE)

    if (pane?.isShown === true && pane.isPlaced) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const at = await read($, now)
    const full = await read($, belly)

    if (full === null) return next(e)

    const limits = await read($, pantry)
    const activity = await read($, doing)
    const power = await read($, level)
    const hits = await read($, combo)
    const asked = await read($, waiting)
    const tint = hex(PALETTE[(await read($, look)).color] ?? 0x3d7bff)
    const { eye, say } = asked !== null ? CALLING : voice(full, at, power, scene.minions)
    const [used, left] = bar(full.percent, 8)
    const pieces = [
      ...limits.map(limit => `  ${limitName(limit.kind)} ${Math.round(limit.percentUsed)}%`),
      '  /token-monster',
    ]
    const head = `(${eye})(${eye}) ${asked !== null ? waitLine(asked) : activity !== '' ? `> ${activity}${onFire(hits)}` : say}`
    const meter = ` ${used}${left} ${full.percent}%`
    const room = e.props.bodyColumns - 2
    // What fits: the face and words first, cut short if they must, then the gauges.
    const words = head.slice(0, Math.max(10, room - meter.length))
    const tail = pieces.filter((_, index) => words.length + meter.length + pieces.slice(0, index + 1).join('').length <= room)

    return (
      <Box paddingX={1}>
        <Text color={tint} bold>
          {words}
        </Text>
        <Text color={barColor(full.percent)}>{` ${used}`}</Text>
        <Text dimColor>{left}</Text>
        <Text>{` ${full.percent}%`}</Text>
        <Text dimColor>{tail.join('')}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const at = await read($, now)
    const full = (await read($, belly)) ?? { percent: 0, tokens: 0, window: 0, ate: 0, fedAt: at, burpAt: null, known: false, compactAt: null, fill: 0 }
    const limits = await read($, pantry)
    const activity = await read($, doing)
    const dieting = (await read($, armed)).length
    const plate = await read($, serving)
    const { monster, color } = await read($, look)
    const power = await read($, level)
    const helpers = scene.minions
    const hits = await read($, combo)
    const eaten = await read($, xp)
    const rank = levelOf(eaten)
    const isLoud = await read($, sound)
    const asked = await read($, waiting)
    const kept = cold(scene) ? scene.cache : null
    // Waiting on the person outranks everything: that is what needs them now.
    // About to burst outranks super mode: that line is the /compact warning.
    // What it said back to a pet or a hello shows for a moment, over its mood; hatching, it cracks.
    const { eye, say } =
      asked !== null
        ? CALLING
        : ((await read($, chat)) ?? ((await read($, egg)) ? { eye: 'o', say: '*crack* ... *crack*' } : voice(full, at, power, helpers)))
    const chain = onFire(hits)
    const remark = larder(limits)
    const tint = hex(PALETTE[color] ?? 0x3d7bff)
    const pie = await read($, slices)
    // Biggest first; free space is the empty part of the bar, not a legend entry.
    // Categories sharing a color merge (two MCP rows are one "mcp"); the five biggest
    // show, then the reserve.
    const merged = new Map<string, { color: string; short: string; kind: string; tokens: number }>()

    for (const row of pie.filter(one => one.kind !== 'free')) {
      const look = sliceLook(row.name)
      const known = merged.get(look.short)

      merged.set(look.short, { ...look, kind: row.kind, tokens: (known?.tokens ?? 0) + row.tokens })
    }

    const parts = [...merged.values()]
    const legend = [
      ...parts.filter(part => part.kind !== 'buffer').sort((a, b) => b.tokens - a.tokens).slice(0, 5),
      ...parts.filter(part => part.kind === 'buffer'),
    ]
    const entry = (part: (typeof legend)[number]) => `■ ${part.short} ${kilo(part.tokens)}  `
    const dietLine = dieting > 0 ? `eating ~${kilo(plate)} tokens from the context on your next /compact` : ''
    // The readout's height at `columns` wide, line by line, so the sprite takes only
    // what is left and the buttons never fall off the bottom of the pane.
    const lines = (columns: number) => {
      let legendLines = legend.length > 0 ? 1 : 0

      for (let used = 0, i = 0; i < legend.length; i++) {
        const w = entry(legend[i]!).length

        if (used + w > columns && used > 0) {
          legendLines += 1
          used = 0
        }
        used += w
      }

      // What it says can wrap: a gag or a fed-up line runs past a narrow readout.
      return (
        2 +
        Math.ceil(say.length / columns) +
        legendLines +
        limits.length +
        1 +
        (remark === undefined ? 0 : 1) +
        Math.ceil(dietLine.length / columns) +
        2 +
        (e.props.isFocused ? 0 : 1)
      )
    }
    // Stacked, the sprite takes up to 64 columns and the readout stays a 48 column block
    // under it. A pane too short for that (fewer than 10 sprite rows) and wide enough
    // for both puts the sprite beside the readout instead, as tall as it, twice as wide.
    const { bodyColumns, scroll } = e.props
    const wide = Math.max(16, Math.min(64, bodyColumns))
    const beside = Math.min(48, bodyColumns - 1 - 2 * Math.min(scroll.bodyRows, lines(Math.min(48, wide))))
    const isBeside =
      e.surface === 'terminal' && 'Raster' in elements && scroll.bodyRows - lines(Math.min(48, wide)) - 1 < 10 && beside >= 40
    const columns = isBeside ? beside : Math.min(48, wide)
    const readoutLines = lines(columns)
    const width = Math.max(6, Math.min(BAR, columns - 23))
    const grown = Math.round(((eaten - xpFor(rank)) / (xpFor(rank + 1) - xpFor(rank))) * width)
    const row = (name: string, percent: number, tail: string) => {
      const [used, left] = bar(percent, width)

      return (
        <Box>
          <Text dimColor>{name.padEnd(8)}</Text>
          <Text color={barColor(percent)}>{used}</Text>
          <Text dimColor>{left}</Text>
          <Text>
            {` ${Math.round(percent)}%`.padStart(5)} {tail}
          </Text>
        </Box>
      )
    }
    const layers = stack(pie, full.window || 1, width)
    let sprite

    // Raster draws on the terminal only; elsewhere it is an empty fragment.
    if (e.surface === 'terminal' && 'Raster' in elements) {
      const { Raster } = elements

      // After a hot reload the scene starts over: take the level from the banked tokens.
      if (scene.rank === 0) levelUp(scene, rank)
      const rows = isBeside ? Math.min(scroll.bodyRows, readoutLines) : Math.max(6, Math.min(22, scroll.bodyRows - readoutLines - 1))
      const across = isBeside ? Math.min(2 * rows, bodyColumns - 1 - columns) : wide

      canvas = { columns: across, rows }
      if (loop === undefined) {
        settle(scene)
        loop = $.clock.every(1000 / FPS, () => void frame($))
      }
      sprite = <Raster key="sprite" columns={across} rows={rows} cells={encode(paint(scene, across, rows * 2), across, rows, is256)} />
    } else {
      const drawing = ASCII[monster] ?? ASCII.cookie!

      sprite = (
        <Box flexDirection="column">
          {(activity === '' ? drawing.closed : drawing.open).map(line => (
            <Text color={tint}>{line.replaceAll('E', eye)}</Text>
          ))}
        </Box>
      )
    }

    const readout = (
      <Box flexDirection="column" width={columns}>
        <Text color={tint} bold>
          {say}
        </Text>
        <Text dimColor wrap="truncate-end">
          {asked !== null
            ? waitLine(asked)
            : activity !== ''
              ? `> ${activity}${chain}`
              : kept !== null
                ? `cold cache: next prompt re-reads ~${kilo(kept.tokens)} uncached`
                : full.ate > 0
                  ? `last bite +${kilo(full.ate)}, fed ${span(at - full.fedAt)} ago`
                  : `fed ${span(at - full.fedAt)} ago`}
        </Text>
        {pie.length === 0 ? (
          row('belly', full.percent, `${kilo(full.tokens)}/${kilo(full.window)}`)
        ) : (
          <Box>
            <Text dimColor>{'belly'.padEnd(8)}</Text>
            {layers.content.map(part => (
              <Text color={part.color}>{'█'.repeat(part.cells)}</Text>
            ))}
            <Text dimColor>{'░'.repeat(layers.free)}</Text>
            {layers.reserve.map(part => (
              <Text color={part.color}>{'▒'.repeat(part.cells)}</Text>
            ))}
            <Text>
              {` ${Math.round(full.percent)}%`.padStart(5)} {`${kilo(full.tokens)}/${kilo(full.window)}`}
            </Text>
          </Box>
        )}
        {pie.length > 0 && (
          <Box flexWrap="wrap" width={columns}>
            {legend.map(part => (
              <Text>
                <Text color={part.color}>{part.kind === 'buffer' ? '▒' : '■'}</Text>
                <Text dimColor>{entry(part).slice(1)}</Text>
              </Text>
            ))}
          </Box>
        )}
        {limits.map(limit =>
          row(
            limitName(limit.kind),
            limit.percentUsed,
            limit.resetsAt === undefined ? '' : span(Math.max(0, Date.parse(limit.resetsAt) - at)),
          ),
        )}
        {/* Its level and how far to the next, on a thin bar in its own color. */}
        <Box>
          <Text dimColor>{`Lv ${rank}`.padEnd(8)}</Text>
          <Text color={tint}>{'━'.repeat(grown)}</Text>
          <Text dimColor>{'─'.repeat(width - grown)}</Text>
          <Text dimColor>{` ${kilo(xpFor(rank + 1) - eaten)} to Lv ${rank + 1}`}</Text>
        </Box>
        {remark !== undefined && <Text dimColor>{remark}</Text>}
        {dieting > 0 && <Text color="yellow">{dietLine}</Text>}
        {/* Plain buttons show their key: `m: Monster`. The keys work while the pane holds the keyboard. */}
        <Box>
          <Button
            key="monster"
            label="Monster"
            hotkey="m"
            plain
            onPress={() => restyle($, current => ({ ...current, monster: after(NAMES, current.monster) }))}
          />
          <Text>  </Text>
          <Button
            key="color"
            label="Color"
            hotkey="c"
            plain
            onPress={() => restyle($, current => ({ ...current, color: after(COLORS, current.color) }))}
          />
          <Text>  </Text>
          <Button key="pet" label="Pet" hotkey="p" plain onPress={() => stroke($)} />
        </Box>
        {/* Two rows of buttons, each inside 48 columns, so neither wraps. */}
        <Box>
          {/* diet.tsx and sound.tsx answer these presses: onPress cannot call into
              them, as the engine refuses $ passed across an import. */}
          <Button key="diet" label="Diet: free context" hotkey="d" plain onPress={() => undefined} />
          <Text>  </Text>
          <Button key="sound" label={`Sound: ${isLoud ? 'on' : 'off'}`} hotkey="s" plain onPress={() => undefined} />
        </Box>
        {!e.props.isFocused && <Text dimColor>ctrl+x tab or a click gives me the keys</Text>}
      </Box>
    )

    // Side by side, the sprite left of the readout; stacked, both centered in the pane,
    // the readout a block under the sprite.
    return isBeside ? (
      <Box>
        {sprite}
        <Text> </Text>
        {readout}
      </Box>
    ) : (
      <Box flexDirection="column" alignItems="center">
        {sprite}
        {readout}
      </Box>
    )
  })
}
