import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionMessage, Timer } from 'claude-code'

import type { Belly, Dish, Limit, Look } from '../types'

const PANE = 'token-monster'
const DIET = 'token-monster-diet'
const BAR = 20

const art = (s: string) => s.split('\n').slice(1, -1)

// E marks an eye; the open mouth is one frame of the chew, the closed one the other.
const MONSTERS: Record<string, { open: string[]; closed: string[] }> = {
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
  chomper: {
    open: art(String.raw`
   .---.
  /  E  \
 |    _.-'
 |   <
 |    '-._
  \     /
   '---'
`),
    closed: art(String.raw`
   .---.
  /  E  \
 |       |
 |   ----|
 |       |
  \     /
   '---'
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
}
const NAMES = Object.keys(MONSTERS)
const COLORS = ['blue', 'cyan', 'green', 'yellow', 'magenta', 'red', 'white']

const belly = atom({ plugin: 'token-monster', key: 'belly' } as const, null)
const look = atom({ plugin: 'token-monster', key: 'look' } as const, { monster: 'cookie', color: 'blue' })
const frame = atom({ plugin: 'token-monster', key: 'frame' } as const, 0)
const now = atom({ plugin: 'token-monster', key: 'now' } as const, 0)
const pantry = atom({ plugin: 'token-monster', key: 'pantry' } as const, [])

const menu = atom({ plugin: 'token-monster', key: 'menu' } as const, [])
const picked = atom({ plugin: 'token-monster', key: 'picked' } as const, [])

const MINUTE = 60_000
const SAD = 15 * MINUTE
const STARVING = 60 * MINUTE
const WINDOWS: Record<string, string> = { five_hour: 'session', seven_day: 'weekly' }

const kilo = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`)
const after = (list: string[], at: string) => list[(list.indexOf(at) + 1) % list.length] ?? at

// Tamagotchi rules: a burp and a full belly beat everything, then hunger, then how full it is.
const feeling = ({ percent, ate, fedAt }: Belly, at: number) => {
  const idle = at - fedAt

  if (ate < 0) return { eye: '^', say: '*burp* me feel lighter' }
  if (percent >= 90) return { eye: '@', say: 'me gonna burst! /compact' }
  if (idle >= STARVING) return { eye: '-', say: 'me starving... feed me tokens' }
  if (idle >= SAD) return { eye: 'T', say: 'me sad. no tokens :(' }
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

const bar = (percent: number, width: number) => {
  const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))

  return ['█'.repeat(filled), '░'.repeat(width - filled)] as const
}

const barColor = (percent: number) => (percent >= 75 ? 'red' : percent >= 50 ? 'yellow' : 'green')

const feed = async ($: EngineInterface, context: SessionContextUsage) => {
  const at = await $.clock.now()

  await update($, now, () => at)
  await update($, belly, last => {
    const tokens = context.tokens ?? 0
    const ate = last === null ? 0 : tokens - last.tokens

    return {
      percent: context.percent ?? 0,
      tokens,
      window: context.window,
      ate,
      fedAt: last === null || ate > 0 ? at : last.fedAt,
    }
  })
}

const tick = async ($: EngineInterface) => {
  const at = await $.clock.now()

  await update($, now, () => at)
}

const restyle = async ($: EngineInterface, change: (current: Look) => Look) =>
  $.store.set('look', await update($, look, change))

// The diet: tool results replaced by a stub, so every tool call keeps its result
// and the conversation stays valid. Roughly four characters to a token.
const COURSES = 12
const EATEN = '[Token Monster ate this '
const LABELS = ['file_path', 'command', 'url', 'pattern', 'query', 'description', 'prompt']

const estimate = (text: string) => Math.ceil(text.length / 4)

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

      const field = LABELS.map(name => use.input[name]).find(value => typeof value === 'string')
      dishes.push({ id: use.tool_use_id, tool: use.tool, label: String(field ?? ''), tokens: estimate(use.text) })
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

let chew: Timer | undefined
let pulse: Timer | undefined

const swallow = async ($: EngineInterface) => {
  chew?.cancel()
  chew = undefined
  await update($, frame, () => 0)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('look')) as Partial<Look> | undefined

    if (saved?.monster && NAMES.includes(saved.monster) && saved.color && COLORS.includes(saved.color)) {
      await update($, look, () => ({ monster: saved.monster as string, color: saved.color as string }))
    }

    const usage = await $.session.usage()

    await feed($, usage.context)
    await update($, pantry, () => usage.rateLimits)
    pulse?.cancel()
    pulse = $.clock.every(MINUTE, () => void tick($))
    await $.command.register({
      name: 'token-monster',
      description: 'Open the Token Monster pane, or swap its monster and color',
      argumentHint: `[${NAMES.join('|')}] [color] | diet`,
    })
    void $.ui.open({ id: PANE, title: 'Token Monster', columns: 24 })

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
    await $.ui.open({ id: PANE, title: 'Token Monster', columns: 24 })

    return { text: 'Token Monster is hungry.' }
  })

  // Answers only the compaction eat() started; /compact and every other one pass through.
  on('session.compact', { trigger: 'plugin' }, ($, e, next) =>
    plate.size === 0 || e.agentId !== undefined ? next(e) : { messages: stubbed(e.messages, plate) },
  )

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

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await feed($, e.context)
    }

    if (e.changed.includes('rateLimits')) {
      await update($, pantry, () => e.rateLimits)
    }

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    chew ??= $.clock.every(350, () => void update($, frame, n => n + 1))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await swallow($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const at = await read($, now)
    const full = (await read($, belly)) ?? { percent: 0, tokens: 0, window: 0, ate: 0, fedAt: at }
    const limits = await read($, pantry)
    const { monster, color } = await read($, look)
    const { eye, say } = feeling(full, at)
    const body = MONSTERS[monster] ?? MONSTERS.cookie!
    const lines = (await read($, frame)) % 2 === 1 ? body.open : body.closed
    const width = Math.max(4, Math.min(BAR, e.props.bodyColumns - 2))
    const [filled, empty] = bar(full.percent, width)
    const remark = larder(limits)

    return (
      <Box flexDirection="column">
        {lines.map(line => (
          <Text color={color}>{line.replaceAll('E', eye)}</Text>
        ))}
        <Text> </Text>
        <Text color={color} bold>
          {say}
        </Text>
        <Box>
          <Text color={barColor(full.percent)}>{filled}</Text>
          <Text dimColor>{empty}</Text>
        </Box>
        <Text>
          {full.percent}% {kilo(full.tokens)}/{kilo(full.window)}
        </Text>
        {full.ate > 0 && <Text dimColor>ate {kilo(full.ate)}</Text>}
        {limits.length > 0 && <Text> </Text>}
        {limits.map(limit => {
          const [used, left] = bar(limit.percentUsed, Math.max(4, width - 12))

          return (
            <Box>
              <Text dimColor>{(WINDOWS[limit.kind] ?? limit.kind).padEnd(8)}</Text>
              <Text color={barColor(limit.percentUsed)}>{used}</Text>
              <Text dimColor>{left}</Text>
              <Text> {Math.round(limit.percentUsed)}%</Text>
            </Box>
          )
        })}
        {remark !== undefined && <Text dimColor>{remark}</Text>}
        <Text> </Text>
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
}
