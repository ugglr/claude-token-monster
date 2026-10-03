import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const

const pane = ($: Engine, surface: (typeof SURFACES)[number]) =>
  $.ui.mount({
    plugin: 'token-monster',
    surface,
    component: 'Pane',
    requestId: 'token-monster',
    props: {
      title: 'Token Monster',
      isFocused: true,
      bodyColumns: 24,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 30 },
      view: {},
    },
  })

const engine = (on: On) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))

  return mock.clock(on)
}

const measure = ($: Engine, tokens: number, rateLimits: { kind: string; percentUsed: number }[] = []) =>
  $.session.measure({
    context: { tokens, window: 200_000, percent: Math.round((tokens / 200_000) * 100) },
    rateLimits,
    changed: rateLimits.length > 0 ? ['context', 'rateLimits'] : ['context'],
  })

test('the monster eats what the context grew by and shows the fill', async ($, on) => {
  engine(on)
  await measure($, 20_000)
  await measure($, 120_000)

  for (const surface of SURFACES) {
    const ui = await pane($, surface)

    expect(await ui.find({ type: 'Text', text: 'om nom nom nom' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '60% 120.0k/200.0k' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'ate 100.0k' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '( O )( O )' })).toBeDefined()
  }
})

test('a full belly asks for /compact, and a compaction is a burp', async ($, on) => {
  engine(on)
  await measure($, 190_000)

  for (const surface of SURFACES) {
    const ui = await pane($, surface)

    expect(await ui.find({ text: /burst/ })).toBeDefined()
    await measure($, 30_000)
    expect(await ui.find({ text: /burp/ })).toBeDefined()
    expect(await ui.find({ text: /^ate/ })).toBeUndefined()
    await measure($, 190_000)
  }
})

test('the buttons swap the monster and its color', async ($, on) => {
  mock.store(on)

  for (const surface of SURFACES) {
    const ui = await pane($, surface)
    const before = await ui.find({ type: 'Text', text: '/          \\' })

    await ui.press({ key: 'monster' })
    expect(await ui.find({ type: 'Text', text: '/          \\' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: '  /  o  \\' })).toBeDefined()

    await ui.press({ key: 'color' })
    expect((await ui.find({ type: 'Text', text: '  /  o  \\' }))?.props.color).not.toBe(before?.props.color)

    await ui.press({ key: 'monster' })
    await ui.press({ key: 'monster' })
  }
})

test('the monster chews while a turn runs', async ($, on) => {
  const clock = mock.clock(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  const ui = await pane($, 'terminal')

  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(await ui.find({ type: 'Text', text: '|  ------  |' })).toBeDefined()

  await clock.advance(350)
  expect(await ui.find({ type: 'Text', text: '|  .----.  |' })).toBeDefined()

  await clock.advance(350)
  expect(await ui.find({ type: 'Text', text: '|  ------  |' })).toBeDefined()
})

test('an unfed monster gets sad, then starves, and cheers up when fed', async ($, on) => {
  const clock = engine(on)
  const ui = await pane($, 'terminal')

  await measure($, 20_000)
  await clock.advance(16 * 60_000)
  await measure($, 20_000)
  expect(await ui.find({ type: 'Text', text: 'me sad. no tokens :(' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: ' ( T )( T )' })).toBeDefined()

  await clock.advance(45 * 60_000)
  await measure($, 20_000)
  expect(await ui.find({ type: 'Text', text: /starving/ })).toBeDefined()

  await measure($, 25_000)
  expect(await ui.find({ type: 'Text', text: 'ME WANT TOKENS!' })).toBeDefined()
})

test('the pantry shows the session and weekly limits', async ($, on) => {
  engine(on)
  const ui = await pane($, 'terminal')

  await measure($, 20_000, [
    { kind: 'five_hour', percentUsed: 92 },
    { kind: 'seven_day', percentUsed: 40 },
  ])
  expect(await ui.find({ type: 'Box', text: /^session .* 92%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Box', text: /^weekly .* 40%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'pantry almost empty! me ration' })).toBeDefined()

  await measure($, 20_000, [
    { kind: 'five_hour', percentUsed: 5 },
    { kind: 'seven_day', percentUsed: 10 },
  ])
  expect(await ui.find({ type: 'Text', text: 'pantry full. feast time!' })).toBeDefined()
})
