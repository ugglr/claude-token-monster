import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { call, done, pane, run } from './harness'

// The world beneath the monster with a speaker in it: every clip asked for is recorded.
const world = (on: On, stored: Record<string, unknown> = {}, isShown = () => true) => {
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
  on('ui.panes', () => ({ value: [{ id: 'token-monster', title: 'Token Monster', isShown: isShown(), isFocused: false, isPlaced: true }] }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.blit', () => ({ value: {} }))
  on('agent.list', () => ({ value: [] }) as never)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('prompt.edit', (_, e) => ({ text: e.text, cursor: e.cursor }))
  on('turn.step', async function* () {
    for (let i = 0; i < pieces; i++) yield { kind: 'text', index: 0, text: 'nom ' }

    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  } as never)
  on('tool.call', async (_, e) => {
    const input = e as unknown as { file_path?: string; tool: string }

    if (input.tool === 'Agent' && gate !== undefined) {
      reached?.()
      await gate
    }

    return {
      result: {},
      text: input.file_path === 'big.ts' ? 'x'.repeat(12_000) : 'x'.repeat(400),
      isError: input.file_path === 'missing.ts',
    } as never
  })

  return { clock: mock.clock(on, { now: 1_000_000 }), played, gains, said, saved }
}

let gate: Promise<void> | undefined
let pieces = 0
let reached: (() => void) | undefined

const read = ($: Engine, file_path: string) => call($, { tool: 'Read', file_path })

const measure = ($: Engine, tokens: number) =>
  $.session.measure({ context: { tokens, window: 200_000, percent: Math.round(tokens / 2000) }, rateLimits: [], changed: ['context'] })

// The model streams `count` pieces of text.
const stream = async ($: Engine, count: number) => {
  pieces = count
  const step = $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })

  for await (const _ of step) {
  }
  await step.result
  await settle()
}

// A chomp in the stream, and the typing mark, start without holding anything up: let them land.
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

test('sound is off by default, and then nothing plays', async ($, on) => {
  const { clock, played } = world(on)
  const ui = await pane($)

  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: off')
  expect((await ui.find({ key: 'sound' }))?.props).toMatchObject({ hotkey: 's', plain: true })

  await $.turn.start({ text: 'go', turnId: 't1' })
  for (const file of ['a.ts', 'b.ts', 'c.ts', 'big.ts', 'missing.ts']) {
    await read($, file)
    await clock.advance(500)
  }
  await stream($, 5)
  await $.turn.complete({ ...done, turnId: 't1' })
  await measure($, 50_000)
  await measure($, 20_000)

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
  expect(played).toEqual(['sounds/hello.wav'])

  await ui.press({ key: 'sound' })
  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: off')
  expect(saved).toContainEqual({ sound: false })

  await ui.press({ key: 'sound' })
  expect(said).toHaveLength(1)
})

test('/token-monster sound on|off sets it, and a bare sound toggles', async ($, on) => {
  const { saved } = world(on)
  const ui = await pane($)

  expect((await run($, 'sound on')).text).toBe('Sound on. Me make noise now (macOS).')
  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: on')
  expect((await run($, 'Sound OFF')).text).toBe('Sound off. Me eat quietly.')
  expect((await ui.find({ key: 'sound' }))?.text).toBe('Sound: off')
  expect((await run($, 'sound')).text).toBe('Sound on. Me make noise now (macOS).')
  expect((await run($, 'sound loud')).text).toBe('Usage: /token-monster sound on|off')
  expect(saved.filter(entry => 'sound' in entry)).toEqual([{ sound: true }, { sound: false }, { sound: true }])
})

test('a stored choice comes back with the session, and the monster says hello', async ($, on) => {
  const { played, said } = world(on, { sound: true, soundHeard: true })

  await start($, on)
  expect((await (await pane($)).find({ key: 'sound' }))?.text).toBe('Sound: on')
  expect(played).toEqual(['sounds/hello.wav'])
  expect(said).toEqual([])
})

test('with sound on, each moment plays its own clip, quietly', async ($, on) => {
  const { clock, played, gains } = world(on, { soundHeard: true })

  await run($, 'sound on')
  played.length = 0

  // A chain of three climbs in pitch and the turn ends in a K.O.
  await $.turn.start({ text: 'go', turnId: 't1' })
  await read($, 'a.ts')
  await clock.advance(1000)
  await read($, 'b.ts')
  await clock.advance(1000)
  await read($, 'c.ts')
  await $.turn.complete({ ...done, turnId: 't1' })
  expect(played.splice(0)).toEqual([
    expect.stringMatching(/^sounds\/chomp-[123]\.wav$/),
    'sounds/combo-1.wav',
    'sounds/combo-2.wav',
    'sounds/ko.wav',
  ])

  // An interrupted turn plays neither a K.O. nor a cheer, whatever its chain.
  await clock.advance(10_000)
  await $.turn.start({ text: 'go', turnId: 'tx' })
  await read($, 'a.ts')
  await clock.advance(1000)
  await read($, 'b.ts')
  await clock.advance(1000)
  await read($, 'c.ts')
  played.length = 0
  await $.turn.complete({ ...done, turnId: 'tx', isAborted: true, reason: 'aborted' })
  expect(played.splice(0)).toEqual([])

  // A big result is gulped, a failed call buzzes, a plain turn ends in a cheer.
  await clock.advance(10_000)
  await $.turn.start({ text: 'go', turnId: 't2' })
  await read($, 'big.ts')
  await clock.advance(10_000)
  await read($, 'missing.ts')
  await clock.advance(10_000)
  await $.turn.complete({ ...done, turnId: 't2' })
  expect(played.splice(0)).toEqual(['sounds/gulp.wav', 'sounds/error.wav', 'sounds/cheer.wav'])

  // The context shrinking is a burp.
  await measure($, 80_000)
  await measure($, 20_000)
  expect(played.splice(0)).toEqual(['sounds/burp.wav'])

  expect(gains.every(gain => gain > 0 && gain <= 0.35)).toBe(true)
})

test('super mode powers up with a helper and down after it', async ($, on) => {
  const { played } = world(on, { soundHeard: true })
  let open = () => {}

  gate = new Promise<void>(resolve => (open = resolve))
  const inside = new Promise<void>(resolve => (reached = resolve))

  await run($, 'sound on')
  played.length = 0

  const helping = call($, { tool: 'Agent', description: 'help', prompt: 'help me', subagent_type: 'general-purpose' })

  await inside
  expect(played).toEqual(['sounds/power-up.wav'])

  open()
  await helping
  gate = undefined
  expect(played.slice(1, 2)).toEqual(['sounds/power-down.wav'])
})

// Snoring follows the sprite's own sleep rule, counted in animation frames (unit-tested
// in monster.test.ts); here, with no frames drawn, only the hunger side shows.
test('a hungry monster whimpers once, not again while it stays hungry', async ($, on) => {
  const { clock, played } = world(on, { soundHeard: true })

  await run($, 'sound on')
  await measure($, 20_000)
  played.length = 0

  await clock.advance(16 * 60_000)
  await measure($, 20_000)
  expect(played.splice(0)).toEqual(['sounds/whimper.wav'])

  await clock.advance(30 * 60_000)
  await measure($, 20_000)
  expect(played.splice(0)).toEqual([])
})

test('chomps come at most about three a second, only with the pane showing, never while typing', async ($, on) => {
  let isShown = true
  const { clock, played } = world(on, { soundHeard: true }, () => isShown)

  await run($, 'sound on')
  played.length = 0

  await stream($, 12)
  expect(played.splice(0)).toEqual([expect.stringMatching(/chomp/)])

  await clock.advance(200)
  await stream($, 12)
  expect(played.splice(0)).toEqual([])

  await clock.advance(200)
  await stream($, 12)
  expect(played.splice(0)).toEqual([expect.stringMatching(/chomp/)])

  // Typing: not a sound, a cheer included, until the person has paused.
  await type($, 'h')
  await settle()
  await clock.advance(1000)
  await stream($, 12)
  await $.turn.complete({ ...done, turnId: 't1' })
  expect(played.splice(0)).toEqual([])

  await clock.advance(1500)
  await $.turn.complete({ ...done, turnId: 't1' })
  expect(played.splice(0)).toEqual(['sounds/cheer.wav'])

  // A hidden pane: no chomps, but the moments still sound.
  isShown = false
  await clock.advance(1000)
  await stream($, 12)
  await $.turn.complete({ ...done, turnId: 't1' })
  expect(played.splice(0)).toEqual(['sounds/cheer.wav'])
})
