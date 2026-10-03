import { expect, test } from 'claude-code/testing'

import { stubbed } from '../hooks/register'

const ROWS = [
  { role: 'user' as const, text: 'look around', toolUses: [] },
  {
    role: 'assistant' as const,
    text: '',
    toolUses: [
      { tool_use_id: 'big', tool: 'Read', input: { file_path: 'src/huge.ts' }, text: 'x'.repeat(40_000) },
      { tool_use_id: 'small', tool: 'Bash', input: { command: 'ls' }, text: 'y'.repeat(400) },
    ],
  },
  {
    role: 'user' as const,
    text: '',
    toolUses: [],
    toolResults: [
      { tool_use_id: 'big', text: 'x'.repeat(40_000), isError: false },
      { tool_use_id: 'small', text: 'y'.repeat(400), isError: false },
    ],
    handle: 'h3',
  },
]

test('the diet lists tool results biggest first and picks one', async ($, on) => {
  on('session.messages', () => ({ value: ROWS }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  await $.command.run({ command: 'token-monster', args: 'diet', origin: 'user', presentation: { layout: 'fullscreen', columns: 200 } } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'token-monster',
      surface,
      component: 'Pane',
      requestId: 'token-monster-diet',
      props: { title: 'Diet', isFocused: true, bodyColumns: 48, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    })

    expect((await ui.find({ key: 'dish-0' }))?.text).toMatch(/^\[ \] Read src\/huge.ts +~10.0k$/)
    expect((await ui.find({ key: 'dish-1' }))?.text).toMatch(/^\[ \] Bash ls +~100$/)

    await ui.press({ key: 'dish-0' })
    expect((await ui.find({ key: 'dish-0' }))?.text).toMatch(/^\[x\]/)
    expect((await ui.find({ key: 'eat' }))?.text).toBe('Eat 1 (~10.0k)')
    await ui.press({ key: 'dish-0' })
  }
})

test('eating stubs only the picked results and leaves every other message whole', () => {
  const after = stubbed(ROWS, new Set(['big']))

  expect(after[0]).toBe(ROWS[0])
  expect(after[1]).toBe(ROWS[1])
  expect(after[2]?.handle).toBeUndefined()
  expect(after[2]?.toolResults?.[0]?.text).toBe(
    '[Token Monster ate this Read result (~10.0k tokens) to free context. Run the tool again if you need it.]',
  )
  expect(after[2]?.toolResults?.[1]).toBe(ROWS[2]?.toolResults?.[1])
  expect(stubbed(ROWS, new Set())).toEqual(ROWS)
})
