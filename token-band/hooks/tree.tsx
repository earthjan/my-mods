import type { ClientModule, ClientSurface } from 'claude-code'

import { advance, stageFor, startClock, treeCells, treePixels } from './bonsai'
import type { TreeClock } from './bonsai'

type Props = { turns: number }
type State = { clock: TreeClock; latest: Props }

const FRAME_MS = 600

const start = (props: Props, surface: ClientSurface<State>): State => {
  const latest = { ...props }
  let clock = startClock(props.turns)
  surface.every(FRAME_MS, () => {
    clock = advance(clock, latest.turns)
    surface.setState({ clock, latest })
  })
  const state = { clock, latest }
  surface.setState(state)
  return state
}

const Tree: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  const { clock, latest } = surface.state ?? start(props, surface)
  latest.turns = props.turns
  const pixels = treePixels({
    stage: stageFor(props.turns),
    tick: clock.tick,
    isSparkling: clock.isSparkling,
  })
  return (
    <Box flexDirection="column">
      {treeCells(pixels).map((row, r) => (
        <Box key={`r${r}`} flexDirection="row">
          {row.map(({ text, ...colors }, i) => (
            <Text key={`c${i}`} {...colors}>{text}</Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}

export default Tree
