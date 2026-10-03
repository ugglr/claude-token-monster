import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, SessionMessage } from 'claude-code'

import type { Dish } from '../types'
import { kilo } from './format'

// The diet: picked tool results replaced by a stub, so every tool call keeps its
// result and the conversation stays valid. Roughly four characters to a token.
//
// Eat only arms it. A plugin's own $.session.compact() skips that plugin's hooks,
// so the diet could not answer it and core would summarize everything instead.
// The person's next /compact is answered here, with the armed results eaten.
export const DIET = 'token-monster-diet'

const COURSES = 12
const EATEN = '[Token Monster ate this '
const LABELS = ['file_path', 'command', 'url', 'pattern', 'query', 'description', 'prompt']

const menu = atom({ plugin: 'token-monster', key: 'menu' } as const, [])
const picked = atom({ plugin: 'token-monster', key: 'picked' } as const, [])
const armed = atom({ plugin: 'token-monster', key: 'armed' } as const, [])

type Block = { type: string; [field: string]: unknown }

const estimate = (text: string) => Math.ceil(text.length / 4)

export const label = (input: Record<string, unknown>) =>
  String(LABELS.map(name => input[name]).find(value => typeof value === 'string') ?? '')

const stub = (tool: string, text: string) =>
  `${EATEN}${tool} result (~${kilo(estimate(text))} tokens) to free context. Run the tool again if you need it.]`

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

      dishes.push({ id: use.tool_use_id, tool: use.tool, label: label(use.input), tokens: estimate(use.text) })
    }
  }

  await update($, menu, () => dishes.sort((a, b) => b.tokens - a.tokens).slice(0, COURSES))
  await update($, picked, () => [])
}

const pick = (id: string) => (ids: string[]) => (ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id])

const arm = async ($: EngineInterface) => {
  const chosen = await read($, picked)

  if (chosen.length === 0) return

  await update($, armed, () => chosen)

  const { isFilled } = await $.prompt.fill({ text: '/compact' })

  $.ui.toast(isFilled ? 'Press Enter on /compact and me eat.' : 'Run /compact and me eat.')
}

const disarm = async ($: EngineInterface) => {
  await update($, armed, () => [])
}

export const registerDiet = (on: On) => {
  on('ui.open', async ($, e, next) => {
    if (e.id === DIET) await fill($)

    return next(e)
  })

  // Only the person's /compact eats: an automatic one needs the room a summary makes.
  on('session.compact', { trigger: 'manual' }, async ($, e, next) => {
    const ids = await read($, armed)

    if (ids.length === 0 || e.agentId !== undefined) return next(e)

    await update($, armed, () => [])
    await update($, menu, dishes => dishes.filter(dish => !ids.includes(dish.id)))
    await update($, picked, () => [])

    if (!Array.isArray(e.messages) || e.messages.length === 0) return { skip: 'me could not see the conversation' }

    return { messages: stubbed(e.messages, new Set(ids)) }
  })

  on('ui.render', { component: 'Pane', requestId: DIET }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const dishes = await read($, menu)
    const ids = await read($, picked)
    const ready = await read($, armed)
    const room = Math.max(12, e.props.bodyColumns - 2)
    const chosen = dishes.filter(dish => ids.includes(dish.id))
    const saving = chosen.reduce((sum, dish) => sum + dish.tokens, 0)

    return (
      <Box flexDirection="column">
        <Text bold>Pick what me eat, biggest first</Text>
        {ready.length > 0 && (
          <Box>
            <Text color="yellow">Armed: me eat {ready.length} on your next /compact </Text>
            <Button key="cancel" label="Cancel" hotkey="x" onPress={() => disarm($)} />
          </Box>
        )}
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
            onPress={() => arm($)}
          />
          <Text> </Text>
          <Button key="refresh" label="Refresh" hotkey="r" onPress={() => fill($)} />
        </Box>
        <Text dimColor>Eat arms them; your /compact eats them. Each becomes a short note.</Text>
      </Box>
    )
  })
}
