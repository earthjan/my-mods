import { atom, read, update } from 'claude-code'
import type {
  EngineInterface,
  Register,
  SessionCost,
  SessionRateLimit,
  TurnCompleteInput,
  TurnUsage,
} from 'claude-code'

import { LEVEL_COLORS, MISSING_COLOR, SESSION_COLOR } from './badge'
import type { Badge, Segment } from './badge'
import { stageFor } from './bonsai'
import { cause } from './cause'
import { STAGE_NAMES, bonsaiSvg, skyFor } from './drawing'
import type { Sky } from './drawing'
import { compact } from './format'
import {
  PEER_PREFIX,
  isForgotten,
  recordSpend,
  shareOf,
  spendRate,
} from './mine'
import { drawBand } from './view'
import { WINDOW_PREFIX, addToWindow, isCurrent, windowTotal } from './window'
import {
  level,
  levelFromPace,
  levelFromUsed,
  pace,
  project,
  projectPace,
  record,
  timeLeft,
} from './weekly'
import type { Spend, TurnStats, Weekly } from '../types'

const EMPTY: TurnStats = { mainCacheWrite: 0, output: 0, agents: [] }

const tokens = atom({ plugin: 'token-band', key: 'tokens' } as const, 0)
const weekly = atom(
  { plugin: 'token-band', key: 'weekly' } as const,
  null as Weekly | null,
)
const context = atom(
  { plugin: 'token-band', key: 'context' } as const,
  null as number | null,
)
const pending = atom({ plugin: 'token-band', key: 'pending' } as const, EMPTY)
const last = atom(
  { plugin: 'token-band', key: 'last' } as const,
  null as TurnStats | null,
)
const spend = atom(
  { plugin: 'token-band', key: 'spend' } as const,
  null as Spend | null,
)

const turnTokens = (u: TurnUsage): number =>
  u.input_tokens +
  u.output_tokens +
  u.cache_read_input_tokens +
  u.cache_creation_input_tokens

const recordWeekly = async (
  $: EngineInterface,
  limits: readonly SessionRateLimit[],
) => {
  const limit = limits.find(l => l.kind === 'seven_day')
  if (!limit) return
  const now = await $.clock.now()
  await update($, weekly, prior => record(prior, limit, now))
}

const peerKeys = async ($: EngineInterface, id: string) => {
  const keys = await $.store.keys()
  return keys.filter(k => k.startsWith(PEER_PREFIX) && k !== PEER_PREFIX + id)
}

const readPeers = async ($: EngineInterface) => {
  const keys = await peerKeys($, await $.session.id())
  return Promise.all(keys.map(k => $.store.get(k)))
}

const publish = async ($: EngineInterface, usdPerMs: number, now: number) => {
  const id = await $.session.id()
  await $.store.set(PEER_PREFIX + id, { usdPerMs, at: now })
  for (const key of await peerKeys($, id)) {
    if (isForgotten(await $.store.get(key), now)) await $.store.delete(key)
  }
}

const recordCost = async ($: EngineInterface, cost?: SessionCost) => {
  if (cost === undefined) return
  const now = await $.clock.now()
  await update($, spend, prior => recordSpend(prior, cost.usd, now))
  const spent = await read($, spend)
  const rate = spent === null ? undefined : spendRate(spent)
  if (rate !== undefined) await publish($, rate, now)
}

const windowKeys = async ($: EngineInterface) =>
  (await $.store.keys()).filter(k => k.startsWith(WINDOW_PREFIX))

const addWindowTokens = async ($: EngineInterface, count: number) => {
  const resetsAt = (await read($, weekly))?.resetsAt
  if (resetsAt === undefined) return
  const key = WINDOW_PREFIX + (await $.session.id())
  await $.store.set(key, addToWindow(await $.store.get(key), resetsAt, count))
  for (const k of await windowKeys($)) {
    if (!isCurrent(await $.store.get(k), resetsAt)) await $.store.delete(k)
  }
}

const readWindowTotal = async ($: EngineInterface, resetsAt: number) => {
  const keys = await windowKeys($)
  return windowTotal(await Promise.all(keys.map(k => $.store.get(k))), resetsAt)
}

const recordTurn = async (
  $: EngineInterface,
  e: TurnCompleteInput,
  usage: TurnUsage,
) => {
  await update($, tokens, sum => sum + turnTokens(usage))
  await addWindowTokens($, turnTokens(usage))
  const sofar = await read($, pending)
  const output = sofar.output + usage.output_tokens
  if (e.agentId !== undefined) {
    const agents = [...new Set([...sofar.agents, e.agentId])]
    await update($, pending, () => ({ ...sofar, output, agents }))
    return
  }
  const mainCacheWrite = usage.cache_creation_input_tokens
  const model = usage.model
  await update($, last, () => ({ ...sofar, output, mainCacheWrite, model }))
  await update($, pending, () => EMPTY)
}

const TURNS_KEY = 'bonsai:turns'

const countTurn = async ($: EngineInterface) => {
  const sofar = await $.store.get(TURNS_KEY)
  await $.store.set(TURNS_KEY, (typeof sofar === 'number' ? sofar : 0) + 1)
}

const readTurns = async ($: EngineInterface): Promise<number> => {
  const turns = await $.store.get(TURNS_KEY)
  return typeof turns === 'number' ? turns : 0
}

type Table = ReturnType<EngineInterface['ui']['resolve']>

const TREE_MIN_COLUMNS = 70
const TREE_WIDTH = 170
const TREE_HEIGHT = 50

type Scene = { turns: number; sky: Sky }

const drawnTree = (table: Table, { turns, sky }: Scene) => {
  if (!('Svg' in table)) return undefined
  const stage = stageFor(turns)
  const alt = `bonsai, ${STAGE_NAMES[stage]} stage, ${turns} turns`
  return (
    <table.Box key="bonsai">
      <table.Svg source={bonsaiSvg(stage, turns, sky)} alt={alt}
        width={TREE_WIDTH} height={TREE_HEIGHT} isInteractive />
    </table.Box>
  )
}

const drawTree = (table: Table, isSvg: boolean, scene: Scene) => {
  const { turns } = scene
  if (isSvg) return drawnTree(table, scene)
  if (!('Client' in table)) return undefined
  return <table.Client key="bonsai" module="./tree.tsx" props={{ turns }} />
}

const missing = (value: string): Segment => ({
  value,
  color: MISSING_COLOR,
})

const levelSegment = (lvl: number, left?: string): Segment => ({
  value: left === undefined ? String(lvl) : `${lvl} · ${left}`,
  color: LEVEL_COLORS[lvl - 1] ?? MISSING_COLOR,
})

const weeklySegment = (week: Weekly): Segment => ({
  value: `w-${week.last.percent}%`,
  color: LEVEL_COLORS[levelFromUsed(week.last.percent) - 1] ?? MISSING_COLOR,
})

const totalSegments = (total?: number): Segment[] =>
  total === undefined ? [] : [{ value: compact(total), color: SESSION_COLOR }]

const accountSegments = (
  week: Weekly | null,
  now: number,
  total?: number,
): Segment[] => {
  if (week === null) return [missing('no reading')]
  const left = timeLeft(project(week, now))
  const lvl = levelSegment(level(week, now), left)
  return [lvl, ...totalSegments(total), weeklySegment(week)]
}

const mineSegment = async (
  $: EngineInterface,
  week: Weekly | null,
  now: number,
): Promise<Segment> => {
  const spent = await read($, spend)
  if (week === null || spent === null) return missing('no estimate')
  const rate = spendRate(spent)
  const perMs = pace(week)
  if (rate === undefined || perMs === undefined) return missing('measuring')
  const peers = await readPeers($)
  const p = projectPace(week, shareOf(rate, peers, now) * perMs, now)
  return levelSegment(levelFromPace(p), timeLeft(p))
}

const tokensSegment = async ($: EngineInterface): Promise<Segment> => ({
  value: compact(await read($, tokens)),
  color: SESSION_COLOR,
})

const describe = async ($: EngineInterface) => {
  const week = await read($, weekly)
  const now = await $.clock.now()
  const isRunningOut =
    week !== null && project(week, now).kind === 'runs-out'
  const why = cause({
    last: await read($, last),
    context: await read($, context),
    isRunningOut,
  })
  const mine = [await mineSegment($, week, now), await tokensSegment($)]
  const resetsAt = week?.resetsAt
  const total = resetsAt === undefined
    ? undefined
    : await readWindowTotal($, resetsAt)
  const badges: Badge[] = [
    { key: 'mine', label: 'session', segments: mine },
    {
      key: 'account',
      label: 'account',
      segments: accountSegments(week, now, total),
    },
  ]
  return { badges, why }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { rateLimits, cost } = await $.session.usage()
    await recordWeekly($, rateLimits)
    await recordCost($, cost)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const usage = e.usage ?? result.usage
    if (usage) await recordTurn($, e, usage)
    if (e.agentId === undefined) await countTurn($)
    return result
  })

  on('session.measure', async ($, e, next) => {
    await recordWeekly($, e.rateLimits)
    await recordCost($, e.cost)
    const tokensInWindow = e.context.tokens
    if (tokensInWindow !== undefined) {
      await update($, context, () => tokensInWindow)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const isEmpty =
      (await read($, tokens)) === 0 && (await read($, weekly)) === null
    if (e.props.hasSurvey || isEmpty) return next(e)

    const { badges, why } = await describe($)
    const table = $.ui.resolve(e)
    const isSvg = e.surface !== 'terminal' && 'Svg' in table
    const turns = await readTurns($)
    const hasRoom = e.props.bodyColumns >= TREE_MIN_COLUMNS
    const sky = skyFor(new Date(await $.clock.now()).getHours())
    const tree = turns > 0 && hasRoom
      ? drawTree(table, isSvg, { turns, sky })
      : undefined
    return drawBand({ table, isSvg, badges, why, tree })
  })
}
