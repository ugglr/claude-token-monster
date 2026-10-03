import { expect, mock, test } from 'claude-code/testing'

import { levelOf, xpFor } from '../hooks/grow'
import { EGG, createScene, hatch, hatching, levelUp, serve, step } from '../hooks/paint'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { call, done, pane, text } from './harness'

// A session beneath the monster: a store holding `saved` (the map is the store, for
// the test to read and write), a clock, tools and turns.
const session = (on: On, saved: Record<string, unknown> = {}) => {
  const store = new Map(Object.entries(saved))

  on('store.get', (_, e) => ({ value: store.get(e.key) }) as never)
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined } as never
  })
  mock.env(on, { COLORTERM: 'truecolor' })
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.blit', () => ({ value: {} }))
  on('ui.close', () => ({ value: {} }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('session.start', () => ({ cwd: '/' }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {}, text: 'x'.repeat(400) }) as never)

  return { clock: mock.clock(on), store }
}

const start = ($: Engine) => $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)

// $.tool.call's overloads are too deep for tsc over a loose argument; one plain signature.
test('the level curve: quick at first, then slower', () => {
  expect(xpFor(1)).toBe(0)
  expect(xpFor(2)).toBe(20_000)
  expect(levelOf(0)).toBe(1)
  expect(levelOf(19_999)).toBe(1)
  expect(levelOf(20_000)).toBe(2)

  for (let n = 1; n < 40; n++) {
    expect(levelOf(xpFor(n))).toBe(n)
    expect(levelOf(xpFor(n + 1) - 1)).toBe(n)
    // Every level takes longer than the one before.
    expect(xpFor(n + 2) - xpFor(n + 1)).toBeGreaterThan(xpFor(n + 1) - xpFor(n))
  }

  expect(xpFor(3)).toBeLessThan(100_000)
  expect(xpFor(10)).toBeGreaterThan(2_000_000)
  expect(xpFor(25)).toBeGreaterThan(20_000_000)
  // No cap: past any level there is a next one, so the readout always has a way to go.
  expect(levelOf(1e12)).toBeGreaterThan(99)
  expect(xpFor(levelOf(1e12) + 1)).toBeGreaterThan(xpFor(levelOf(1e12)))
})

test('what it eats is banked in the store at the end of each turn, and every 30 seconds in a long one', async ($, on) => {
  const { clock, store } = session(on, { xp: 1000 })

  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await call($, { tool: 'Read', file_path: 'a.ts' })
  await call($, { tool: 'Read', file_path: 'b.ts' })
  await $.turn.complete({ ...done, turnId: 't1' })
  expect(store.get('xp')).toBe(1200)

  // A long turn banks on the clock, not only at its end.
  await $.turn.start({ text: 'more', turnId: 't2' })
  await call($, { tool: 'Read', file_path: 'c.ts' })
  await clock.advance(30_000)
  expect(store.get('xp')).toBe(1300)

  // Another session banked meanwhile: its tokens are kept, not overwritten.
  store.set('xp', 5000)
  await call($, { tool: 'Read', file_path: 'd.ts' })
  await clock.advance(30_000)
  expect(store.get('xp')).toBe(5100)

  // A turn's end banks at once, and nothing is banked twice.
  await call($, { tool: 'Read', file_path: 'e.ts' })
  await $.turn.complete({ ...done, turnId: 't2' })
  expect(store.get('xp')).toBe(5200)
  await clock.advance(30_000)
  expect(store.get('xp')).toBe(5200)
})

test('the readout shows the level and the way to the next', async ($, on) => {
  session(on, { xp: xpFor(7) + 1000 })
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await pane($, surface)

    expect(await ui.find({ type: 'Box', text: /^Lv 7 +━*─+ \d+k to Lv 8$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('crossing a level says so, and names what it got', async ($, on) => {
  const toasts: string[] = []

  session(on, { xp: xpFor(3) - 150 })
  on('ui.toast', (_, e) => {
    toasts.push((e as { text: string }).text)

    return {} as never
  })
  await start($)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await call($, { tool: 'Read', file_path: 'a.ts' })
  await call($, { tool: 'Read', file_path: 'b.ts' })
  await $.turn.complete({ ...done, turnId: 't1' })

  expect(toasts).toContain('Token Monster grew to Lv 3 and got a bow tie!')
  expect(await (await pane($, 'desktop')).find({ type: 'Box', text: /^Lv 3 / })).toBeDefined()
})

test('a new session hatches from an egg once; starting the session again does not hatch it again', async ($, on) => {
  const { clock, store } = session(on)

  await start($)
  const ui = await pane($, 'terminal')

  await clock.advance(300)
  expect(await ui.find(text('*crack* ... *crack*'))).toBeDefined()

  await clock.advance(5000)
  expect(await ui.find(text(/crack/))).toBeUndefined()

  // session.start again (a reload does this too): $.state remembers its birthday.
  await start($)
  await clock.advance(300)
  expect(await ui.find(text(/crack/))).toBeUndefined()
})

test('a pane opened long after the start skips the egg', async ($, on) => {
  const { clock, store } = session(on)

  await start($)
  await clock.advance(25_000)
  const ui = await pane($, 'terminal')

  await clock.advance(300)
  expect(await ui.find(text(/crack/))).toBeUndefined()
})

test('the scene hatches once, in time, and a first reading of the level is no level-up', () => {
  const s = createScene({ monster: 'slime', color: 'green' })

  expect(hatch(s, 5000)).toBe(false)

  s.eggDue = 1000
  expect(hatch(s, 25_000)).toBe(false)

  s.eggDue = 1000
  expect(hatch(s, 3000)).toBe(true)
  expect(hatching(s)).toBe(true)
  expect(hatch(s, 3000)).toBe(false)

  for (let i = 0; i < EGG; i++) step(s, 40, 40)
  expect(hatching(s)).toBe(false)

  levelUp(s, 4)
  expect([s.rank, s.rankUpAt]).toEqual([4, -1000])
  levelUp(s, 5)
  expect([s.rank, s.rankUpAt]).toEqual([5, s.tick])

  serve(s, 120, 0xffffff)
  serve(s, 40, 0xffffff, false)
  expect(s.eaten).toBe(120)
})

test('a monster past level 99 still draws its readout', async ($, on) => {
  session(on, { xp: 2e12 })
  await start($)

  const ui = await pane($, 'desktop')

  expect(await ui.find({ type: 'Box', text: /^Lv \d{3,} +━*─+ [\d.]+[kM] to Lv \d+$/ })).toBeDefined()
})
