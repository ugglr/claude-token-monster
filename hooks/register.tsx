import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, Timer } from 'claude-code'

import type { Belly, Limit, Look, Slice } from '../types'
import { OLD_DIET, label, registerDiet } from './diet'
import { PANE, PANE_OPEN, isDietWord, kilo, tokens } from './format'
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
  createScene,
  encode,
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
} from './paint'
import type { Fuss, Scene } from './paint'
import { isSoundWord, registerSound } from './sound'

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

// Tamagotchi rules: a full belly beats everything, then hunger, then a burp, then how full it is.
// Moods go by `fill`, the share of the auto-compact point: that is when the context
// actually gets summarized, usually well before the window is full.
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
          'SUPER MODE 3!!! power level over 9000',
        ][power]!,
      }

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
  const parts = rows.filter(row => row.kind !== 'free').map(row => ({ row, exact: (row.tokens / window) * width }))
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

// The scene's tokens already in the store, and when the store was last written: at
// most every BANK_MS, and at a turn's end once that much time has passed.
const BANK_MS = 30_000
let banked = 0
let bankedAt = -Infinity

const bank = async ($: EngineInterface, isDue = true) => {
  const fresh = scene.eaten - banked
  const at = await $.clock.now()

  if (fresh <= 0 || (!isDue && at - bankedAt < BANK_MS)) return

  banked = scene.eaten
  bankedAt = at

  try {
    // Read back first: another session may have banked its own meals meanwhile.
    const total = (Number(await $.store.get('xp')) || 0) + fresh
    const was = scene.rank

    await $.store.set('xp', total)
    await update($, xp, () => total)
    levelUp(scene, levelOf(total))

    if (was > 0 && scene.rank > was) {
      const gift = WARDROBE.find(one => one.level === scene.rank)

      $.ui.toast(`Token Monster grew to Lv ${scene.rank}${gift === undefined ? '!' : ` and got ${gift.part}!`}`)
    }
  } catch {
    // Not banked; the next try takes these tokens too.
    banked -= fresh
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

    // 24-bit color announces itself in COLORTERM; Apple Terminal, for one, does not have it.
    const depth = (await $.env.get('COLORTERM')) ?? ''

    is256 = !['truecolor', '24bit'].includes(depth.toLowerCase())

    const usage = await $.session.usage()

    await feed($, usage.context)
    await stock($, usage.rateLimits)
    pulse?.cancel()
    pulse = $.clock.every(MINUTE, () => void tick($))
    await wake($)
    saver?.cancel()
    saver = $.clock.every(BANK_MS, () => void bank($))
    await $.command.register({
      name: 'token-monster',
      description: 'Open the Token Monster pane, swap its monster and color, or put it on a diet',
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
        text: `Me not know ${unknown.join(', ')}. Monsters: ${NAMES.join(', ')}. Colors: ${COLORS.join(', ')}. Or: diet (or eat).`,
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
      if (done.skip === undefined && e.agentId === undefined && e.trigger !== 'precompute') await burp($, done.tokensAfter)
    } catch {}

    return done
  })

  registerDiet(on)
  registerSound(on)

  on('prompt.edit', async ($, e, next) => {
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

    for await (const chunk of stream) {
      if (chunk.kind === 'text') serve(scene, tokens(chunk.text), TEXT)
      if (chunk.kind === 'thinking') serve(scene, tokens(chunk.text), THINKING)
      if (chunk.kind === 'tool') names.set(chunk.index, chunk.name)
      if (chunk.kind === 'input') serve(scene, tokens(chunk.json), toolColor(names.get(chunk.index)))

      yield chunk
    }
  })

  on('turn.start', async ($, e, next) => {
    startTurn(scene)
    await update($, combo, () => 0)
    await act($, 'thinking...')
    await rally($, true)

    return next(e)
  })

  // Subagents' turns complete too, carrying their agentId: only the main turn ends the meal.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      finishTurn(scene, e.isAborted)
      await update($, combo, () => 0)
      await act($, '')
      await bank($, false)
    }

    await rally($, true)

    return next(e)
  })

  // Every tool result is a meal; the main loop's calls chain into combos and power up.
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const ran = await next(e)

      serve(scene, tokens(ran.text), toolColor(e.tool))

      return ran
    }

    const isAgent = e.tool === 'Agent'

    // Everything counted up is inside the try, so the finally always counts it down.
    try {
      scene.tools.set(e.tool_use_id, e.tool)
      if (isAgent) inflight += 1
      await rally($)
      await act($, `${e.tool} ${label(e as unknown as Record<string, unknown>)}`.trim())

      const ran = await next(e)

      hit(scene, ran.isError === true, await $.clock.now())
      serve(scene, tokens(ran.text), toolColor(e.tool))
      await update($, combo, () => scene.combo)
      lapse?.cancel()
      lapse = $.clock.after(COMBO_MS, () => void update($, combo, () => 0))

      return ran
    } finally {
      scene.tools.delete(e.tool_use_id)
      if (isAgent) inflight -= 1
      await rally($, isAgent)
      await act($, [...scene.tools.values()].at(-1) ?? (scene.busy ? 'thinking...' : ''))
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
    const tint = hex(PALETTE[(await read($, look)).color] ?? 0x3d7bff)
    const { eye, say } = voice(full, at, power, scene.minions)
    const [used, left] = bar(full.percent, 8)
    const pieces = [
      ...limits.map(limit => `  ${limitName(limit.kind)} ${Math.round(limit.percentUsed)}%`),
      '  /token-monster',
    ]
    const head = `(${eye})(${eye}) ${activity !== '' ? `> ${activity}${onFire(hits)}` : say}`
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
    // About to burst outranks super mode: that line is the /compact warning.
    // What it said back to a pet or a hello shows for a moment, over its mood; hatching, it cracks.
    const { eye, say } =
      (await read($, chat)) ?? ((await read($, egg)) ? { eye: 'o', say: '*crack* ... *crack*' } : voice(full, at, power, helpers))
    const chain = onFire(hits)
    // The sprite takes up to 64 columns; the readout stays a 48 column block under it.
    const wide = Math.max(16, Math.min(64, e.props.bodyColumns))
    const columns = Math.min(48, wide)
    const width = Math.max(6, Math.min(BAR, columns - 23))
    const remark = larder(limits)
    const grown = Math.round(((eaten - xpFor(rank)) / (xpFor(rank + 1) - xpFor(rank))) * width)
    const tint = hex(PALETTE[color] ?? 0x3d7bff)
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
    const pie = await read($, slices)
    const layers = stack(pie, full.window || 1, width)
    // Biggest first; free space is the empty part of the bar, not a legend entry.
    const legend = pie
      .filter(row => row.kind !== 'free')
      .map(row => ({ ...sliceLook(row.name), kind: row.kind, tokens: row.tokens }))
      .sort((a, b) => (a.kind === 'buffer' ? 1 : b.kind === 'buffer' ? -1 : b.tokens - a.tokens))
    let sprite

    // Raster draws on the terminal only; elsewhere it is an empty fragment.
    if (e.surface === 'terminal' && 'Raster' in elements) {
      const { Raster } = elements

      // After a hot reload the scene starts over: take the level from the banked tokens.
      if (scene.rank === 0) levelUp(scene, rank)
      const rows = Math.max(6, Math.min(22, e.props.scroll.bodyRows - 9))

      canvas = { columns: wide, rows }
      if (loop === undefined) {
        settle(scene)
        loop = $.clock.every(1000 / FPS, () => void frame($))
      }
      sprite = <Raster key="sprite" columns={wide} rows={rows} cells={encode(paint(scene, wide, rows * 2), wide, rows, is256)} />
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

    // Centered in the pane: the sprite, then the readout as a block as wide as the sprite.
    return (
      <Box flexDirection="column" alignItems="center">
        {sprite}
        <Box flexDirection="column" width={columns}>
          <Text color={tint} bold>
            {say}
          </Text>
          <Text dimColor>
            {activity !== ''
              ? `> ${activity}${chain}`
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
                  <Text dimColor>{` ${part.short} ${kilo(part.tokens)}  `}</Text>
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
          {dieting > 0 && <Text color="yellow">eating ~{kilo(plate)} tokens from the context on your next /compact</Text>}
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
            {/* diet.tsx answers this press: onPress cannot call into it, as the engine
                refuses $ passed across an import. */}
            <Button key="diet" label="Diet: free context" hotkey="d" plain onPress={() => undefined} />
            <Text>  </Text>
            <Button key="pet" label="Pet" hotkey="p" plain onPress={() => stroke($)} />
          </Box>
          {/* sound.tsx answers this press, as the diet's does. */}
          <Box>
            <Button key="sound" label={`Sound: ${isLoud ? 'on' : 'off'}`} hotkey="s" plain onPress={() => undefined} />
          </Box>
          {!e.props.isFocused && <Text dimColor>ctrl+x tab or a click gives me the keys</Text>}
        </Box>
      </Box>
    )
  })
}
