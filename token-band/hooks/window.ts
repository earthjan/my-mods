export const WINDOW_PREFIX = 'window:'

type WindowTokens = { resetsAt: number; tokens: number }

const isWindow = (v: unknown): v is WindowTokens =>
  typeof v === 'object' && v !== null &&
  typeof (v as WindowTokens).resetsAt === 'number' &&
  typeof (v as WindowTokens).tokens === 'number'

export const isCurrent = (v: unknown, resetsAt: number): boolean =>
  isWindow(v) && v.resetsAt === resetsAt

export const addToWindow = (
  prior: unknown,
  resetsAt: number,
  tokens: number,
): WindowTokens => {
  const sofar = isWindow(prior) && isCurrent(prior, resetsAt) ? prior.tokens : 0
  return { resetsAt, tokens: sofar + tokens }
}

export const windowTotal = (
  entries: readonly unknown[],
  resetsAt: number,
): number =>
  entries
    .filter(isWindow)
    .filter(v => v.resetsAt === resetsAt)
    .reduce((sum, v) => sum + v.tokens, 0)
