import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import { isEmpty, lanes } from './lanes'
import { finishCurrent, updatePlan } from './plan'
import {
  clearWaiting, endRun, labelOf, markWaiting, runOf, startRun,
} from './runs'
import { drawBoard, drawEmpty } from './view'
import type { Board } from '../types'

const PANE = 'task-board'
const PLAN_TOOL = 'mcp__ccd_turn__update_plan'
const WRAP_TOOL = 'mcp__ccd_turn__wrap_up'
const TITLE = 'Board'
const WIDE_COLUMNS = 70
const BOARD_TOOLS = new Set([PLAN_TOOL, WRAP_TOOL, 'TodoWrite'])

const EMPTY: Board = { steps: [], runs: [], agentsDone: [] }

const board = atom({ plugin: 'task-board', key: 'board' } as const, EMPTY, {
  shape: 'board-2',
})

const isError = (result: ToolCallResult): boolean =>
  'isError' in result && result.isError === true

const recordBoardTool = async (
  $: EngineInterface,
  tool: string,
  input: Record<string, unknown>,
) => {
  const now = await $.clock.now()
  if (tool === PLAN_TOOL) {
    await update($, board, b => updatePlan(b, input, now))
  }
  if (tool === WRAP_TOOL) await update($, board, b => finishCurrent(b, now))
  if (tool === 'TodoWrite') {
    const todos = { items: input.todos, scope: 'continuation' }
    await update($, board, b => updatePlan(b, todos, now))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'board',
      description: 'Show the task board: doing, queued and done',
    })
    if (e.surface === 'desktop') void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'board' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Task board opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    await recordBoardTool($, e.tool, input)
    const id = e.tool_use_id
    const isTracked =
      id !== undefined && e.agentId === undefined && !BOARD_TOOLS.has(e.tool)
    if (!isTracked) return next(e)
    const run = runOf(id, e.tool, input, await $.clock.now())
    await update($, board, b => startRun(b, run))
    let failed = true
    try {
      const result = await next(e)
      failed = isError(result)
      return result
    } finally {
      const now = await $.clock.now()
      await update($, board, b => endRun(b, { id, isError: failed, now }))
    }
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    const id = e.tool_use_id
    const isAsked = verdict.decision === 'ask' && e.approver === 'person'
    const isMine = id !== undefined && e.agentId === undefined
    if (!isAsked || !isMine) return verdict
    const label = labelOf(e.tool, e.input)
    const startedAt = await $.clock.now()
    const waiting = { id, label, startedAt, isWaiting: true }
    await update($, board, b => markWaiting(b, waiting))
    return verdict
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await update($, board, clearWaiting)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const isWide = e.props.bodyColumns >= WIDE_COLUMNS
    const isFine = e.surface !== 'terminal'
    const now = await $.clock.now()
    const current = await read($, board)
    if (isEmpty(current)) return drawEmpty(table)
    const keepDone = isWide ? 3 : 1
    const look = { isWide, isFine }
    return drawBoard(table, lanes(current, now, keepDone), look)
  })
}
