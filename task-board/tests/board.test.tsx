import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const PANE = {
  plugin: 'task-board',
  component: 'Pane',
  requestId: 'task-board',
  props: {
    title: 'Board',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const T0 = 1_700_000_000_000
const PLAN = 'mcp__ccd_turn__update_plan' as const

const TONES: Record<string, string> = {
  '#9f9f9f': 'queued',
  '#378add': 'doing',
  '#7f77dd': 'agent',
  '#ef9f27': 'waiting',
  '#e24b4a': 'failed',
  '#44cc11': 'done',
}

type $ = Parameters<TestBody>[0]
type Drawn = { type: string; props: Record<string, unknown>; children: unknown[] }

const held = new Map<string, Promise<void>>()

const hold = (id: string) => {
  let release = () => {}
  held.set(id, new Promise<void>(done => { release = done }))
  return release
}

const engine = (on: On) => {
  on('tool.call', async (_, e) => {
    await held.get(e.tool_use_id ?? '')
    if (e.tool === 'Bash' && String(e.command).startsWith('false')) {
      return { result: {}, text: 'exit 1', isError: true }
    }
    return { result: {} }
  })
  on('tool.check', (_, e) => ({
    decision: e.tool === 'Edit' ? 'ask' : 'allow',
  }))
  return mock.clock(on, { now: T0 })
}

type CallInput = Parameters<$['tool']['call']>[0]

const plan = (input: Record<string, unknown>) =>
  ({ ...input, tool: PLAN, tool_use_id: `plan-${Math.random()}` }) as CallInput

const STEPS = [
  { content: 'Write the test', status: 'completed' },
  { content: 'Make it pass', status: 'in_progress' },
  { content: 'Reinstall', status: 'pending' },
] as const

const textOf = (part: unknown): string => {
  const drawn = part as Drawn | string
  if (typeof drawn === 'string') return drawn
  return (drawn?.children ?? []).map(textOf).join('')
}

const cardOf = (box: { children: unknown[] }) => {
  const [bar, body] = box.children as Drawn[]
  const lines = ((body?.children ?? []) as Drawn[]).map(textOf)
  const tone = TONES[String(bar?.props.color).toLowerCase()] ?? '?'
  return [tone, ...lines].join(' | ')
}

const readSurface = async (
  $: $,
  surface: 'terminal' | 'desktop',
  bodyColumns = 40,
) => {
  const ui = await $.ui.mount({
    ...PANE, surface, props: { ...PANE.props, bodyColumns },
  })
  const boxes = await ui.findAll({ type: 'Box' })
  await ui.unmount()
  const lane = (name: string) => [
    ...boxes.filter(b => b.key?.startsWith(`card:${name}:`)).map(cardOf),
    ...boxes.filter(b => b.key === `more:${name}`).map(b => b.text.trim()),
  ]
  return {
    layout: boxes.find(b => b.key === 'columns') ? 'columns' : 'stack',
    order: boxes.filter(b => b.key?.startsWith('lane:')).map(b => b.key?.slice(5)),
    doing: lane('doing'),
    queued: lane('queued'),
    done: lane('done'),
    footer: boxes.find(b => b.key === 'footer')?.text.trim(),
  }
}

const readBoard = async ($: $, bodyColumns = 40) => {
  const terminal = await readSurface($, 'terminal', bodyColumns)
  const desktop = await readSurface($, 'desktop', bodyColumns)
  expect(terminal).toEqual(desktop)
  return desktop
}

test('a plan is sorted into its three lanes', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))

  expect(await readBoard($)).toEqual({
    layout: 'stack',
    order: ['doing', 'queued', 'done'],
    doing: ['doing | Make it pass'],
    queued: ['queued | Reinstall'],
    done: ['done | Write the test'],
    footer: '1 of 3 steps · 0s',
  })
})

test('advancing finishes the current step and starts the next', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))
  await $.tool.call(plan({ advance: true }))

  const board = await readBoard($, 80)
  expect(board.doing).toEqual(['doing | Reinstall'])
  expect(board.queued).toEqual([])
  expect(board.done).toEqual(['done | Make it pass', 'done | Write the test'])
})

test('steps can be finished and started out of order', async ($, on) => {
  engine(on)
  const items = STEPS.map(s => ({ ...s, status: 'pending' }))
  await $.tool.call(plan({ items, scope: 'first_task' }))
  await $.tool.call(plan({ done: [2], start: 3 }))

  const board = await readBoard($)
  expect(board.doing).toEqual(['doing | Reinstall'])
  expect(board.queued).toEqual(['queued | Write the test'])
  expect(board.done).toEqual(['done | Make it pass'])
})

test('wrapping up checks off the step in progress', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))
  await $.tool.call({ tool: 'mcp__ccd_turn__wrap_up', recap: 'done' })

  const board = await readBoard($)
  expect(board.doing).toEqual([])
  expect(board.footer).toBe('2 of 3 steps · 0s')
})

test('the step in progress shows the tool running under it', async ($, on) => {
  const clock = engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))
  const release = hold('b1')
  const call = $.tool.call({ tool: 'Bash', tool_use_id: 'b1', command: 'yarn test' })
  await clock.advance(12_000)

  expect((await readBoard($)).doing).toEqual(['doing | Make it pass | Bash · 12s'])
  release()
  await call
  expect((await readBoard($)).doing).toEqual(['doing | Make it pass'])
})

test('a running subagent gets its own card, then lands in done', async ($, on) => {
  const clock = engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))
  const release = hold('a1')
  const call = $.tool.call({
    tool: 'Agent', tool_use_id: 'a1', description: 'review tests',
    prompt: 'review', model: 'sonnet',
  })
  await clock.advance(40_000)

  expect((await readBoard($)).doing).toEqual([
    'doing | Make it pass',
    'agent | review tests | subagent · sonnet · 40s',
  ])
  release()
  await call
  expect((await readBoard($, 80)).done).toEqual([
    'agent | review tests | subagent',
    'done | Write the test',
  ])
})

test('a call put to you for approval is flagged as waiting', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))
  const release = hold('e1')
  const call = $.tool.call({
    tool: 'Edit', tool_use_id: 'e1', file_path: '/repo/hooks/view.tsx',
    old_string: 'a', new_string: 'b',
  })
  await $.tool.check({
    tool: 'Edit', input: { file_path: '/repo/hooks/view.tsx' },
    tool_use_id: 'e1', approver: 'person',
  })

  expect((await readBoard($)).doing).toEqual([
    'doing | Make it pass',
    'waiting | Edit view.tsx | waiting for your approval',
  ])
  release()
  await call
  expect((await readBoard($)).doing).toEqual(['doing | Make it pass'])
})

test('a step that hit a failing tool is marked failed when done', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))
  await $.tool.call({ tool: 'Bash', tool_use_id: 'f1', command: 'false' })
  await $.tool.call(plan({ advance: true }))

  expect((await readBoard($)).done[0]).toBe('failed | Make it pass | 1 tool error')
})

test('the footer counts time since the plan began', async ($, on) => {
  const clock = engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))
  await clock.advance(250_000)

  expect((await readBoard($)).footer).toBe('1 of 3 steps · 4m 10s')
})

test("Claude Code's todo list fills the board too", async ($, on) => {
  engine(on)
  await $.tool.call({
    tool: 'TodoWrite',
    tool_use_id: 'td1',
    todos: STEPS.map(s => ({ ...s, activeForm: s.content })),
  })

  const board = await readBoard($)
  expect(board.doing).toEqual(['doing | Make it pass'])
  expect(board.queued).toEqual(['queued | Reinstall'])
})

const MANY = ['one', 'two', 'three', 'four', 'five']
  .map(content => ({ content, status: 'completed' }))

test('a wide pane lays the lanes out as columns', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: STEPS, scope: 'first_task' }))

  const board = await readBoard($, 80)
  expect(board.layout).toBe('columns')
  expect(board.order).toEqual(['queued', 'doing', 'done'])
})

test('done keeps only the latest card on a narrow pane', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: MANY, scope: 'first_task' }))

  expect((await readBoard($)).done).toEqual(['done | five', '+ 4 more'])
})

test('done keeps the latest three on a wide pane', async ($, on) => {
  engine(on)
  await $.tool.call(plan({ items: MANY, scope: 'first_task' }))

  expect((await readBoard($, 80)).done).toEqual([
    'done | five', 'done | four', 'done | three', '+ 2 more',
  ])
})

test('an empty board says how it fills', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const text = (await ui.find({ key: 'empty' }))?.text
  await ui.unmount()

  expect(text).toBe('No plan yet. Steps show up here once Claude writes one.')
})

test('the board opens on desktop and with /board', async ($, on) => {
  const opened: string[] = []
  on('command.register', () => ({ value: { command: 'board' } }))
  on('ui.open', (_, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(opened).toEqual([])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(opened).toEqual(['task-board'])
  const run = { command: 'board' }
  await $.command.run(run as Parameters<$['command']['run']>[0])
  expect(opened).toEqual(['task-board', 'task-board'])
})
