import type { SessionRateLimit } from 'claude-code'

import type { Weekly } from '../types'

const HOUR = 3_600_000
export const MIN_PACE_WINDOW = 10 * 60_000

export type Projection =
  | { kind: 'measuring' }
  | { kind: 'runs-out'; inMs: number }
  | { kind: 'at-reset'; percent: number }

export const record = (
  prior: Weekly | null,
  limit: SessionRateLimit,
  now: number,
): Weekly => {
  const reading = { percent: limit.percentUsed, at: now }
  const resetsAt = limit.resetsAt ? Date.parse(limit.resetsAt) : undefined
  const isNewWindow =
    prior === null ||
    prior.resetsAt !== resetsAt ||
    reading.percent < prior.first.percent
  const first = isNewWindow ? reading : prior.first
  return { first, last: reading, resetsAt }
}

export const pace = (w: Weekly): number | undefined => {
  const elapsed = w.last.at - w.first.at
  if (elapsed < MIN_PACE_WINDOW) return undefined
  return (w.last.percent - w.first.percent) / elapsed
}

export const projectPace = (
  w: Weekly,
  perMs: number | undefined,
  now: number,
): Projection => {
  if (perMs === undefined) return { kind: 'measuring' }
  const untilFull = perMs > 0 ? (100 - w.last.percent) / perMs : Infinity
  const untilReset = (w.resetsAt ?? Infinity) - now
  if (untilFull <= untilReset) return { kind: 'runs-out', inMs: untilFull }
  return { kind: 'at-reset', percent: w.last.percent + perMs * untilReset }
}

export const project = (w: Weekly, now: number): Projection =>
  projectPace(w, pace(w), now)

export const levelFromPace = (p: Projection): number => {
  if (p.kind === 'measuring') return 1
  if (p.kind === 'runs-out') return p.inMs <= 24 * HOUR ? 5 : 4
  if (p.percent >= 85) return 3
  return p.percent >= 60 ? 2 : 1
}

export const levelFromUsed = (percent: number): number => {
  if (percent >= 95) return 5
  if (percent >= 85) return 4
  if (percent >= 70) return 3
  return percent >= 50 ? 2 : 1
}

export const level = (w: Weekly, now: number): number =>
  Math.max(levelFromPace(project(w, now)), levelFromUsed(w.last.percent))

export const duration = (ms: number): string => {
  const hours = Math.round(ms / HOUR)
  if (hours < 1) return '<1h'
  const days = Math.floor(hours / 24)
  const rest = hours % 24
  if (days === 0) return `${rest}h`
  return rest === 0 ? `${days}d` : `${days}d ${rest}h`
}

export const timeLeft = (p: Projection): string | undefined =>
  p.kind === 'runs-out' ? duration(p.inMs) : undefined
