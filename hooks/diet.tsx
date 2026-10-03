import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, SessionMessage } from 'claude-code'

import type { Dish } from '../types'
import { PANE, PANE_OPEN, isDietWord, kilo, tokens } from './format'

// The diet: picked tool results replaced by a stub, so every tool call keeps its
// result and the conversation stays valid. Roughly four characters to a token.
//
// Eat only arms it. A plugin's own $.session.compact() skips that plugin's hooks,
// so the diet could not answer it and core would summarize everything instead.
// The person's next /compact is answered here, with the armed results eaten.
// The diet is a view inside the monster's pane, never a pane of its own: a mod
// cannot switch the person back to another tab, so a second pane traps them.
// Its hooks sit outside the monster's on the same pane and pass when `view` is
// not 'diet'. Earlier versions opened a pane under this id; session.start closes it.
export const OLD_DIET = 'token-monster-diet'

// Nine, so each has a digit to press.
const COURSES = 9
const EATEN = '[Token Monster ate this '
// What a row says about the call: a Bash description reads better than its command.
const LABELS = ['file_path', 'description', 'url', 'pattern', 'query', 'command', 'prompt']

const menu = atom({ plugin: 'token-monster', key: 'menu' } as const, [])
const picked = atom({ plugin: 'token-monster', key: 'picked' } as const, [])
const armed = atom({ plugin: 'token-monster', key: 'armed' } as const, [])
// The armed results' tokens, roughly: what the next /compact takes out of the context.
const serving = atom({ plugin: 'token-monster', key: 'serving' } as const, 0)
const view = atom({ plugin: 'token-monster', key: 'view' } as const, 'monster')
// The monster's own reading of the context, for the before and after.
const belly = atom({ plugin: 'token-monster', key: 'belly' } as const, null)

type Block = { type: string; [field: string]: unknown }

export const label = (input: Record<string, unknown>) =>
  String(LABELS.map(name => input[name]).find(value => typeof value === 'string') ?? '')

// mcp__claude_ai_brainlink__get_started reads as brainlink.get_started.
const short = (tool: string) =>
  tool.startsWith('mcp__') ? tool.split('__').slice(1).join('.').replace(/^claude_ai_/, '') : tool

const stub = (tool: string, text: string) =>
  `${EATEN}${tool} result (~${kilo(tokens(text))} tokens) to free context. Run the tool again if you need it.]`

// A message holding an eaten result is rebuilt from its text, which would drop an
// image or a document beside it: the results of such a message are never offered.
export const withMedia = (messages: readonly { content: readonly Block[] }[]) => {
  const ids = new Set<string>()

  for (const { content } of messages) {
    const results = content.filter(block => block.type === 'tool_result')
    const hasMedia =
      content.some(block => block.type !== 'text' && block.type !== 'tool_result') ||
      results.some(block => Array.isArray(block.content) && block.content.some((inner: Block) => inner.type !== 'text'))

    if (hasMedia) for (const block of results) ids.add(String(block.tool_use_id))
  }

  return ids
}

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
  const unsafe = withMedia(await $.session.messages({ as: 'api' }))
  const dishes: Dish[] = []

  for (const message of await $.session.messages()) {
    for (const use of message.toolUses) {
      if (use.text === undefined || use.text.startsWith(EATEN) || unsafe.has(use.tool_use_id)) continue

      dishes.push({ id: use.tool_use_id, tool: short(use.tool), label: label(use.input), tokens: tokens(use.text) })
    }
  }

  await update($, menu, () => dishes.sort((a, b) => b.tokens - a.tokens).slice(0, COURSES))
  await update($, picked, () => [])
}

const showDiet = async ($: EngineInterface) => {
  await fill($)
  await update($, view, () => 'diet')
}

const hideDiet = async ($: EngineInterface) => {
  await update($, view, () => 'monster')
}

const pick = (id: string) => (ids: string[]) => (ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id])

const arm = async ($: EngineInterface) => {
  const chosen = await read($, picked)

  if (chosen.length === 0) return

  const tokens = (await read($, menu)).filter(dish => chosen.includes(dish.id)).reduce((sum, dish) => sum + dish.tokens, 0)

  await update($, armed, () => chosen)
  await update($, serving, () => tokens)

  const { isFilled } = await $.prompt.fill({ text: '/compact' })

  // The next step is the prompt, and the monster's readout says it is armed.
  await hideDiet($)

  $.ui.toast(`${isFilled ? 'Press Enter on /compact' : 'Run /compact'} and me eat ~${kilo(tokens)} tokens from the context.`)
}

const disarm = async ($: EngineInterface) => {
  await update($, armed, () => [])
  await update($, serving, () => 0)
}

export const registerDiet = (on: On) => {
  // Only the person's /compact eats: an automatic one needs the room a summary makes.
  on('session.compact', { trigger: 'manual' }, async ($, e, next) => {
    // Whatever the /compact does, the pane goes back to the monster to watch it.
    if (e.agentId === undefined) await hideDiet($)

    const ids = await read($, armed)

    if (ids.length === 0 || e.agentId !== undefined) return next(e)

    await disarm($)
    await update($, picked, () => [])

    if (!Array.isArray(e.messages) || e.messages.length === 0) return { skip: 'me could not see the conversation' }

    // Results an earlier compaction or /clear already took are gone: with none of the
    // armed ones left, this is an ordinary /compact.
    const present = new Set(e.messages.flatMap(message => message.toolResults ?? []).map(result => result.tool_use_id))
    const meal = new Set(ids.filter(id => present.has(id)))

    if (meal.size === 0) return next(e)

    await update($, menu, dishes => dishes.filter(dish => !meal.has(dish.id)))

    const eaten = e.messages
      .flatMap(message => message.toolResults ?? [])
      .filter(result => meal.has(result.tool_use_id))
      .reduce((sum, result) => sum + tokens(result.text), 0)

    $.ui.toast(`Me eating ~${kilo(eaten)} tokens from the context. *burp*`)

    return { messages: stubbed(e.messages, meal) }
  })

  // `diet` is this module's word; the monster's command passes it down here.
  on('command.run', { command: 'token-monster' }, async ($, e, next) => {
    if (!isDietWord(e.args)) return next(e)

    await showDiet($)
    await $.ui.open({ ...PANE_OPEN, focus: true })

    return { text: 'Pick what Token Monster eats.' }
  })

  // The monster's Diet button: this module alone switches the view to the diet.
  on('ui.press', { plugin: 'token-monster', element: 'diet' }, async ($, e) => {
    await showDiet($)

    return { element: e.element }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if ((await read($, view)) !== 'diet') return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const { bodyColumns, isFocused } = e.props
    const dishes = await read($, menu)
    const ids = await read($, picked)
    const ready = await read($, armed)
    const plate = await read($, serving)
    const room = Math.max(12, bodyColumns - 2)
    const chosen = dishes.filter(dish => ids.includes(dish.id))
    const saving = chosen.reduce((sum, dish) => sum + dish.tokens, 0)
    const full = await read($, belly)
    const now =
      full === null || !full.known ? 'your context' : `${full.percent}% ${kilo(full.tokens)}/${kilo(full.window)}`
    const after =
      full === null || !full.known || saving === 0
        ? ''
        : ` -> ~${Math.round((Math.max(0, full.tokens - saving) / full.window) * 100)}% after`

    return (
      <Box flexDirection="column">
        <Text bold>Free up this conversation's context</Text>
        <Text dimColor>These tool results sit in the context right now. Pick what me eat, biggest first.</Text>
        <Text>
          context {now}
          {after}
        </Text>
        {!isFocused && <Text dimColor>ctrl+x tab or a click gives me the keys</Text>}
        {ready.length > 0 && (
          <Box>
            <Text color="yellow">Armed: eating ~{kilo(plate)} tokens from the context on your next /compact </Text>
            <Button key="cancel" label="Cancel" hotkey="x" plain onPress={() => disarm($)} />
          </Box>
        )}
        {dishes.length === 0 && <Text dimColor>No tool results to eat yet.</Text>}
        {dishes.map((dish, index) => {
          const size = ` ~${kilo(dish.tokens)}`
          const name = `${ids.includes(dish.id) ? '[x]' : '[ ]'} ${dish.tool} ${dish.label}`
          const width = room - size.length - 3

          return (
            <Button
              key={`dish-${index}`}
              plain
              hotkey={String(index + 1)}
              label={`${name.slice(0, width).padEnd(width)}${size}`}
              onPress={() => update($, picked, pick(dish.id))}
            />
          )
        })}
        <Text> </Text>
        <Box>
          <Button
            key="eat"
            label={chosen.length === 0 ? 'Eat' : `Eat ${chosen.length} (frees ~${kilo(saving)})`}
            hotkey="e"
            plain
            onPress={() => arm($)}
          />
          <Text>  </Text>
          <Button key="refresh" label="Refresh" hotkey="r" plain onPress={() => fill($)} />
          <Text>  </Text>
          <Button key="back" label="Back" hotkey="q" plain onPress={() => hideDiet($)} />
        </Box>
        <Text dimColor>Eat puts /compact in your prompt; Enter removes them from the context, each left as a short note.</Text>
      </Box>
    )
  })
}
