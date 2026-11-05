import type { EngineInterface } from 'claude-code'

import {
  CAPTION_HEIGHT,
  LABEL_COLOR,
  badgeAlt,
  badgeSvg,
  captionSvg,
} from './badge'
import type { Badge } from './badge'

type Table = ReturnType<EngineInterface['ui']['resolve']>

export type BandInput = {
  table: Table
  isSvg: boolean
  badges: Badge[]
  why?: string
  tree?: ReturnType<Table['Box']>
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

const caption = (table: Table, isSvg: boolean, why: string) => {
  const Svg = 'Svg' in table ? table.Svg : undefined
  if (!isSvg || Svg === undefined) {
    return <table.Text dimColor>{why}</table.Text>
  }
  const { svg, width } = captionSvg(why)
  return <Svg source={svg} alt={why} width={width} height={CAPTION_HEIGHT} />
}

export const drawBand = (input: BandInput) => {
  const { Box, Text } = input.table
  const note = input.why === undefined ? null : (
    <Box key="note">{caption(input.table, input.isSvg, input.why)}</Box>
  )
  return (
    <Box key="band" flexDirection="column">
      <Box key="row" flexDirection="row" flexWrap="wrap"
        alignItems="center" columnGap={1} rowGap={input.isSvg ? 1 : 0}>
        {input.badges.map(b => pill(input, b))}
        {input.tree === undefined ? null : <Box key="spacer" flexGrow={1} />}
        {input.tree}
      </Box>
      {note}
    </Box>
  )
}
