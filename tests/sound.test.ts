import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { call, done, hold, holding, pane, run } from './harness'

// The world beneath the monster with a speaker in it: every clip asked for is recorded.
const world = (on: On, stored: Record<string, unknown> = {}) => {
  const played: string[] = []
  const gains: number[] = []
  const said: string[] = []
  const saved: Record<string, unknown>[] = []

  on('store.set', { key: 'sound' }, (_, e, next) => {
    saved.push({ [e.key]: e.value })

    return next(e)
  })
  mock.store(on, stored)
  on('audio.play', (_, e) => {
    played.push(String(e.clip.asset))
    gains.push(e.gain ?? 1)

    return { value: undefined } as never
  })
  on('ui.toast', (_, e) => {
    said.push(e.text)

    return { value: {} } as never
  })
  on('ui.panes', () => ({ value: [{ id: 'token-monster', title: 'Token Monster', isShown: false, isFocused: false, isPlaced: true }] }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.blit', () => ({ value: {} }))
  on('agent.list', () => ({ value: [] }) as never)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.edit', (_, e) => ({ text: e.text, cursor: e.cursor }))
  on('classic.PermissionRequest', () => ({}))
  on('tool.call', async (_, e) => {
    const input = e as unknown as { file_path?: string }

    await holding(e)

    return { result: {}, text: 'x'.repeat(input.file_path === 'big.ts' ? 100_000 : 400), isError: input.file_path === 'missing.ts' } as never
  })

  return { clock: mock.clock(on, { now: 1_000_000 }), played, gains, said, saved }
}

const read = ($: Engine, file_path: string) => call($, { tool: 'Read', file_path })

// Claude runs `command` and the engine asks the person about it; resolves to their answer.
const asks = ($: Engine, command = 'npm test') => hold($, { tool: 'Bash', command })

const measure = ($: Engine, tokens: number) =>
  $.session.measure({ context: { tokens, window: 200_000, percent: Math.round(tokens / 2000) }, rateLimits: [], changed: ['context'] })

// The typing mark starts without holding anything up: let it land.
// The test's $ types neither setTimeout nor prompt.edit, so each is spelled out once here.
const later = (globalThis as unknown as { setTimeout: (done: () => void, ms: number) => void }).setTimeout
const settle = () => new Promise<void>(resolve => later(resolve, 30))
const type = ($: Engine, text: string) =>
  ($.prompt as unknown as { edit: (e: Record<string, unknown>) => Promise<unknown> }).edit({
    origin: { kind: 'composer' },
    text,
    cursor: text.length,
    start: 0,
    end: 0,
    inputText: text,
  })

const start = ($: Engine, on: On) => {
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 10_000, window: 200_000, percent: 5 }, rateLimits: [] } }) as never)
  on('command.register', () => ({ value: {} }) as never)
  on('session.start', () => ({ cwd: '/' }))
  mock.env(on, {})
  on('ui.close', () => ({ value: undefined }) as never)

  return $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as never)
}

test('sound is off by default, and then nothing plays, a wait included', async ($, on) => {
  const { played } = world(on)
  const ui = await pane($)

  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: off')
  expect((await ui.find({ key: 'sound' }))?.props).toMatchObject({ hotkey: 's', plain: true })

  await (await asks($))()
  expect(played).toEqual([])
})

test('s turns it on and off, the choice is stored, and the first time says so once', async ($, on) => {
  const { played, said, saved } = world(on)
  const ui = await pane($)

  await ui.press({ key: 'sound' })
  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: on')
  expect(saved).toContainEqual({ sound: true })
  expect(said).toHaveLength(1)
  expect(said[0]).toMatch(/^Sound on: .*macOS only/)

  await ui.press({ key: 'sound' })
  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: off')
  expect(saved).toContainEqual({ sound: false })

  await ui.press({ key: 'sound' })
  expect(said).toHaveLength(1)
  expect(played).toEqual([])
})

test('/token-monster sound on|off sets it, and a bare sound toggles', async ($, on) => {
  const { saved } = world(on)
  const ui = await pane($)

  expect((await run($, 'sound on')).text).toBe('Sound on. Me chime when Claude waits on you (macOS).')
  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: on')
  expect((await run($, 'Sound OFF')).text).toBe('Sound off. Me call you quietly.')
  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: off')
  expect((await run($, 'sound')).text).toBe('Sound on. Me chime when Claude waits on you (macOS).')
  expect((await run($, 'sound loud')).text).toBe('Usage: /token-monster sound on|off')
  expect(saved.filter(entry => 'sound' in entry)).toEqual([{ sound: true }, { sound: false }, { sound: true }])
})

test('a stored choice comes back with the session, silently', async ($, on) => {
  const { played, said } = world(on, { sound: true, soundHeard: true })

  await start($, on)
  expect((await (await pane($)).find({ key: 'sound' }))?.text).toBe('Sound: on')
  expect(played).toEqual([])
  expect(said).toEqual([])
})

test('with sound on, Claude starting to wait on you chimes once, quietly, pane shown or not', async ($, on) => {
  const { clock, played, gains } = world(on, { soundHeard: true })

  await run($, 'sound on')

  const first = await asks($)

  expect(played.splice(0)).toEqual(['sounds/call.wav'])

  // A second call asked about while it still waits is the same wait.
  await (await asks($, 'npm run lint'))()
  await first()
  expect(played.splice(0)).toEqual([])

  await clock.advance(10_000)
  await asks($)
  expect(played.splice(0)).toEqual(['sounds/call.wav'])
  expect(gains.every(gain => gain > 0 && gain <= 0.35)).toBe(true)
})

test('nothing else makes a sound: tools, combos, turns, gags, burps', async ($, on) => {
  const { clock, played } = world(on, { soundHeard: true })

  await run($, 'sound on')
  await $.turn.start({ text: 'go', turnId: 't1' })
  for (const file of ['a.ts', 'b.ts', 'c.ts', 'big.ts', 'missing.ts', 'missing.ts']) {
    await read($, file)
    await clock.advance(500)
  }
  await $.turn.complete({ ...done, turnId: 't1' })
  await measure($, 80_000)
  await measure($, 20_000)
  expect(played).toEqual([])
})

test('never while you type', async ($, on) => {
  const { clock, played } = world(on, { soundHeard: true })

  await run($, 'sound on')
  await type($, 'h')
  await settle()
  await clock.advance(1000)
  await asks($)
  expect(played).toEqual([])
})
