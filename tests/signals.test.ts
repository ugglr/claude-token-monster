import { expect, mock, test } from 'claude-code/testing'

import { createScene, paint, step, wait } from '../hooks/paint'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { call, done, pane, text } from './harness'

// The four signals: it calls you, its cache goes cold, it chokes, it is fed up.

// `answer`: a settings hook's decision on a permission dialog, when one answers it.
const engine = (on: On, answer?: 'allow') => {
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
