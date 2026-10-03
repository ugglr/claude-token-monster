import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

import { stubbed, withMedia } from '../hooks/diet'

const ROWS = [
  { role: 'user' as const, text: 'look around', toolUses: [] },
  {
    role: 'assistant' as const,
    text: '',
    toolUses: [
      { tool_use_id: 'big', tool: 'Read', input: { file_path: 'src/huge.ts' }, text: 'x'.repeat(40_000) },
      { tool_use_id: 'small', tool: 'Bash', input: { command: 'ls' }, text: 'y'.repeat(400) },
    ],
  },
  {
    role: 'user' as const,
    text: '',
    toolUses: [],
    toolResults: [
      { tool_use_id: 'big', text: 'x'.repeat(40_000), isError: false },
      { tool_use_id: 'small', text: 'y'.repeat(400), isError: false },
    ],
    handle: 'h3',
  },
]

const API = [
  { role: 'user', content: [{ type: 'text', text: 'look around' }] },
  { role: 'assistant', content: [{ type: 'tool_use', id: 'big' }, { type: 'tool_use', id: 'small' }] },
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'big', content: [{ type: 'text', text: 'x' }] },
      { type: 'tool_result', tool_use_id: 'small', content: 'y' },
    ],
  },
]

const menu = (on: On, api: { role: string; content: { type: string; [field: string]: unknown }[] }[] = API, hasClock = true) => {
  if (hasClock) mock.clock(on)
  on('session.messages', (_, e) => ({ value: e.as === 'api' ? api : ROWS }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
}

const mountDiet = ($: Engine, surface: 'terminal' | 'desktop') =>
  $.ui.mount({
    plugin: 'token-monster',
    surface,
    component: 'Pane',
    requestId: 'token-monster-diet',
    props: { title: 'Diet', isFocused: true, bodyColumns: 48, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })

const openDiet = ($: Engine) =>
  $.command.run({ command: 'token-monster', args: 'diet', origin: 'user', presentation: { layout: 'fullscreen', columns: 200 } } as never)

test('the diet lists tool results biggest first and picks one', async ($, on) => {
  menu(on)
  await openDiet($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await mountDiet($, surface)

    expect((await ui.find({ key: 'dish-0' }))?.text).toMatch(/^\[ \] Read src\/huge.ts +~10k$/)
    expect((await ui.find({ key: 'dish-1' }))?.text).toMatch(/^\[ \] Bash ls +~100$/)

    await ui.press({ key: 'dish-0' })
    expect((await ui.find({ key: 'dish-0' }))?.text).toMatch(/^\[x\]/)
    expect((await ui.find({ key: 'eat' }))?.text).toBe('Eat 1 (~10k)')
    await ui.unmount()
    await openDiet($)
  }
})

test('results sharing a message with an image are never offered', async ($, on) => {
  const withImage = API.map((message, index) =>
    index === 2 ? { ...message, content: [...message.content, { type: 'image', source: {} }] } : message,
  )

  menu(on, withImage)
  await openDiet($)

  expect(await (await mountDiet($, 'desktop')).find({ key: 'dish-0' })).toBeUndefined()
})

test('withMedia finds the results that sit beside an image or a document', () => {
  expect([...withMedia(API)]).toEqual([])
  expect([
    ...withMedia([
      { content: [{ type: 'tool_result', tool_use_id: 'a', content: [{ type: 'image' }] }, { type: 'tool_result', tool_use_id: 'b', content: 'ok' }] },
      { content: [{ type: 'tool_result', tool_use_id: 'c', content: 'ok' }, { type: 'document' }] },
      { content: [{ type: 'tool_result', tool_use_id: 'd', content: 'ok' }, { type: 'text', text: 'reminder' }] },
    ]),
  ]).toEqual(['a', 'b', 'c'])
})

const arm = async ($: Engine, on: On, hasClock = true) => {
  const said: string[] = []

  menu(on, API, hasClock)
  on('prompt.fill', () => ({ isFilled: true }))
  on('ui.toast', (_, e) => {
    said.push(e.text)

    return { value: {} } as never
  })
  await openDiet($)

  const ui = await mountDiet($, 'desktop')

  await ui.press({ key: 'dish-0' })
  await ui.press({ key: 'eat' })

  return { ui, said }
}

const core = (on: On) => {
  const calls = { summarized: 0 }

  on('session.compact', () => {
    calls.summarized += 1

    return { messages: [{ role: 'user', text: 'summary', toolUses: [] }] }
  })

  return calls
}

test('Eat arms the diet and puts /compact in the prompt; your /compact eats only the picked results', async ($, on) => {
  const calls = core(on)
  const { ui, said } = await arm($, on)

  expect(said).toEqual(['Press Enter on /compact and me eat.'])
  expect(await ui.find({ type: 'Text', text: /^Armed: me eat 1 on your next \/compact/ })).toBeDefined()

  const done = await $.session.compact({ trigger: 'manual', messages: ROWS })

  expect(calls.summarized).toBe(0)
  expect(done.messages?.[1]).toEqual(ROWS[1])
  expect(done.messages?.[2]?.toolResults?.[0]?.text).toMatch(/^\[Token Monster ate this Read result/)
  expect(await ui.find({ type: 'Text', text: /^Armed/ })).toBeUndefined()

  await $.session.compact({ trigger: 'manual', messages: ROWS })
  expect(calls.summarized).toBe(1)
})

test('an armed diet leaves automatic compaction and Cancel leaves /compact alone', async ($, on) => {
  const calls = core(on)
  const { ui } = await arm($, on)

  await $.session.compact({ trigger: 'auto', messages: ROWS })
  expect(calls.summarized).toBe(1)

  await ui.press({ key: 'cancel' })
  await $.session.compact({ trigger: 'manual', messages: ROWS })
  expect(calls.summarized).toBe(2)
})

test('a burp that fails never costs the meal', async ($, on) => {
  const calls = core(on)

  on('clock.now', () => {
    throw new Error('no clock')
  })
  await arm($, on, false)

  const done = await $.session.compact({ trigger: 'manual', messages: ROWS })

  expect(calls.summarized).toBe(0)
  expect(done.messages?.[2]?.toolResults?.[0]?.text).toMatch(/^\[Token Monster ate/)
})

test('an armed /compact that reaches no conversation is vetoed, never a full compaction', async ($, on) => {
  const calls = core(on)

  await arm($, on)

  const done = await $.session.compact({ trigger: 'manual', messages: [] } as never)

  expect(calls.summarized).toBe(0)
  expect(done.skip).toBe('me could not see the conversation')
})

test('eating stubs only the picked results and leaves every other message whole', () => {
  const after = stubbed(ROWS, new Set(['big']))

  expect(after[0]).toBe(ROWS[0])
  expect(after[1]).toBe(ROWS[1])
  expect(after[2]?.handle).toBeUndefined()
  expect(after[2]?.toolResults?.[0]?.text).toBe(
    '[Token Monster ate this Read result (~10k tokens) to free context. Run the tool again if you need it.]',
  )
  expect(after[2]?.toolResults?.[1]).toBe(ROWS[2]?.toolResults?.[1])
  expect(stubbed(ROWS, new Set())).toEqual(ROWS)
})
