import type { Board, Status, Step } from '../types'

type Item = { content: string; status: Status }

const isStatus = (v: unknown): v is Status =>
  v === 'pending' || v === 'in_progress' || v === 'completed'

const itemsOf = (v: unknown): Item[] | undefined => {
  if (!Array.isArray(v)) return undefined
  return v.flatMap(item => {
    const { content, status } = (item ?? {}) as Record<string, unknown>
    if (typeof content !== 'string' || !isStatus(status)) return []
    return [{ content, status }]
  })
}

const stepsFrom = (items: Item[], now: number): Step[] =>
  items.map((item, i) => ({
    id: String(i + 1),
    title: item.content,
    status: item.status,
    errors: 0,
    ...(item.status === 'pending' ? {} : { startedAt: now }),
    ...(item.status === 'completed' ? { finishedAt: now } : {}),
  }))

const replacePlan = (
  board: Board,
  input: Record<string, unknown>,
  now: number,
): Board => {
  const items = itemsOf(input.items)
  if (items === undefined) return board
  const isFresh = input.scope !== 'continuation'
  return {
    ...board,
    steps: stepsFrom(items, now),
    agentsDone: isFresh ? [] : board.agentsDone,
    startedAt: isFresh || board.startedAt === undefined ? now : board.startedAt,
  }
}

const finish = (s: Step, now: number): Step =>
  ({ ...s, status: 'completed', finishedAt: now })

const begin = (s: Step, now: number): Step =>
  ({ ...s, status: 'in_progress', startedAt: s.startedAt ?? now })

const numbers = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : []

export const finishCurrent = (board: Board, now: number): Board => ({
  ...board,
  steps: board.steps.map(s =>
    s.status === 'in_progress' ? finish(s, now) : s),
})

const advance = (board: Board, now: number): Board => {
  const finished = finishCurrent(board, now)
  const next = finished.steps.findIndex(s => s.status === 'pending')
  return startAt(finished, next + 1, now)
}

const startAt = (board: Board, n: number, now: number): Board => ({
  ...board,
  steps: board.steps.map((s, i) => (i === n - 1 ? begin(s, now) : s)),
})

const finishAt = (board: Board, done: number[], now: number): Board => ({
  ...board,
  steps: board.steps.map((s, i) =>
    done.includes(i + 1) ? finish(s, now) : s),
})

export const updatePlan = (
  board: Board,
  input: Record<string, unknown>,
  now: number,
): Board => {
  let next = replacePlan(board, input, now)
  next = finishAt(next, numbers(input.done), now)
  if (input.advance === true) next = advance(next, now)
  if (typeof input.start === 'number') next = startAt(next, input.start, now)
  return next
}
