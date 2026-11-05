import { MIN_PACE_WINDOW } from './weekly'
import type { Spend } from '../types'

export type Peer = { usdPerMs: number; at: number }

export const PEER_PREFIX = 'session:'
const LIVE_MS = 30 * 60_000
const FORGET_MS = 24 * 3_600_000

export const recordSpend = (
  prior: Spend | null,
  usd: number,
  now: number,
): Spend => {
  const reading = { usd, at: now }
  return { first: prior?.first ?? reading, last: reading }
}

export const spendRate = (s: Spend): number | undefined => {
  const elapsed = s.last.at - s.first.at
  if (elapsed < MIN_PACE_WINDOW) return undefined
  return (s.last.usd - s.first.usd) / elapsed
}

const isPeer = (v: unknown): v is Peer =>
  typeof v === 'object' && v !== null &&
  typeof (v as Peer).usdPerMs === 'number' &&
  typeof (v as Peer).at === 'number'

export const isForgotten = (v: unknown, now: number): boolean =>
  !isPeer(v) || now - v.at > FORGET_MS

export const shareOf = (
  mine: number,
  peers: readonly unknown[],
  now: number,
): number => {
  const others = peers
    .filter(isPeer)
    .filter(p => now - p.at <= LIVE_MS)
    .reduce((sum, p) => sum + p.usdPerMs, 0)
  const total = mine + others
  return total > 0 ? mine / total : 0
}
