import type { Engine } from 'claude-code/testing'

// What every test file needs to drive the monster: its pane, the command, a tool call.

export const SURFACES = ['terminal', 'desktop'] as const

// The monster's pane as a surface draws it, docked and holding the keyboard.
export const pane = ($: Engine, surface: (typeof SURFACES)[number] = 'desktop', { bodyColumns = 46, bodyRows = 40 } = {}) =>
  $.ui.mount({
    plugin: 'token-monster',
    surface,
    component: 'Pane',
    requestId: 'token-monster',
    props: { title: 'Token Monster', isFocused: true, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows }, view: {} },
  })

export const text = (value: string | RegExp) => ({ type: 'Text', text: value })

// `/token-monster <args>`, as typed.
export const run = ($: Engine, args: string) =>
  $.command.run({ command: 'token-monster', args, origin: 'user', presentation: { layout: 'fullscreen', columns: 200 } } as never)

// $.tool.call's overloads are too deep for tsc over a loose argument; one plain signature.
type Caller = { call: (input: Record<string, unknown>) => Promise<unknown> }

export const call = ($: Engine, input: Record<string, unknown>) => ($.tool as unknown as Caller).call(input)

// A main turn that finished normally.
export const done = { answer: '', durationMs: 1, isAborted: false, reason: 'answer' as const }
