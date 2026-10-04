import { expect, mock, test } from 'claude-code/testing'

import { createScene, paint, step, wait } from '../hooks/paint'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { call, done, pane, text } from './harness'

// The four signals: it calls you, its cache goes cold, it chokes, it is fed up.

// `answer`: a settings hook's decision on a permission dialog, when one answers it.
const engine = (on: On, answer?: 'allow') => {
  on('turn.step', async function* () {
    yield { kind: 'stop', stopReason: 'end_turn', usage: { ...usage, model: 'm' } }

    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { ...usage, model: 'm' } }
  } as never)
  on('classic.PermissionRequest', () => (answer === undefined ? {} : { decision: { behavior: answer } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.blit', () => ({ value: {} }))
  on('agent.list', () => ({ value: [] }) as never)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {}, text: 'x'.repeat(400) }) as never)

  return mock.clock(on)
}

const fed = { percent: 30, fill: 30, tokens: 1, window: 1, ate: 0, fedAt: 0, burpAt: null, known: true, compactAt: null }

// The engine putting `npm test` to the person.
const asks = ($: Engine) => $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'npm test' } } as never)

test('a dialog up for the person makes it call them, until the call runs', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await asks($)
  expect(await ui.find(text('psst! me waiting for you'))).toBeDefined()
  expect(await ui.find(text('> waiting for you: Bash npm test'))).toBeDefined()

  // Another call finishing is not the answer.
  await call($, { tool: 'Read', file_path: 'a.ts' })
  expect(await ui.find(text(/waiting for you/))).toBeDefined()

  await call($, { tool: 'Bash', command: 'npm test' })
  expect(await ui.find(text(/waiting/))).toBeUndefined()
})

test('a prompt or the turn ending stops the call', async ($, on) => {
  engine(on)
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)
  const ui = await pane($, 'desktop')

  await asks($)
  expect(await ui.find(text(/waiting/))).toBeDefined()
  await $.prompt.submit({ text: 'no, do this instead' } as never)
  expect(await ui.find(text(/waiting/))).toBeUndefined()

  await $.turn.start({ text: 'go', turnId: 't1' })
  await asks($)
  expect(await ui.find(text(/waiting/))).toBeDefined()
  await $.turn.complete({ ...done, turnId: 't1' })
  expect(await ui.find(text(/waiting/))).toBeUndefined()
})

test('a settings hook that answered the dialog asks no one', async ($, on) => {
  engine(on, 'allow')
  const ui = await pane($, 'desktop')

  await asks($)
  expect(await ui.find(text(/waiting/))).toBeUndefined()
})

test('calling, it waves both hands, hops, and a ! blinks beside its head, at every size', () => {
  for (const [width, height] of [[16, 12], [46, 40], [64, 44]] as const) {
    const s = createScene({ monster: 'cookie', color: 'blue' })

    s.belly = fed
    for (let i = 0; i < 20; i++) step(s, width, height)
    wait(s, true)

    let shouted = false

    for (let i = 0; i < 20; i++) {
      step(s, width, height)
      shouted ||= paint(s, width, height).includes(0xffe04d)
    }
    expect(shouted).toBe(true)
    expect(s.antic).toBeNull()

    wait(s, false)
    step(s, width, height)
    expect(paint(s, width, height).includes(0xffe04d)).toBe(false)
  }
})

// What the next response reports: its prompt, read from the cache or not.
let usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

// A main loop response, then the clock and the context checked, as each turn's end does.
const respond = async ($: Engine, read: number, written: number) => {
  usage = { input_tokens: 2000, output_tokens: 1000, cache_read_input_tokens: read, cache_creation_input_tokens: written }
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })

  for await (const _ of stream) {
  }
  await stream.result
}

const measure = ($: Engine) => $.session.measure({ context: { tokens: 60_000, window: 200_000, percent: 30 }, rateLimits: [], changed: ['context'] })

test('five minutes after the last response the cache is cold, and the readout says what the next prompt re-reads', async ($, on) => {
  const clock = engine(on)
  const ui = await pane($, 'desktop')

  await respond($, 100_000, 17_000)
  await clock.advance(4 * 60_000)
  await measure($)
  expect(await ui.find(text(/cold cache/))).toBeUndefined()

  await clock.advance(2 * 60_000)
  await measure($)
  expect(await ui.find(text('cold cache: next prompt re-reads ~120k uncached'))).toBeDefined()

  await respond($, 0, 120_000)
  expect(await ui.find(text(/cold cache/))).toBeUndefined()
})

test('a response after a long gap that still read its prompt from the cache makes it an hour', async ($, on) => {
  const clock = engine(on)
  const ui = await pane($, 'desktop')

  // After seven minutes, written afresh: still five minutes.
  await respond($, 100_000, 17_000)
  await clock.advance(7 * 60_000)
  await respond($, 0, 117_000)
  await clock.advance(6 * 60_000)
  await measure($)
  expect(await ui.find(text(/cold cache/))).toBeDefined()

  // After six, read from the cache: an hour from then on.
  await respond($, 117_000, 0)
  await clock.advance(30 * 60_000)
  await measure($)
  expect(await ui.find(text(/cold cache/))).toBeUndefined()

  await clock.advance(31 * 60_000)
  await measure($)
  expect(await ui.find(text(/cold cache/))).toBeDefined()
})

test('cold, a frosted bowl of leftovers sits beside it, at every size; busy, it is gone', () => {
  for (const [width, height] of [[16, 12], [46, 40], [64, 44]] as const) {
    const s = createScene({ monster: 'crab', color: 'amber' })

    s.belly = fed
    s.at = 10 * 60_000
    s.cache = { at: 0, tokens: 120_000, ttl: 5 * 60_000 }
    for (let i = 0; i < 20; i++) step(s, width, height)
    expect(paint(s, width, height).includes(0x5b8bd6)).toBe(true)

    s.cache.at = 8 * 60_000
    expect(paint(s, width, height).includes(0x5b8bd6)).toBe(false)

    s.cache.at = 0
    s.busy = true
    expect(paint(s, width, height).includes(0x5b8bd6)).toBe(false)
  }
})
