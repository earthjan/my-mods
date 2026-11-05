import type { EngineInterface } from 'claude-code'

import { LABEL_COLOR, badgeAlt, badgeSvg } from './badge'
import type { Badge } from './badge'

type Table = ReturnType<EngineInterface['ui']['resolve']>

export type BandInput = {
  table: Table
  isSvg: boolean
  badges: Badge[]
  why?: string
}

const terminalPill = ({ Text }: Table, b: Badge) => [
  <Text key="label" backgroundColor={LABEL_COLOR} color="#ffffff">
    {` ${b.label} `}
  </Text>,
  ...b.segments.map((s, i) => (
    <Text key={`v${i}`} backgroundColor={s.color} color="#ffffff">
      {` ${s.value} `}
    </Text>
  )),
]

const svgPill = (table: Table, b: Badge) => {
  const { Box } = table
  const Svg = 'Svg' in table ? table.Svg : undefined
  if (Svg === undefined) return null
  const { svg, width } = badgeSvg(b)
  return (
    <Box key={`${b.key}-svg`}>
      <Svg source={svg} alt={badgeAlt(b)} width={width} height={20} />
    </Box>
  )
}

const pill = (input: BandInput, b: Badge) => {
  const { Box } = input.table
  const drawn = input.isSvg
    ? svgPill(input.table, b)
    : terminalPill(input.table, b)
  return (
    <Box key={b.key} flexDirection="row" flexShrink={0}>
      {drawn}
    </Box>
  )
}

export const drawBand = (input: BandInput) => {
  const { Box, Text } = input.table
  const note = input.why === undefined ? null : (
    <Box key="note"><Text dimColor>{input.why}</Text></Box>
  )
  return (
    <Box key="band" flexDirection="row" flexWrap="wrap"
      alignItems="center" columnGap={1} rowGap={input.isSvg ? 1 : 0}>
      {input.badges.map(b => pill(input, b))}
      {note}
    </Box>
  )
}
