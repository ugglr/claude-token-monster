import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionMessage, Timer } from 'claude-code'

import type { Belly, Dish, Limit, Look } from '../types'
import { BURP, MINUTE, PALETTE, SAD, STARVING, encode, paint } from './paint'
import type { Scene } from './paint'

const PANE = 'token-monster'
const DIET = 'token-monster-diet'
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
const menu = atom({ plugin: 'token-monster', key: 'menu' } as const, [])
const picked = atom({ plugin: 'token-monster', key: 'picked' } as const, [])

// What the sprite animates from; the atoms above are what the readout draws.
const scene: Scene = {
  tick: 0,
  at: 0,
  belly: null,
  look: { monster: 'cookie', color: 'blue' },
  pantry: [],
  busy: false,
  tools: new Map(),
  minions: 0,
  typedAt: -100,
  errorAt: -100,
  queued: 0,
  motes: [],
}

const kilo = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`
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
const barColor = (percent: number) => (percent >= 75 ? 'red' : percent >= 50 ? 'yellow' : 'green')

// Tamagotchi rules: a full belly beats everything, then hunger, then a burp, then how full it is.
const feeling = ({ percent, fedAt, burpAt }: Belly, at: number) => {
  const idle = at - fedAt

  if (percent >= 90) return { eye: '@', say: 'me gonna burst! /compact' }
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
  if (most >= 90) return 'pantry almost empty! me ration'
  if (most >= 75) return 'pantry getting low...'
  if (most < 25) return 'pantry full. feast time!'
  return undefined
}

const feed = async ($: EngineInterface, context: SessionContextUsage) => {
  const at = await $.clock.now()

  scene.at = await update($, now, () => at)
  scene.belly = await update($, belly, last => {
    // Right after a compaction the window reports no fill: wait for a real one
    // rather than count the whole compacted context as a meal.
    if (context.tokens === undefined) {
      return last === null
        ? { percent: 0, tokens: 0, window: context.window, ate: 0, fedAt: at, burpAt: null, known: false }
        : { ...last, window: context.window, ate: 0, known: false }
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
    }
  })
}

const burp = async ($: EngineInterface, tokensAfter: number | undefined) => {
  const at = await $.clock.now()

  scene.at = await update($, now, () => at)
  scene.belly = await update($, belly, last =>
    last === null
      ? null
      : tokensAfter === undefined
        ? { ...last, ate: 0, known: false, burpAt: at }
        : { ...last, tokens: tokensAfter, percent: Math.round((tokensAfter / last.window) * 100), ate: 0, known: true, burpAt: at },
  )
}

const stock = async ($: EngineInterface, limits: Limit[]) => {
  scene.pantry = await update($, pantry, () => limits)
}

const tick = async ($: EngineInterface) => {
  const at = await $.clock.now()

  scene.at = await update($, now, () => at)
}

const act = async ($: EngineInterface, text: string) => {
  await update($, doing, last => (last === text ? last : text))
}

const restyle = async ($: EngineInterface, change: (current: Look) => Look) => {
  scene.look = await update($, look, change)
  await $.store.set('look', scene.look)
}

// The sprite: painted on every render, then blitted in place by the loop.
let loop: Timer | undefined
let pulse: Timer | undefined
let canvas = { columns: 0, rows: 0 }
let painting = false

const stop = () => {
  loop?.cancel()
  loop = undefined
}

const frame = async ($: EngineInterface) => {
  scene.tick += 1

  const lively = scene.busy || scene.motes.length > 0 || scene.tick - scene.typedAt < 15

  // Idle, a third of the frames is plenty for blinking and breathing.
  if (painting || canvas.columns === 0 || (!lively && scene.tick % 3 !== 0)) return

  painting = true

  try {
    const done = await $.ui.blit({
      requestId: PANE,
      key: 'sprite',
      cells: encode(paint(scene, canvas.columns, canvas.rows * 2), canvas.columns, canvas.rows),
    })

    if (done.deny !== undefined) stop()
  } catch {
    // Nothing to paint on any more; the next render starts the loop again.
    stop()
  } finally {
    painting = false
  }
}

// The diet: tool results replaced by a stub, so every tool call keeps its result
// and the conversation stays valid. Roughly four characters to a token.
const COURSES = 12
const EATEN = '[Token Monster ate this '
const LABELS = ['file_path', 'command', 'url', 'pattern', 'query', 'description', 'prompt']

const estimate = (text: string) => Math.ceil(text.length / 4)
const label = (input: Record<string, unknown>) => String(LABELS.map(name => input[name]).find(value => typeof value === 'string') ?? '')

const stub = (tool: string, text: string) =>
  `${EATEN}${tool} result (~${kilo(estimate(text))} tokens) to free context. Run the tool again if you need it.]`

export const stubbed = (messages: readonly SessionMessage[], ids: ReadonlySet<string>): SessionMessage[] => {
  const tools = new Map(messages.flatMap(message => message.toolUses.map(use => [use.tool_use_id, use.tool])))

  return messages.map(message =>
    message.toolResults?.some(result => ids.has(result.tool_use_id))
      ? {
          role: message.role,
          text: message.text,
          toolUses: message.toolUses,
          toolResults: message.toolResults.map(result =>
            ids.has(result.tool_use_id)
              ? {
                  tool_use_id: result.tool_use_id,
                  isError: result.isError,
                  text: stub(tools.get(result.tool_use_id) ?? 'tool', result.text),
                }
              : result,
          ),
        }
      : message,
  )
}

const fill = async ($: EngineInterface) => {
  const dishes: Dish[] = []

  for (const message of await $.session.messages()) {
    for (const use of message.toolUses) {
      if (use.text === undefined || use.text.startsWith(EATEN)) continue

      dishes.push({ id: use.tool_use_id, tool: use.tool, label: label(use.input), tokens: estimate(use.text) })
    }
  }

  await update($, menu, () => dishes.sort((a, b) => b.tokens - a.tokens).slice(0, COURSES))
  await update($, picked, () => [])
}

const pick = (id: string) => (ids: string[]) => (ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id])

const diet = async ($: EngineInterface) => {
  await fill($)
  await $.ui.open({ id: DIET, title: 'Diet', columns: 48 })
}

let plate = new Set<string>()

const eat = async ($: EngineInterface) => {
  plate = new Set(await read($, picked))

  if (plate.size === 0) return

  try {
    const done = await $.session.compact()
    $.ui.toast(done.skip === undefined ? `Me ate ${plate.size} tool results. *burp*` : `Me could not eat: ${done.skip}`)
  } catch (error) {
    $.ui.toast(`Me could not eat: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    plate = new Set()
  }

  await fill($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('look')) as Partial<Look> | undefined

    if (saved?.monster && NAMES.includes(saved.monster) && saved.color && COLORS.includes(saved.color)) {
      await update($, look, () => ({ monster: saved.monster as string, color: saved.color as string }))
    }

    scene.look = await read($, look)
    scene.belly = await read($, belly)

    const usage = await $.session.usage()

    await feed($, usage.context)
    await stock($, usage.rateLimits)
    pulse?.cancel()
    pulse = $.clock.every(MINUTE, () => void tick($))
    await $.command.register({
      name: 'token-monster',
      description: 'Open the Token Monster pane, swap its monster and color, or put it on a diet',
      argumentHint: `[${NAMES.join('|')}] [color] | diet`,
    })
    void $.ui.open({ id: PANE, title: 'Token Monster', columns: 46 })

    return next(e)
  })

  on('command.run', { command: 'token-monster' }, async ($, e) => {
    const words = e.args.toLowerCase().split(/\s+/).filter(Boolean)

    if (words[0] === 'diet') {
      await diet($)

      return { text: 'Pick what Token Monster eats.' }
    }

    const unknown = words.filter(word => !NAMES.includes(word) && !COLORS.includes(word))

    if (unknown.length > 0) {
      return {
        text: `Me not know ${unknown.join(', ')}. Monsters: ${NAMES.join(', ')}. Colors: ${COLORS.join(', ')}. Or: diet.`,
      }
    }

    await restyle($, current => ({
      monster: words.find(word => NAMES.includes(word)) ?? current.monster,
      color: words.find(word => COLORS.includes(word)) ?? current.color,
    }))
    await $.ui.open({ id: PANE, title: 'Token Monster', columns: 46 })

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

    if (done.skip === undefined && e.agentId === undefined && e.trigger !== 'precompute') await burp($, done.tokensAfter)

    return done
  })

  // Answers only the compaction eat() started; /compact and every other one pass through.
  on('session.compact', { trigger: 'plugin' }, ($, e, next) =>
    plate.size === 0 || e.agentId !== undefined ? next(e) : { messages: stubbed(e.messages, plate) },
  )

  on('prompt.edit', ($, e, next) => {
    scene.typedAt = scene.tick
    scene.queued = Math.min(scene.queued + 1, 30)

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    scene.queued += 24

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    scene.busy = true
    await act($, 'thinking...')

    return next(e)
  })

  // Subagents' turns complete too, carrying their agentId: only the main turn ends the meal.
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      scene.busy = false
      scene.tools.clear()
      await act($, '')
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const isMain = e.agentId === undefined
    const isAgent = e.tool === 'Agent'

    if (isMain) {
      scene.tools.set(e.tool_use_id, e.tool)
      await act($, `${e.tool} ${label(e as unknown as Record<string, unknown>)}`.trim())
    }
    if (isAgent) scene.minions += 1

    try {
      const ran = await next(e)

      if (ran.isError === true) scene.errorAt = scene.tick

      return ran
    } finally {
      if (isAgent) scene.minions -= 1
      if (isMain) {
        scene.tools.delete(e.tool_use_id)
        await act($, [...scene.tools.values()].at(-1) ?? (scene.busy ? 'thinking...' : ''))
      }
    }
  })

  on('ui.close', ($, e, next) => {
    if (e.id === PANE) stop()

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Button, Text } = elements
    const at = await read($, now)
    const full = (await read($, belly)) ?? { percent: 0, tokens: 0, window: 0, ate: 0, fedAt: at, burpAt: null, known: false }
    const limits = await read($, pantry)
    const activity = await read($, doing)
    const { monster, color } = await read($, look)
    const { eye, say } = feeling(full, at)
    const columns = Math.max(16, Math.min(48, e.props.bodyColumns))
    const width = Math.max(6, Math.min(BAR, columns - 23))
    const remark = larder(limits)
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
    let sprite

    // Raster draws on the terminal only; elsewhere it is an empty fragment.
    if (e.surface === 'terminal' && 'Raster' in elements) {
      const { Raster } = elements
      const rows = Math.max(6, Math.min(16, e.props.scroll.bodyRows - 9))

      canvas = { columns, rows }
      loop ??= $.clock.every(1000 / FPS, () => void frame($))
      sprite = <Raster key="sprite" columns={columns} rows={rows} cells={encode(paint(scene, columns, rows * 2), columns, rows)} />
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

    return (
      <Box flexDirection="column">
        {sprite}
        <Text color={tint} bold>
          {say}
        </Text>
        <Text dimColor>
          {activity !== ''
            ? `> ${activity}`
            : full.ate > 0
              ? `last bite +${kilo(full.ate)}, fed ${span(at - full.fedAt)} ago`
              : `fed ${span(at - full.fedAt)} ago`}
        </Text>
        {row('belly', full.percent, `${kilo(full.tokens)}/${kilo(full.window)}`)}
        {limits.map(limit =>
          row(
            WINDOWS[limit.kind] ?? limit.kind.slice(0, 7),
            limit.percentUsed,
            limit.resetsAt === undefined ? '' : span(Math.max(0, Date.parse(limit.resetsAt) - at)),
          ),
        )}
        {remark !== undefined && <Text dimColor>{remark}</Text>}
        <Box>
          <Button
            key="monster"
            label="Monster"
            hotkey="m"
            onPress={() => restyle($, current => ({ ...current, monster: after(NAMES, current.monster) }))}
          />
          <Text> </Text>
          <Button
            key="color"
            label="Color"
            hotkey="c"
            onPress={() => restyle($, current => ({ ...current, color: after(COLORS, current.color) }))}
          />
          <Text> </Text>
          <Button key="diet" label="Diet" hotkey="d" onPress={() => diet($)} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: DIET }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const dishes = await read($, menu)
    const ids = await read($, picked)
    const room = Math.max(12, e.props.bodyColumns - 2)
    const chosen = dishes.filter(dish => ids.includes(dish.id))
    const saving = chosen.reduce((sum, dish) => sum + dish.tokens, 0)

    return (
      <Box flexDirection="column">
        <Text bold>Pick what me eat, biggest first</Text>
        {dishes.length === 0 && <Text dimColor>No tool results to eat yet.</Text>}
        {dishes.map((dish, index) => {
          const size = ` ~${kilo(dish.tokens)}`
          const name = `${ids.includes(dish.id) ? '[x]' : '[ ]'} ${dish.tool} ${dish.label}`

          return (
            <Button
              key={`dish-${index}`}
              label={`${name.slice(0, room - size.length).padEnd(room - size.length)}${size}`}
              onPress={() => update($, picked, pick(dish.id))}
            />
          )
        })}
        <Text> </Text>
        <Box>
          <Button
            key="eat"
            label={chosen.length === 0 ? 'Eat' : `Eat ${chosen.length} (~${kilo(saving)})`}
            hotkey="e"
            onPress={() => eat($)}
          />
          <Text> </Text>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={() => fill($)} />
        </Box>
        <Text dimColor>Eaten results become a short note. The next turn re-reads the context uncached.</Text>
      </Box>
    )
  })
}
