import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, Timer } from 'claude-code'

import type { Belly, Limit, Look } from '../types'
import { OLD_DIET, label, registerDiet } from './diet'
import { kilo } from './format'
import {
  AMBER,
  BURP,
  COMBO_GAP,
  MINUTE,
  PALETTE,
  PROMPT,
  RED,
  SAD,
  STARVING,
  TEXT,
  THINKING,
  encode,
  feed as serve,
  finishTurn,
  hit,
  paint,
  scene as newScene,
  step,
  toolColor,
} from './paint'
import type { Scene } from './paint'

const PANE = 'token-monster'
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
const power = atom({ plugin: 'token-monster', key: 'power' } as const, 0)
// Which view the pane shows; the diet module draws 'diet' (see hooks/diet.tsx).
const view = atom({ plugin: 'token-monster', key: 'view' } as const, 'monster')

// What the sprite animates from; the atoms above are what the readout draws.
const scene: Scene = newScene({ monster: 'cookie', color: 'blue' })

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
  if (most >= RED) return 'pantry almost empty! me ration'
  if (most >= AMBER) return 'pantry getting low...'
  return 'pantry full. feast time!'
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
  await update($, doing, () => text)
}

// Agent tool calls in flight: a foreground subagent runs inside its call.
let inflight = 0

// Background agents outlive their tool call, so minions come from the agent list too.
const rally = async ($: EngineInterface, isListed = false) => {
  if (isListed) {
    try {
      const running = (await $.agent.list()).filter(agent => agent.status === 'running').length

      scene.minions = Math.max(inflight, running)
    } catch {
      // Unknown this time; the next poll tries again.
    }
  } else {
    scene.minions = Math.max(inflight, scene.minions)
  }

  scene.level = Math.min(3, scene.minions + (scene.tools.size >= 3 ? 1 : 0))
  await update($, power, last => (last === scene.level ? last : scene.level))
}

// Rough tokens in a piece of text, about four characters each.
const tokens = (text: string | undefined) => Math.ceil((text?.length ?? 0) / 4)

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
  if (canvas.columns === 0) return

  step(scene, canvas.columns, canvas.rows * 2)

  if (scene.tick % 20 === 0) void rally($, true)

  const lively =
    scene.busy ||
    scene.heat > 0.02 ||
    scene.power > 0.02 ||
    scene.motes.length > 0 ||
    scene.servings.length > 0 ||
    scene.tick - scene.typedAt < 15 ||
    scene.tick - scene.comboAt <= COMBO_GAP ||
    (scene.finish !== null && scene.tick - scene.finish.at < 18)

  // Idle, a third of the frames is plenty for blinking and breathing.
  if (painting || (!lively && scene.tick % 3 !== 0)) return

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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('look')) as Partial<Look> | undefined

    if (saved?.monster && NAMES.includes(saved.monster) && saved.color && COLORS.includes(saved.color)) {
      await update($, look, () => ({ monster: saved.monster as string, color: saved.color as string }))
    }

    scene.look = await read($, look)

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
    await update($, view, () => 'monster')
    await $.ui.close({ id: OLD_DIET })
    void $.ui.open({ id: PANE, title: 'Token Monster', columns: 46 })

    return next(e)
  })

  on('command.run', { command: 'token-monster' }, async ($, e, next) => {
    const words = e.args.toLowerCase().split(/\s+/).filter(Boolean)

    if (words[0] === 'diet') return next(e)

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
    await update($, view, () => 'monster')
    await $.ui.open({ id: PANE, title: 'Token Monster', columns: 46, focus: true })

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

  on('prompt.edit', ($, e, next) => {
    scene.typedAt = scene.tick
    serve(scene, 2, PROMPT, true, false)

    return next(e)
  })

  on('prompt.submit', ($, e, next) => {
    serve(scene, tokens(e.text), PROMPT, true)

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

    return await stream.result
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
      finishTurn(scene)
      await act($, '')
    }

    await rally($, e.agentId !== undefined)

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

    scene.tools.set(e.tool_use_id, e.tool)
    if (isAgent) inflight += 1
    await rally($)
    await act($, `${e.tool} ${label(e as unknown as Record<string, unknown>)}`.trim())

    try {
      const ran = await next(e)

      if (ran.isError === true) scene.errorAt = scene.tick

      hit(scene, ran.isError === true)
      serve(scene, tokens(ran.text), toolColor(e.tool))

      return ran
    } finally {
      scene.tools.delete(e.tool_use_id)
      if (isAgent) inflight -= 1
      await rally($, isAgent)
      await act($, [...scene.tools.values()].at(-1) ?? (scene.busy ? 'thinking...' : ''))
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
    const dieting = (await read($, armed)).length
    const plate = await read($, serving)
    const { monster, color } = await read($, look)
    const level = await read($, power)
    const helpers = Math.max(1, scene.minions)
    const { eye, say } =
      level === 0
        ? feeling(full, at)
        : {
            eye: 'O',
            say: [
              '',
              `SUPER MODE! me and ${helpers} helper${helpers === 1 ? '' : 's'}`,
              'SUPER MODE 2!! power rising',
              'SUPER MODE 3!!! power level over 9000',
            ][level]!,
          }
    const combo = scene.combo >= 2 && scene.tick - scene.comboAt <= COMBO_GAP ? `  ${scene.combo} HIT COMBO` : ''
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
            ? `> ${activity}${combo}`
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
        {dieting > 0 && <Text color="yellow">eating ~{kilo(plate)} tokens from the context on your next /compact</Text>}
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
          <Button key="diet" label="Diet: free context" hotkey="d" onPress={() => update($, view, () => 'diet')} />
        </Box>
      </Box>
    )
  })
}
