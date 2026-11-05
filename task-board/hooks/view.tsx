import type { EngineInterface } from 'claude-code'

import type { Card, Lanes, Tone } from './lanes'

type Table = ReturnType<EngineInterface['ui']['resolve']>

export type Look = { isWide: boolean; isFine: boolean }

const FINE_BAR = 0.3
const PANEL_FILL = '#8080801f'

export const TONE_COLORS: Record<Tone, string> = {
  queued: '#9f9f9f',
  doing: '#378add',
  agent: '#7f77dd',
  waiting: '#ef9f27',
  failed: '#e24b4a',
  done: '#44cc11',
}

type Lane = { name: 'doing' | 'queued' | 'done'; tone: Tone }

const LANES: Lane[] = [
  { name: 'doing', tone: 'doing' },
  { name: 'queued', tone: 'queued' },
  { name: 'done', tone: 'done' },
]

const panel = (isFine: boolean) =>
  isFine
    ? { backgroundColor: PANEL_FILL }
    : { borderStyle: 'round', borderDimColor: true }

const drawCard = (table: Table, lane: string, c: Card, isFine: boolean) => {
  const { Box, Text } = table
  return (
    <Box key={`card:${lane}:${c.key}`} flexDirection="row"
      overflow="hidden" {...panel(isFine)}>
      <Box width={isFine ? FINE_BAR : 1}
        backgroundColor={TONE_COLORS[c.tone]} />
      <Box flexDirection="column" flexGrow={1} flexShrink={1} paddingX={1}
        paddingY={isFine ? 0.5 : 0}>
        <Text dimColor={lane === 'done'}>{c.title}</Text>
        {c.status === undefined ? null : (
          <Text color={TONE_COLORS[c.tone]}>{c.status}</Text>
        )}
      </Box>
    </Box>
  )
}

const LANE_NAMES = { doing: 'Doing', queued: 'Queued', done: 'Done' }

const header = ({ Box, Text }: Table, lane: Lane, count: number) => (
  <Box key={`head:${lane.name}`} flexDirection="row" gap={1}>
    <Text color={TONE_COLORS[lane.tone]}>●</Text>
    <Text bold>{`${LANE_NAMES[lane.name]} ${count}`}</Text>
  </Box>
)

const drawLane = (table: Table, lanes: Lanes, lane: Lane, look: Look) => {
  const { Box, Text } = table
  const cards = lanes[lane.name]
  const more = lane.name === 'done' && lanes.hiddenDone > 0
  return (
    <Box key={`lane:${lane.name}`} flexDirection="column" gap={1}
      {...(look.isWide ? { flexGrow: 1, flexShrink: 1, width: 0 } : {})}>
      {header(table, lane, cards.length + (more ? lanes.hiddenDone : 0))}
      {cards.map(c => drawCard(table, lane.name, c, look.isFine))}
      {more ? (
        <Box key="more:done">
          <Text dimColor>{`+ ${lanes.hiddenDone} more`}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

export const drawBoard = (table: Table, lanes: Lanes, look: Look) => {
  const { Box, Text } = table
  const { isWide } = look
  const order = isWide ? [LANES[1], LANES[0], LANES[2]] : LANES
  const body = order.map(l => drawLane(table, lanes, l as Lane, look))
  return (
    <Box flexDirection="column" gap={1}>
      <Box key={isWide ? 'columns' : 'stack'}
        flexDirection={isWide ? 'row' : 'column'} gap={isWide ? 2 : 1}>
        {body}
      </Box>
      <Box key="footer"><Text dimColor>{lanes.footer}</Text></Box>
    </Box>
  )
}

export const drawEmpty = ({ Box, Text }: Table) => (
  <Box key="empty">
    <Text dimColor>
      No plan yet. Steps show up here once Claude writes one.
    </Text>
  </Box>
)
