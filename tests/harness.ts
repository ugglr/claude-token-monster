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

// Calls a test holds in flight, by command, file or tool: whether a permission dialog
// opens for them first, a gate to let them go, and a mark once they are under way.
const held = new Map<string, { isAsked: boolean; gate: Promise<void>; reached: () => void }>()
// Each held call's id, as the engine gave it, by command, file or tool.
export const ids = new Map<string, string>()
// The engine the held calls raise their dialogs on.
let world: Engine

const key = (input: Record<string, unknown>) => String(input.command ?? input.file_path ?? input.tool)

// For the test's own tool.call: a call the test holds opens its dialog, if asked, and
// waits there until let go.
export const holding = async (e: unknown) => {
  const { tool, tool_use_id, agentId, ...args } = e as Record<string, unknown> & { tool: string; tool_use_id: string; agentId?: string }
  const hold = held.get(key({ tool, ...args }))

  if (hold === undefined) return

  ids.set(key({ tool, ...args }), tool_use_id)
  if (hold.isAsked) await world.classic.PermissionRequest({ tool_name: tool, tool_input: args, agent_id: agentId } as never)
  hold.reached()
  await hold.gate
}

// Starts `input` and holds it in flight, a dialog open for it unless `isAsked` is false;
// resolves to a function that lets it go and waits for it to end.
export const hold = async ($: Engine, input: Record<string, unknown>, isAsked = true) => {
  let go = () => {}
  let there = () => {}
  const gate = new Promise<void>(resolve => (go = resolve))
  const reached = new Promise<void>(resolve => (there = resolve))

  world = $
  held.set(key(input), { isAsked, gate, reached: there })

  const running = call($, input)

  await reached

  return async () => {
    go()
    await running
    held.delete(key(input))
  }
}
