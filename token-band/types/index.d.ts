export type Reading = { percent: number; at: number }

export type Weekly = {
  first: Reading
  last: Reading
  resetsAt?: number
}

export type Cost = { usd: number; at: number }

export type Spend = { first: Cost; last: Cost }

export type TurnStats = {
  mainCacheWrite: number
  output: number
  agents: string[]
  model?: string
}

declare module 'claude-code' {
  interface PluginState {
    'token-band': {
      tokens: number
      weekly: Weekly | null
      context: number | null
      pending: TurnStats
      last: TurnStats | null
      spend: Spend | null
    }
  }
}
