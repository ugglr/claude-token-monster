import { expect, mock, test } from 'claude-code/testing'

import { createScene, finishTurn, hit, paint, startTurn, step } from '../hooks/paint'
import type { On, SessionContextUsage } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { call, done, pane, run, SURFACES, text } from './harness'

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
      expect((await ui.find({ type: 'Raster' }))?.props).toMatchObject({ key: 'sprite', columns: 46, rows: 22 })
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

  expect((await run($, 'dragon')).text).toBe(
    'Me not know dragon. Monsters: cookie, slime, ghost, gremlin, crab. Colors: blue, cyan, green, yellow, magenta, red, white, amber. Or: diet (or eat), sound on|off.',
  )
  expect((await run($, 'Gremlin GREEN')).text).toBe('Token Monster is hungry.')
  expect(await (await pane($, 'desktop')).find(text(' |  o   o  |'))).toBeDefined()
})

// Tools beneath the monster; with a gate, each call waits on it after saying it arrived.
const tool = (on: On, gate?: Promise<void>, reached?: () => void) => {
  on('agent.list', () => ({ value: [] }) as never)
  on('tool.call', async (_, e) => {
    if (gate !== undefined && (e.tool === 'Agent' || e.tool === 'Bash')) {
      reached?.()
      await gate
    }

    return { result: {}, text: 'x'.repeat(400) } as never
  })
}

const turns = (on: On) => {
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
}

const latch = () => {
  let open = () => {}
  const shut = new Promise<void>(resolve => (open = resolve))

  return { open, shut }
}

test('tool calls chain into a combo in the readout; it lapses after a pause and the turn end clears it', async ($, on) => {
  const clock = engine(on)

  tool(on)
  turns(on)
  const ui = await pane($, 'desktop')

  await $.turn.start({ text: 'go', turnId: 't1' })
  for (let i = 0; i < 3; i++) {
    await call($, { tool: 'Read', file_path: `f${i}.ts` })
    await clock.advance(1000)
  }
  expect(await ui.find(text('> thinking...  on fire x3'))).toBeDefined()

  await clock.advance(5000)
  expect(await ui.find(text(/on fire/))).toBeUndefined()

  await call($, { tool: 'Read', file_path: 'late.ts' })
  expect(await ui.find(text('> thinking...'))).toBeDefined()

  await call($, { tool: 'Read', file_path: 'again.ts' })
  expect(await ui.find(text('> thinking...  on fire x2'))).toBeDefined()

  await $.turn.complete({ ...done, turnId: 't1' })
  expect(await ui.find(text(/on fire/))).toBeUndefined()
})

test('a turn that landed a combo ends in a K.O., however long the answer took', () => {
  const s = createScene({ monster: 'cookie', color: 'blue' })

  startTurn(s)
  hit(s, false, 0)
  hit(s, false, 1000)
  hit(s, false, 2000)
  s.tick += 600
  finishTurn(s)
  expect(s.finish?.text).toBe('K.O.')

  // A turn whose hits never chain ends in a cheer, not a second K.O.
  s.tick += 50
  startTurn(s)
  hit(s, false, 0)
  hit(s, false, 9000)
  finishTurn(s)
  expect(s.cheerAt).toBe(s.tick)
  expect(s.finish?.at).toBe(600)

  hit(s, true, 20_000)
  expect(s.finish?.text).toBe('COUNTER')
  expect(s.errorAt).toBe(s.tick)
})

test('three tools at once is super mode without a helper', async ($, on) => {
  engine(on)
  const gate = latch()
  let arrived = 0
  const three = latch()

  tool(on, gate.shut, () => {
    arrived += 1
    if (arrived === 3) three.open()
  })
  const ui = await pane($, 'desktop')
  const running = [0, 1, 2].map(i => call($, { tool: 'Bash', command: `echo ${i}` }))

  await three.shut
  expect(await ui.find(text('SUPER MODE! three tools at once'))).toBeDefined()

  gate.open()
  await Promise.all(running)
  expect(await ui.find(text(/SUPER MODE/))).toBeUndefined()
})

test('a belly about to burst outranks super mode', async ($, on) => {
  engine(on)
  const gate = latch()
  const inside = latch()

  tool(on, gate.shut, inside.open)
  const ui = await pane($, 'desktop')

  await measure($, 190_000)
  const running = call($, { tool: 'Agent', description: 'help', prompt: 'help me', subagent_type: 'general-purpose' })

  await inside.shut
  expect(await ui.find(text('me gonna burst! /compact'))).toBeDefined()

  gate.open()
  await running
})

test('a running subagent sends the monster into super mode, and it powers down after', async ($, on) => {
  engine(on)
  const gate = latch()
  const inside = latch()

  tool(on, gate.shut, inside.open)
  const ui = await pane($, 'desktop')
  const running = call($, { tool: 'Agent', description: 'help', prompt: 'help me', subagent_type: 'general-purpose' })

  await inside.shut
  expect(await ui.find(text('SUPER MODE! me and 1 helper'))).toBeDefined()

  gate.open()
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

const usage = (on: On, compactAt: number | undefined) =>
  on('session.usage', (_, e) => ({
    value: {
      startedAt: 0,
      context: {
        window: 200_000,
        ...(e?.breakdown === undefined
          ? {}
          : { breakdown: { isAutoCompactEnabled: compactAt !== undefined, autoCompactThreshold: compactAt } }),
      },
      rateLimits: [],
    },
  }) as never)

test('the burst warning goes by the auto-compact point, not the full window', async ($, on) => {
  engine(on)
  usage(on, 160_000)
  const ui = await pane($, 'desktop')

  await measure($, 150_000)
  expect(await ui.find(text('me gonna burst! /compact'))).toBeDefined()
  expect(await ui.find({ type: 'Box', text: /^belly +█+░+ +75% 150k\/200k$/ })).toBeDefined()

  await measure($, 100_000)
  expect(await ui.find(text('*burp* me feel lighter'))).toBeDefined()
})

test('with auto-compaction off, the warnings go by the full window', async ($, on) => {
  engine(on)
  usage(on, undefined)
  const ui = await pane($, 'desktop')

  await measure($, 150_000)
  expect(await ui.find(text('me so full...'))).toBeDefined()
})

const band = ($: Engine, bodyColumns = 100) =>
  $.ui.mount({
    plugin: 'token-monster',
    surface: 'terminal',
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 10 }, view: {} },
  })

test('without a placed pane, one line above the prompt carries the readout', async ($, on) => {
  engine(on)
  on('ui.panes', () => ({ value: [] }) as never)
  await measure($, 60_000, [{ kind: 'five_hour', percentUsed: 35 }, { kind: 'seven_day', percentUsed: 22 }])

  const ui = await band($)
  const line = (await ui.find({ type: 'Box' }))?.text

  expect(line).toBe('(o)(o) nom nom ██░░░░░░ 30%  session 35%  weekly 22%  /token-monster')

  const narrow = await band($, 44)

  expect((await narrow.find({ type: 'Box' }))?.text).toBe('(o)(o) nom nom ██░░░░░░ 30%  session 35%')
})

test('with the pane placed, the band is left to others', async ($, on) => {
  engine(on)
  on('ui.panes', () => ({ value: [{ id: 'token-monster', title: 'Token Monster', isShown: true, isFocused: false, isPlaced: true }] }) as never)
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['someone else'] }) as never)
  await measure($, 60_000)

  expect(await (await band($)).find({ type: 'Text', text: /nom/ })).toBeUndefined()
})

const fed = (fedAt: number) => ({ percent: 30, fill: 30, tokens: 1, window: 1, ate: 0, fedAt, burpAt: null, known: true, compactAt: null })

test('the moon is up at night', () => {
  for (const hour of [21, 0, 3]) {
    const s = createScene({ monster: 'cookie', color: 'blue' })

    s.hour = hour
    const px = paint(s, 64, 44)

    expect([...px].filter(color => color === 0xf2f0e6).length).toBeGreaterThan(5)
  }
})

test('a fed monster dozes off when nothing happens; a hungry one stays up, sad', () => {
  const dozes = createScene({ monster: 'cookie', color: 'blue' })

  dozes.belly = fed(0)
  for (let i = 0; i < 1900; i++) step(dozes, 64, 44)
  expect(dozes.bits.some(bit => bit.kind === 'z')).toBe(true)

  const hungry = createScene({ monster: 'cookie', color: 'blue' })

  hungry.belly = fed(-20 * 60_000)
  for (let i = 0; i < 1900; i++) step(hungry, 64, 44)
  expect(hungry.bits.some(bit => bit.kind === 'z')).toBe(false)
  expect(hungry.smile).toBeLessThan(-0.5)
})

test('an interrupted turn gets no K.O. and no cheer', () => {
  const s = createScene({ monster: 'cookie', color: 'blue' })

  startTurn(s)
  ;[0, 500, 1000].forEach(at => hit(s, false, at))
  finishTurn(s, true)
  expect(s.finish).toBeNull()
  expect(s.cheerAt).toBe(-100)
})

test('the belly bar is stacked by category, with a legend biggest first and the reserve last', async ($, on) => {
  engine(on)
  on('session.usage', (_, e) => ({
    value: {
      startedAt: 0,
      context: {
        window: 200_000,
        ...(e?.breakdown === undefined
          ? {}
          : {
              breakdown: {
                isAutoCompactEnabled: true,
                autoCompactThreshold: 167_000,
                categories: [
                  { name: 'System prompt', tokens: 10_000, kind: 'used', color: '', isDeferred: false },
                  { name: 'System tools', tokens: 20_000, kind: 'used', color: '', isDeferred: false },
                  { name: 'Messages', tokens: 70_000, kind: 'used', color: '', isDeferred: false },
                  { name: 'MCP tools', tokens: 9_000, kind: 'deferred', color: '', isDeferred: true },
                  { name: 'Free space', tokens: 67_000, kind: 'free', color: '', isDeferred: false },
                  { name: 'Autocompact buffer', tokens: 33_000, kind: 'buffer', color: '', isDeferred: false },
                ],
              },
            }),
      },
      rateLimits: [],
    },
  }) as never)
  const ui = await pane($, 'desktop')

  await measure($, 100_000)

  const belly = await ui.find({ type: 'Box', text: /^belly / })

  expect(belly?.text).toMatch(/^belly +█{10}░+▒{3} +50% 100k\/200k$/)
  expect(belly?.children.filter(child => (child as { type?: string }).type === 'Text').length).toBe(7)
  expect((await ui.find({ type: 'Box', text: /^■ messages/ }))?.text).toBe('■ messages 70k  ■ tools 20k  ■ system 10k  ▒ reserve 33k  ')
})

test('a short pane gives the sprite only what the readout leaves, so the buttons stay on screen', async ($, on) => {
  engine(on)
  await measure($, 60_000, [{ kind: 'five_hour', percentUsed: 60 }, { kind: 'seven_day', percentUsed: 20 }])

  const ui = await pane($, 'terminal', { bodyRows: 24 })

  // say, activity, belly, two limits, the level, the pantry remark, two button rows: 9 lines.
  expect((await ui.find({ type: 'Raster' }))?.props).toMatchObject({ rows: 14 })
  expect(await ui.find({ key: 'sound' })).toBeDefined()
})

test('a subagent starting mid-turn keeps the main turn combo', async ($, on) => {
  const clock = engine(on)

  tool(on)
  turns(on)
  const ui = await pane($, 'desktop')

  await $.turn.start({ text: 'go', turnId: 'main' })
  for (let i = 0; i < 3; i++) {
    await call($, { tool: 'Read', file_path: `f${i}.ts` })
    await clock.advance(1000)
  }
  await $.turn.start({ text: 'help', turnId: 'sub' })
  expect(await ui.find(text(/on fire x3/))).toBeDefined()
})

test('the crab moves in: by name, in amber, with its claws up on desktop', async ($, on) => {
  engine(on)
  mock.store(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))

  expect((await run($, 'crab amber')).text).toBe('Token Monster is hungry.')

  const ui = await pane($, 'desktop')

  expect((await ui.find(text(' (\\/)       (\\/)')))?.props.color).toBe('#ffb000')
})

test("the crab's crown sits up on its eyes, where they cannot cover it", () => {
  const s = createScene({ monster: 'crab', color: 'amber' })

  s.belly = fed(0)
  s.rank = 10
  for (let i = 0; i < 40; i++) step(s, 46, 40)

  // All three of the crown's white points show, none painted over by an eye.
  expect(paint(s, 46, 40).filter(color => color === 0xfff8e8).length).toBe(3)
})

test('the crab paints at every pane size, tiny to large, in its own amber', () => {
  for (const [width, height] of [[16, 12], [40, 40], [64, 44]] as const) {
    const s = createScene({ monster: 'crab', color: 'amber' })

    s.belly = fed(0)
    for (let i = 0; i < 40; i++) step(s, width, height)

    const px = paint(s, width, height)

    expect(px.length).toBe(width * height)
    // Too few pixels at the smallest size for the shell's lit amber to land exactly.
    if (width > 16) expect(px.includes(0xffb000)).toBe(true)
  }
})

test('a wide, short canvas keeps the whole monster in frame', () => {
  for (const [width, height] of [[64, 12], [80, 14]] as const) {
    for (const monster of ['cookie', 'slime', 'ghost', 'gremlin', 'crab']) {
      // The monster is what changes with its color: its top and bottom rows.
      const rows = (color: string) => {
        const s = createScene({ monster, color })

        s.belly = fed(0)
        for (let i = 0; i < 30; i++) step(s, width, height)

        return paint(s, width, height)
      }
      const [blue, red] = [rows('blue'), rows('red')]
      const body = [...blue.keys()].filter(i => blue[i] !== red[i]).map(i => Math.floor(i / width))

      expect(body.length).toBeGreaterThan(0)
      expect(Math.min(...body)).toBeGreaterThan(0)
      expect(Math.max(...body)).toBeLessThan(height - 1)
    }
  }
})

test('a wide, short pane puts the sprite beside the readout; tall or narrow, it stacks', async ($, on) => {
  engine(on)
  await measure($, 60_000, [{ kind: 'five_hour', percentUsed: 60 }, { kind: 'seven_day', percentUsed: 20 }])

  // Tall enough: the sprite on top, 64 columns wide.
  const tall = await pane($, 'terminal', { bodyColumns: 71, bodyRows: 40 })

  expect((await tall.find({ type: 'Raster' }))?.props).toMatchObject({ columns: 64, rows: 22 })
  await tall.unmount()

  // Too short for 10 sprite rows: beside the 9 line readout, as tall as it, twice as wide.
  const short = await pane($, 'terminal', { bodyColumns: 71, bodyRows: 16 })

  expect((await short.find({ type: 'Raster' }))?.props).toMatchObject({ columns: 18, rows: 9 })
  expect(await short.find({ key: 'sound' })).toBeDefined()
  await short.unmount()

  // Too narrow for both side by side: stacked, as it was.
  const narrow = await pane($, 'terminal', { bodyColumns: 46, bodyRows: 16 })

  expect((await narrow.find({ type: 'Raster' }))?.props).toMatchObject({ columns: 46, rows: 6 })
})

test('mid-resize, a pane with almost no rows still mounts a sprite the engine accepts', async ($, on) => {
  engine(on)
  await measure($, 60_000, [{ kind: 'five_hour', percentUsed: 60 }, { kind: 'seven_day', percentUsed: 20 }])

  // The engine refuses a Raster under 1 column or row, and draws its own pane instead.
  for (const bodyRows of [0, 1, 2]) {
    const ui = await pane($, 'terminal', { bodyColumns: 71, bodyRows })
    const { columns, rows } = (await ui.find({ type: 'Raster' }))!.props as { columns: number; rows: number }

    expect(Number.isInteger(columns) && columns >= 1 && Number.isInteger(rows) && rows >= 1).toBe(true)
    await ui.unmount()
  }
})
