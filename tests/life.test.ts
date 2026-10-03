import { expect, mock, test } from 'claude-code/testing'

import { createScene, fondness, perk, pet, startTurn, step, typed } from '../hooks/paint'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { pane, SURFACES, text } from './harness'

// The canvas the pure tests step the scene on.
const [W, H] = [56, 40]

const engine = (on: On) => {
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.blit', () => ({ value: {} }))

  return mock.clock(on)
}

// A fed monster with nothing going on.
const idle = () => {
  const s = createScene({ monster: 'cookie', color: 'blue' })

  s.belly = { percent: 30, tokens: 60_000, window: 200_000, ate: 0, fedAt: 0, burpAt: null, known: true, compactAt: null, fill: 30 }

  return s
}

const run = (s: ReturnType<typeof idle>, frames: number) => {
  for (let i = 0; i < frames; i++) step(s, W, H)
}

test('the Pet key answers in the readout for a moment, on every surface', async ($, on) => {
  const clock = engine(on)

  await $.session.measure({ context: { tokens: 60_000, window: 200_000, percent: 30 }, rateLimits: [], changed: ['context'] })

  for (const surface of SURFACES) {
    const ui = await pane($, surface)

    expect((await ui.find({ key: 'pet' }))?.props).toMatchObject({ label: 'Pet', hotkey: 'p', plain: true })
    expect(await ui.find(text('nom nom'))).toBeDefined()

    await ui.press({ key: 'pet' })
    expect(await ui.find(text('nom nom'))).toBeUndefined()
    expect(await ui.find(text(/purr|tickles|pets|again|human|LOVE|spin/))).toBeDefined()

    await clock.advance(5000)
    expect(await ui.find(text('nom nom'))).toBeDefined()
    await ui.unmount()
  }
})

test('petting builds affection that fades over minutes', () => {
  const s = idle()

  expect(pet(s, 0)).toBe('purr')
  expect(pet(s, 500)).toBe('wiggle')
  expect(pet(s, 1000)).toBe('wiggle')
  expect(pet(s, 1500)).toBe('spin')
  // Four by now, a quarter of that four minutes on.
  expect(Math.round(fondness(s, 1500 + 4 * 60_000))).toBe(1)
  expect(pet(s, 1500 + 10 * 60_000)).toBe('purr')
})

test('petted asleep it stirs without waking; starving it pleads', () => {
  const s = idle()

  run(s, 1850)
  const quiet = s.activeAt

  expect(pet(s, 0)).toBe('stir')
  expect(s.activeAt).toBe(quiet)

  const hungry = idle()

  expect(pet(hungry, 2 * 60 * 60_000)).toBe('plead')
})

test('antics start only when it is idle, never the same twice running', () => {
  const s = idle()
  const seen: string[] = []

  for (let i = 0; i < 9000; i++) {
    // Something happens now and then, so it never dozes off.
    if (i % 1000 === 999) s.activeAt = s.tick
    const before = s.antic

    step(s, W, H)
    if (s.antic !== null && s.antic !== before) seen.push(s.antic.kind)
  }

  expect(seen.length).toBeGreaterThan(8)
  expect(seen.some((kind, i) => kind === seen[i - 1])).toBe(false)

  const busy = idle()

  startTurn(busy)
  for (let i = 0; i < 1500; i++) {
    step(busy, W, H)
    expect(busy.antic).toBeNull()
  }
})

test('an antic stops the moment anything happens', () => {
  const s = idle()

  while (s.antic === null) step(s, W, H)
  s.typedAt = s.tick
  step(s, W, H)
  expect(s.antic).toBeNull()

  while (s.antic === null) step(s, W, H)
  perk(s)
  step(s, W, H)
  expect(s.antic).toBeNull()

  while (s.antic === null) step(s, W, H)
  startTurn(s)
  step(s, W, H)
  expect(s.antic).toBeNull()
})

test('typing after a long quiet earns a wave hello, once', () => {
  const s = idle()

  expect(typed(s)).toBe(false)
  run(s, 1300)
  expect(typed(s)).toBe(true)
  expect(s.greetAt).toBe(s.tick)
  expect(typed(s)).toBe(false)
})

test('a starving monster that has been quiet for long pleads; it is not asleep', () => {
  const s = createScene({ monster: 'cookie', color: 'blue' })

  s.at = 3 * 60 * 60_000
  s.belly = { percent: 30, fill: 30, tokens: 1, window: 1, ate: 0, fedAt: 0, burpAt: null, known: true, compactAt: null }
  s.tick = 5000
  s.activeAt = 0
  expect(pet(s, s.at)).toBe('plead')
})
