import type { AgentDone, Board, Run, Step } from '../types'

export type Tone = 'queued' | 'doing' | 'agent' | 'waiting' | 'failed' | 'done'

export type Card = { key: string; title: string; tone: Tone; status?: string }

export type Lanes = {
  doing: Card[]
  queued: Card[]
  done: Card[]
  hiddenDone: number
  footer: string
}

export const elapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(seconds / 60)
  if (minutes === 0) return `${seconds}s`
  const hours = Math.floor(minutes / 60)
  if (hours === 0) return `${minutes}m ${seconds % 60}s`
  return `${hours}h ${minutes % 60}m`
}

const where = (board: Board, status: Step['status']) =>
  board.steps.filter(s => s.status === status)

const doingCards = (board: Board, now: number): Card[] => {
  const latest = board.runs.filter(r => !r.agent && !r.isWaiting).at(-1)
  const status = latest === undefined
    ? undefined
    : `${latest.label} · ${elapsed(now - latest.startedAt)}`
  return where(board, 'in_progress').map(s =>
    status === undefined
      ? { key: s.id, title: s.title, tone: 'doing' }
      : { key: s.id, title: s.title, tone: 'doing', status })
}

const agentCard = (r: Run, now: number): Card => {
  const model = r.agent?.model === undefined ? '' : ` · ${r.agent.model}`
  const status = `subagent${model} · ${elapsed(now - r.startedAt)}`
  return { key: r.id, title: r.agent?.title ?? r.label, tone: 'agent', status }
}

const waitingCard = ([label, count]: [string, number]): Card => ({
  key: `wait-${label}`,
  title: label,
  tone: 'waiting',
  status: `${count > 1 ? `${count} ` : ''}waiting for your approval`,
})

const waitingCards = (board: Board): Card[] => {
  const counts = new Map<string, number>()
  for (const r of board.runs.filter(r => r.isWaiting)) {
    counts.set(r.label, (counts.get(r.label) ?? 0) + 1)
  }
  return [...counts].map(waitingCard)
}

const stepDone = (s: Step): Card => {
  if (s.errors === 0) return { key: s.id, title: s.title, tone: 'done' }
  const plural = s.errors === 1 ? '' : 's'
  const status = `${s.errors} tool error${plural}`
  return { key: s.id, title: s.title, tone: 'failed', status }
}

const agentDone = (a: AgentDone, i: number): Card =>
  ({ key: `agent-${i}`, title: a.title, tone: 'agent', status: 'subagent' })

const doneCards = (board: Board): Card[] => {
  const steps = where(board, 'completed').map((s, i) =>
    ({ card: stepDone(s), at: s.finishedAt ?? 0, i }))
  const agents = board.agentsDone.map((a, i) =>
    ({ card: agentDone(a, i), at: a.finishedAt, i: board.steps.length + i }))
  return [...steps, ...agents]
    .sort((a, b) => b.at - a.at || b.i - a.i)
    .map(({ card }) => card)
}

const footer = (board: Board, now: number): string => {
  const finished = where(board, 'completed').length
  const count = `${finished} of ${board.steps.length} steps`
  if (board.startedAt === undefined) return count
  return `${count} · ${elapsed(now - board.startedAt)}`
}

export const isEmpty = (board: Board): boolean =>
  board.steps.length + board.runs.length + board.agentsDone.length === 0

export const lanes = (board: Board, now: number, keepDone: number): Lanes => {
  const done = doneCards(board)
  return {
    doing: [
      ...doingCards(board, now),
      ...board.runs.filter(r => r.agent).map(r => agentCard(r, now)),
      ...waitingCards(board),
    ],
    queued: where(board, 'pending')
      .map(s => ({ key: s.id, title: s.title, tone: 'queued' })),
    done: done.slice(0, keepDone),
    hiddenDone: Math.max(0, done.length - keepDone),
    footer: footer(board, now),
  }
}
