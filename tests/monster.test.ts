import { expect, mock, test } from 'claude-code/testing'
import type { On, SessionContextUsage } from 'claude-code'
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
      bodyColumns: 46,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })

const engine = (on: On) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.blit', () => ({ value: {} }))

  return mock.clock(on)
}

const context = (tokens: number | undefined): SessionContextUsage =>
  tokens === undefined
    ? { window: 200_000 }
    : { tokens, window: 200_000, percent: Math.round((tokens / 200_000) * 100) }

const measure = ($: Engine, tokens: number | undefined, rateLimits: { kind: string; percentUsed: number }[] = []) =>
  $.session.measure({
    context: context(tokens),
    rateLimits,
    changed: rateLimits.length > 0 ? ['context', 'rateLimits'] : ['context'],
  })

const text = (value: string | RegExp) => ({ type: 'Text', text: value })

test('the readout shows the belly, its fill and the last bite, on every surface', async ($, on) => {
  engine(on)
  await measure($, 20_000)
  await measure($, 120_000)

  for (const surface of SURFACES) {
    const ui = await pane($, surface)

    expect(await ui.find(text('om nom nom nom'))).toBeDefined()
    expect(await ui.find({ type: 'Box', text: /^belly +█+░+ +60% 120k\/200k$/ })).toBeDefined()
    expect(await ui.find(text('last bite +100k, fed 0m ago'))).toBeDefined()

    if (surface === 'terminal') {
      expect((await ui.find({ type: 'Raster' }))?.props).toMatchObject({ key: 'sprite', columns: 46, rows: 16 })
    } else {
      expect(await ui.find(text(' ( O )( O )'))).toBeDefined()
    }

    await ui.unmount()
  }
})

test('a full belly asks for /compact; a compaction burps and is not counted as a meal', async ($, on) => {
  engine(on)
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
  const ui = await pane($, 'desktop')

  await measure($, 190_000)
  expect(await ui.find(text('me gonna burst! /compact'))).toBeDefined()

  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'long story', toolUses: [] }] })
  await measure($, undefined)
  await measure($, 30_000)

  expect(await ui.find(text('*burp* me feel lighter'))).toBeDefined()
  expect(await ui.find(text(/last bite/))).toBeUndefined()
})

test('tokens dropping without a compaction event is a burp too', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await measure($, 120_000)
  await measure($, 30_000)

  expect(await ui.find(text('*burp* me feel lighter'))).toBeDefined()
})

test('the buttons swap the monster and its color', async ($, on) => {
  engine(on)
  mock.store(on)
  const ui = await pane($, 'desktop')
  const before = await ui.find(text('/          \\'))

  await ui.press({ key: 'monster' })
  expect(await ui.find(text('/          \\'))).toBeUndefined()
  expect(await ui.find(text('   ( o  o )'))).toBeDefined()

  await ui.press({ key: 'color' })
  expect((await ui.find(text('   ( o  o )')))?.props.color).not.toBe(before?.props.color)
})

test('it chews through a turn, and a subagent finishing does not stop it', async ($, on) => {
  engine(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  const ui = await pane($, 'desktop')
  const chewing = () => ui.find(text('|  .----.  |'))

  await $.turn.start({ text: 'hi', turnId: 't1' })
  expect(await chewing()).toBeDefined()
  expect(await ui.find(text('> thinking...'))).toBeDefined()

  const done = { answer: '', durationMs: 1, isAborted: false, reason: 'answer' as const }

  await $.turn.complete({ ...done, turnId: 'sub-turn', agentId: 'sub1' })
  expect(await chewing()).toBeDefined()

  await $.turn.complete({ ...done, turnId: 't1' })
  expect(await chewing()).toBeUndefined()
})

test('an unfed monster gets sad, then starves, and cheers up when fed', async ($, on) => {
  const clock = engine(on)
  const ui = await pane($, 'desktop')

  await measure($, 20_000)
  await clock.advance(16 * 60_000)
  await measure($, 20_000)
  expect(await ui.find(text('me sad. no tokens :('))).toBeDefined()
  expect(await ui.find(text(' ( T )( T )'))).toBeDefined()

  await clock.advance(45 * 60_000)
  await measure($, 20_000)
  expect(await ui.find(text(/starving/))).toBeDefined()

  await measure($, 25_000)
  expect(await ui.find(text('ME WANT TOKENS!'))).toBeDefined()
})

test('the pantry shows the session, weekly and spend limits', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await measure($, 20_000, [
    { kind: 'five_hour', percentUsed: 92 },
    { kind: 'seven_day', percentUsed: 40 },
    { kind: 'spend_limit', percentUsed: 10 },
  ])
  expect(await ui.find({ type: 'Box', text: /^session +█+░+ +92% $/ })).toBeDefined()
  expect(await ui.find({ type: 'Box', text: /^weekly +█+░+ +40% $/ })).toBeDefined()
  expect(await ui.find({ type: 'Box', text: /^spend +█+░+ +10% $/ })).toBeDefined()
  expect(await ui.find(text('pantry almost empty! me ration'))).toBeDefined()

  await measure($, 20_000, [{ kind: 'five_hour', percentUsed: 5 }])
  expect(await ui.find(text('pantry full. feast time!'))).toBeDefined()
})

test('session.start restores the saved look', async ($, on) => {
  engine(on)
  mock.store(on, { look: { monster: 'ghost', color: 'red' } })
  on('session.usage', () => ({ value: { startedAt: 0, context: context(10_000), rateLimits: [] } }))
  on('command.register', () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', () => ({ cwd: '/' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)
  expect(await (await pane($, 'desktop')).find(text('  / o   o \\'))).toBeDefined()
})

test('a stale saved look falls back to the default', async ($, on) => {
  engine(on)
  mock.store(on, { look: { monster: 'chomper', color: 'red' } })
  on('session.usage', () => ({ value: { startedAt: 0, context: context(10_000), rateLimits: [] } }))
  on('command.register', () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', () => ({ cwd: '/' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)
  expect(await (await pane($, 'desktop')).find(text(' ( o )( o )'))).toBeDefined()
})

test('/token-monster swaps by name and lists the options for an unknown word', async ($, on) => {
  engine(on)
  mock.store(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  const run = (args: string) =>
    $.command.run({ command: 'token-monster', args, origin: 'user', presentation: { layout: 'fullscreen', columns: 200 } } as never)

  expect((await run('dragon')).text).toBe(
    'Me not know dragon. Monsters: cookie, slime, ghost, gremlin. Colors: blue, cyan, green, yellow, magenta, red, white. Or: diet.',
  )
  expect((await run('Gremlin GREEN')).text).toBe('Token Monster is hungry.')
  expect(await (await pane($, 'desktop')).find(text(' |  o   o  |'))).toBeDefined()
})

// $.tool.call's overloads are too deep for tsc over a loose argument; one plain signature.
type Caller = { call: (input: Record<string, unknown>) => Promise<unknown> }
const call = ($: Engine, input: Record<string, unknown>) => ($.tool as unknown as Caller).call(input)

const tool = (on: On, gate?: Promise<void>, reached?: () => void) => {
  on('agent.list', () => ({ value: [] }) as never)
  on('tool.call', async (_, e) => {
    if (e.tool === 'Agent') {
      reached?.()
      await gate
    }

    return { result: {}, text: 'x'.repeat(400) } as never
  })
}

test('chained tool calls show a combo in the readout', async ($, on) => {
  engine(on)
  tool(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  const ui = await pane($, 'desktop')

  await $.turn.start({ text: 'go', turnId: 't1' })
  for (let i = 0; i < 3; i++) await call($, { tool: 'Read', file_path: `f${i}.ts` })

  expect(await ui.find(text('> thinking...  3 HIT COMBO'))).toBeDefined()
})

test('a running subagent sends the monster into super mode, and it powers down after', async ($, on) => {
  engine(on)
  let release = () => {}
  let reached = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  const inside = new Promise<void>(resolve => (reached = resolve))

  tool(on, gate, reached)
  const ui = await pane($, 'desktop')
  const running = call($, { tool: 'Agent', description: 'help', prompt: 'help me', subagent_type: 'general-purpose' })

  await inside
  expect(await ui.find(text('SUPER MODE! me and 1 helper'))).toBeDefined()

  release()
  await running
  expect(await ui.find(text(/SUPER MODE/))).toBeUndefined()
})

test('the stream passes through the monster untouched', async ($, on) => {
  engine(on)
  on('turn.step', async function* () {
    yield { kind: 'text', index: 0, text: 'hello there' }
    yield { kind: 'tool', index: 1, id: 'tu1', name: 'Bash' }
    yield { kind: 'input', index: 1, json: '{"command":"ls"}', turnId: 't1' }

    return { turnId: 't1', index: 0, answer: 'hello there', toolUses: [], stopReason: 'end_turn', usage: null }
  } as never)

  const seen: unknown[] = []
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })

  for await (const chunk of stream) seen.push(chunk)

  expect(seen).toEqual([
    { kind: 'text', index: 0, text: 'hello there' },
    { kind: 'tool', index: 1, id: 'tu1', name: 'Bash' },
    { kind: 'input', index: 1, json: '{"command":"ls"}', turnId: 't1' },
  ])
  await stream.result
})
