import { compact } from './format'
import type { TurnStats } from '../types'

const MISS_WRITE = 50_000
const BIG_CONTEXT = 150_000
const FAN_OUT = 3
const LONG_OUTPUT = 20_000

export type CauseInput = {
  last: TurnStats | null
  context: number | null
  isRunningOut: boolean
}

export const cause = ({ last, context, isRunningOut }: CauseInput) => {
  if (last && last.mainCacheWrite >= MISS_WRITE) {
    return `cache miss, ${compact(last.mainCacheWrite)} re-written`
  }
  if (context !== null && context >= BIG_CONTEXT) {
    return `big conversation, ${compact(context)} re-read each turn`
  }
  if (last && last.agents.length >= FAN_OUT) {
    return `subagents, ${last.agents.length} ran last turn`
  }
  if (last?.model?.includes('fable')) return 'Fable model, priciest tier'
  if (last && last.output >= LONG_OUTPUT) {
    return `long output or thinking, ${compact(last.output)}`
  }
  return isRunningOut ? 'weekly % rising fast, check other sessions' : undefined
}
