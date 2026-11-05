import type { Board, Run } from '../types'

type Input = Record<string, unknown>

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined

const basename = (path: string): string =>
  path.split('/').filter(Boolean).at(-1) ?? path

export const labelOf = (tool: string, input: unknown): string => {
  const path = text((input as Input | undefined)?.file_path)
  return path === undefined ? tool : `${tool} ${basename(path)}`
}

const agentOf = (tool: string, input: Input): Run['agent'] => {
  if (tool !== 'Agent') return undefined
  const title = text(input.description) ?? 'subagent'
  const model = text(input.model)
  return model === undefined ? { title } : { title, model }
}

export const runOf = (
  id: string,
  tool: string,
  input: Input,
  now: number,
): Run => {
  const agent = agentOf(tool, input)
  const run = { id, label: labelOf(tool, input), startedAt: now }
  return agent === undefined
    ? { ...run, isWaiting: false }
    : { ...run, isWaiting: false, agent }
}

export const startRun = (board: Board, run: Run): Board => {
  const known = board.runs.find(r => r.id === run.id)
  const runs = known === undefined
    ? [...board.runs, run]
    : board.runs.map(r => (r === known ? { ...run, isWaiting: true } : r))
  return { ...board, runs }
}

export const markWaiting = (board: Board, waiting: Run): Board => {
  const known = board.runs.some(r => r.id === waiting.id)
  const runs = known
    ? board.runs.map(r => (r.id === waiting.id ? { ...r, isWaiting: true } : r))
    : [...board.runs, { ...waiting, isWaiting: true }]
  return { ...board, runs }
}

const countError = (board: Board): Board => ({
  ...board,
  steps: board.steps.map(s =>
    s.status === 'in_progress' ? { ...s, errors: s.errors + 1 } : s),
})

export type RunEnd = { id: string; isError: boolean; now: number }

export const endRun = (board: Board, end: RunEnd): Board => {
  const run = board.runs.find(r => r.id === end.id)
  const runs = board.runs.filter(r => r.id !== end.id)
  const agentsDone = run?.agent === undefined
    ? board.agentsDone
    : [...board.agentsDone, { title: run.agent.title, finishedAt: end.now }]
  const ended = { ...board, runs, agentsDone }
  return end.isError ? countError(ended) : ended
}

export const clearWaiting = (board: Board): Board => ({
  ...board,
  runs: board.runs.filter(r => !r.isWaiting),
})
