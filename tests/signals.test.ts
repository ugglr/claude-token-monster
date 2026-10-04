import { expect, mock, test } from 'claude-code/testing'

import { choke, createScene, fedUp, lively, paint, step, wait } from '../hooks/paint'
import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { call, done, hold, holding, ids, pane, text } from './harness'

// The four signals: it calls you, its cache goes cold, it chokes, it is fed up.

// What the engine answers the model when the person refuses a call at its dialog.
const REFUSAL = "The user doesn't want to proceed with this tool use. The tool use was rejected."

// Whether missing.ts turned up.
let found = false

const engine = (on: On) => {
  on('turn.step', async function* (_: unknown, e: { turnId: string }) {
    if (delay > 0) await clock.advance(delay)
    yield { kind: 'stop', stopReason: 'end_turn', usage: { ...usage, model: 'm' } }

    return { turnId: e.turnId, index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: { ...usage, model: 'm' } }
  } as never)
  on('classic.PermissionRequest', () => ({}))
  on('classic.SessionStart', () => ({}))
  on('agent.spawn', () => ({ model: 'm' }) as never)
  on('ui.render', { component: 'ToolProgress' }, () => ({ type: 'Text', props: {}, children: [''] }) as never)
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('ui.blit', () => ({ value: {} }))
  on('agent.list', () => ({ value: [] }) as never)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  // huge.json is 25k tokens; missing.ts fails until it is `found`; the person refuses
  // a `refused` command, a deny rule a `ruled` one, and a hook a `blocked` one.
  on('tool.call', async (_, e) => {
    const args = e as unknown as Record<string, unknown>

    await holding(e)

    if (String(args.command).startsWith('blocked')) return { deny: 'a hook said no' } as never
    if (String(args.command).startsWith('ruled')) return { result: {}, text: 'Permission to use Bash with command ruled out has been denied.', isError: true } as never
    if (String(args.command).startsWith('refused')) return { result: {}, text: `${REFUSAL} STOP what you are doing.`, isError: true } as never

    return { result: {}, text: 'x'.repeat(String(args.file_path).endsWith('huge.json') ? 100_000 : 400), isError: args.file_path === 'missing.ts' && !found } as never
  })

  clock = mock.clock(on)

  return clock
}

let clock: ReturnType<typeof mock.clock>

const fed = { percent: 30, fill: 30, tokens: 1, window: 1, ate: 0, fedAt: 0, burpAt: null, known: true, compactAt: null }

test('the first sign an approved call runs ends the wait, long before it finishes', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')
  const build = await hold($, { tool: 'Bash', command: 'npm run build' })

  // A long command draws its run-in-background hint once it runs.
  await $.ui.mount({
    plugin: 'token-monster',
    surface: 'terminal',
    component: 'ToolProgress',
    requestId: ids.get('npm run build')!,
    props: { tool_use_id: ids.get('npm run build')!, kind: 'background_hint', hint: '(ctrl+b to run in background)' },
  } as never)
  await clock.advance(1)
  expect(await ui.find(text(/waiting/))).toBeUndefined()

  // An approved subagent is spawned.
  const helper = await hold($, { tool: 'Agent', description: 'help', prompt: 'help me', subagent_type: 'general-purpose' })

  expect(await ui.find(text('> waiting for you: Agent help'))).toBeDefined()
  await $.agent.spawn({ tool_use_id: ids.get('Agent')!, prompt: 'help me', description: 'help', subagentType: 'general-purpose' } as never)
  expect(await ui.find(text(/waiting/))).toBeUndefined()

  await build()
  await helper()
})

test('waits go by call, not label; with more than one waiting the readout counts them', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')
  // Two calls with the same label; only the first is asked about.
  const first = await hold($, { tool: 'Bash', command: 'npm run a', description: 'build' })
  const second = await hold($, { tool: 'Bash', command: 'npm run b', description: 'build' }, false)

  await second()
  expect(await ui.find(text('> waiting for you: Bash build'))).toBeDefined()

  const later = await hold($, { tool: 'Read', file_path: 'b.ts' })

  expect(await ui.find(text('> waiting for you: 2 calls'))).toBeDefined()
  await later()
  expect(await ui.find(text('> waiting for you: Bash build'))).toBeDefined()

  await first()
  expect(await ui.find(text(/waiting/))).toBeUndefined()
})

test('a question is a wait for its whole run', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')
  const question = await hold($, { tool: 'AskUserQuestion', questions: [{ question: 'Which?' }] }, false)

  expect(await ui.find(text('> waiting for you: AskUserQuestion'))).toBeDefined()
  await question()
  expect(await ui.find(text(/waiting/))).toBeUndefined()
})

test("a subagent's dialog outlasts the main turn and a prompt, and ends with its own call", async ($, on) => {
  engine(on)
  on('prompt.submit', (_, e) => ({ text: e.text }) as never)
  const ui = await pane($, 'desktop')

  await $.turn.start({ text: 'go', turnId: 't1' })
  const helper = await hold($, { tool: 'Bash', command: 'npm test', agentId: 'a1' })

  await $.turn.complete({ ...done, turnId: 't1' })
  await $.prompt.submit({ text: 'meanwhile' } as never)
  expect(await ui.find(text('> waiting for you: Bash npm test'))).toBeDefined()

  await helper()
  expect(await ui.find(text(/waiting/))).toBeUndefined()
})

test('a few seconds into a wait, it paints at the idle rate', () => {
  const s = createScene({ monster: 'cookie', color: 'blue' })

  s.belly = fed
  for (let i = 0; i < 40; i++) step(s, 46, 40)
  wait(s, true)
  step(s, 46, 40)
  expect(lively(s)).toBe(true)
  for (let i = 0; i < 40; i++) step(s, 46, 40)
  expect(lively(s)).toBe(false)
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

// What the next response reports: its prompt, read from the cache or not, and how
// long it takes to come back, in ms.
let delay = 0
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

test('the bowl shows the moment the cache lapses, counted from when the request was sent', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  // The answer takes a minute to come back: the cache lapses five minutes after the send.
  delay = 60_000
  await respond($, 100_000, 17_000)
  delay = 0
  await clock.advance(4 * 60_000 - 1000)
  expect(await ui.find(text(/cold cache/))).toBeUndefined()

  // No measurement in between: its own timer wakes the readout.
  await clock.advance(2000)
  expect(await ui.find(text(/cold cache/))).toBeDefined()
})

test('/clear and /compact leave nothing cached to go cold', async ($, on) => {
  engine(on)
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [] }] }))
  const ui = await pane($, 'desktop')

  await respond($, 100_000, 17_000)
  await clock.advance(6 * 60_000)
  expect(await ui.find(text(/cold cache/))).toBeDefined()
  await $.classic.SessionStart({ source: 'clear' } as never)
  expect(await ui.find(text(/cold cache/))).toBeUndefined()

  await respond($, 100_000, 17_000)
  await clock.advance(6 * 60_000)
  expect(await ui.find(text(/cold cache/))).toBeDefined()
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'long story', toolUses: [] }] })
  expect(await ui.find(text(/cold cache/))).toBeUndefined()
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

test('a huge tool result makes it gag, naming the call and pointing at the diet', async ($, on) => {
  const clock = engine(on)
  const ui = await pane($, 'desktop')

  await call($, { tool: 'Read', file_path: 'notes.md' })
  expect(await ui.find(text(/gag/))).toBeUndefined()

  await call($, { tool: 'Read', file_path: 'huge.json' })
  expect(await ui.find(text('*gag* Read huge.json ~25k! d: diet'))).toBeDefined()

  await clock.advance(5000)
  expect(await ui.find(text(/gag/))).toBeUndefined()

  // A subagent's huge result too, with no diet to point at: it lists the main conversation only.
  await call($, { tool: 'Read', file_path: 'huge.json', agentId: 'a1' })
  expect(await ui.find(text('*gag* Read huge.json ~25k!'))).toBeDefined()
  expect(await ui.find(text(/d: diet/))).toBeUndefined()
})

test('gagging, it turns green and coughs, then gets over it', () => {
  const s = createScene({ monster: 'cookie', color: 'blue' })

  s.belly = fed
  for (let i = 0; i < 20; i++) step(s, 46, 40)
  const before = paint(s, 46, 40)

  choke(s)
  for (let i = 0; i < 4; i++) step(s, 46, 40)
  expect(s.bits.some(bit => bit.kind === 'puff')).toBe(true)
  // Its body in colors it never wore before: green-tinged.
  expect(paint(s, 46, 40).filter(color => !before.includes(color)).length).toBeGreaterThan(50)

  for (let i = 0; i < 40; i++) step(s, 46, 40)
  expect(s.bits.some(bit => bit.kind === 'puff')).toBe(false)
})

test('the same call failing twice in a row makes it fed up for a moment', async ($, on) => {
  const clock = engine(on)
  const ui = await pane($, 'desktop')

  // Two different calls failing, or one failing with a success between, is no loop.
  await call($, { tool: 'Read', file_path: 'missing.ts' })
  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  found = true
  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  found = false
  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  expect(await ui.find(text(/failed again/))).toBeUndefined()

  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  expect(await ui.find(text('ugh. Bash missing.ts failed again'))).toBeDefined()

  await clock.advance(5000)
  expect(await ui.find(text(/failed again/))).toBeUndefined()
})

test('fed up, it crosses its arms under a throbbing anger mark, then lets it go', () => {
  for (const [width, height] of [[46, 40], [64, 44]] as const) {
    const s = createScene({ monster: 'gremlin', color: 'blue' })

    s.belly = fed
    for (let i = 0; i < 20; i++) step(s, width, height)
    expect(paint(s, width, height).includes(0xff3b3b)).toBe(false)

    fedUp(s)
    step(s, width, height)
    expect(paint(s, width, height).includes(0xff3b3b)).toBe(true)
    expect(s.antic).toBeNull()

    for (let i = 0; i < 60; i++) step(s, width, height)
    expect(paint(s, width, height).includes(0xff3b3b)).toBe(false)
  }
})

test('a refusal is no failure: refused twice, it is not fed up', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  for (let i = 0; i < 2; i++) await (await hold($, { tool: 'Bash', command: 'refused rm -rf build' }))()
  expect(await ui.find(text(/failed again/))).toBeUndefined()
})

test('any success between two failures resets it, in its own loop only', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  await call($, { tool: 'Read', file_path: 'a.ts' })
  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  expect(await ui.find(text(/failed again/))).toBeUndefined()

  // A subagent failing the same way is its own loop, and its success is not the main loop's.
  await call($, { tool: 'Bash', file_path: 'missing.ts', agentId: 'a1' })
  expect(await ui.find(text(/failed again/))).toBeUndefined()
  await call($, { tool: 'Read', file_path: 'a.ts', agentId: 'a1' })
  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  expect(await ui.find(text('ugh. Bash missing.ts failed again'))).toBeDefined()
})

test('/clear forgets the last failure', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  await $.classic.SessionStart({ source: 'clear' } as never)
  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  expect(await ui.find(text(/failed again/))).toBeUndefined()
})

test('an approved call failing twice is fed up, whether or not it showed it ran', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  for (let i = 0; i < 2; i++) await (await hold($, { tool: 'Bash', file_path: 'missing.ts' }))()
  expect(await ui.find(text('ugh. Bash missing.ts failed again'))).toBeDefined()
})

test("a hook's refusal neither counts nor clears the last failure", async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  await call($, { tool: 'Bash', command: 'blocked rm -rf /' })
  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  expect(await ui.find(text('ugh. Bash missing.ts failed again'))).toBeDefined()
})

test('a failure is the same call by tool and arguments, not by label', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await call($, { tool: 'Bash', file_path: 'missing.ts', description: 'build', command: 'npm run a' })
  await call($, { tool: 'Bash', file_path: 'missing.ts', description: 'build', command: 'npm run b' })
  expect(await ui.find(text(/failed again/))).toBeUndefined()
})

test('/clear ends every wait', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')
  const pending = await hold($, { tool: 'Bash', command: 'npm test' })

  await $.classic.SessionStart({ source: 'clear' } as never)
  expect(await ui.find(text(/waiting/))).toBeUndefined()
  await pending()
})

test('a response that reads nothing from the cache sets it back to 5 minutes', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await respond($, 100_000, 17_000)
  await clock.advance(7 * 60_000)
  await respond($, 117_000, 0)
  // An hour now; then a miss, a new model say.
  await respond($, 0, 117_000)
  await clock.advance(6 * 60_000)
  expect(await ui.find(text(/cold cache/))).toBeDefined()
})

test('a deny rule is no failure either', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  for (let i = 0; i < 2; i++) await call($, { tool: 'Bash', command: 'ruled out' })
  expect(await ui.find(text(/failed again/))).toBeUndefined()
})

test('an hour cache drops back to 5 minutes when a response reads under half its prompt from it', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')

  await respond($, 100_000, 17_000)
  await clock.advance(7 * 60_000)
  await respond($, 117_000, 0)
  // It lapsed, all but the tools and system prompt it shares with the last.
  await respond($, 40_000, 77_000)
  await clock.advance(6 * 60_000)
  expect(await ui.find(text(/cold cache/))).toBeDefined()
})

test('resuming another conversation starts its waits, failures and cache over', async ($, on) => {
  engine(on)
  const ui = await pane($, 'desktop')
  const pending = await hold($, { tool: 'Bash', command: 'npm test' })

  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  await respond($, 100_000, 17_000)
  await clock.advance(6 * 60_000)
  await $.classic.SessionStart({ source: 'resume' } as never)
  expect(await ui.find(text(/waiting/))).toBeUndefined()
  expect(await ui.find(text(/cold cache/))).toBeUndefined()

  await call($, { tool: 'Bash', file_path: 'missing.ts' })
  expect(await ui.find(text(/failed again/))).toBeUndefined()
  await pending()
})

test('a gag line too long for a narrow readout beside the sprite counts as the two rows it takes', async ($, on) => {
  engine(on)
  await measure($)
  const ui = await pane($, 'terminal', { bodyColumns: 53, bodyRows: 10 })

  expect((await ui.find({ type: 'Raster' }))?.props).toMatchObject({ rows: 6 })
  await call($, { tool: 'Read', file_path: 'src/fixtures/recorded/huge.json' })
  expect((await ui.find({ type: 'Raster' }))?.props).toMatchObject({ rows: 7 })
})
