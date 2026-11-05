const STAGE_TURNS = [100, 500, 2000, 10000]

export const stageFor = (turns: number): number =>
  STAGE_TURNS.filter(t => turns >= t).length

const STAGE_PIXELS = [
  ['........', '........', '...g....', '..pppp..'],
  ['........', '...g....', '...b....', '..pppp..'],
  ['...gg...', '..ggbg..', '...b....', '..pppp..'],
  ['..gggg..', '.ggbggg.', '...b....', '..pppp..'],
  ['..gkgg..', '.gkbgkg.', '...b....', '..pppp..'],
]

const CANOPY_ROWS = 2

export type TreeFrame = { stage: number; tick: number; isSparkling: boolean }

const sway = (row: string): string => `.${row.slice(0, -1)}`

const BLOOM = 4
const PETAL_FALL = 5

const SPARKLE_ROW = 1
const SPARKLE_COLUMN = 5

const paint = (row: string, column: number, pixel: string): string =>
  `${row.slice(0, column)}${pixel}${row.slice(column + 1)}`

const withPetal = (row: string): string => paint(row, row.length - 1, 'k')

const withSparkle = (rows: string[]): string[] =>
  rows.map((r, i) => (i === SPARKLE_ROW ? paint(r, SPARKLE_COLUMN, 'y') : r))

const swayed = ({ stage, tick }: TreeFrame): string[] => {
  const rows = STAGE_PIXELS[stage] ?? STAGE_PIXELS[0]!
  const isSwaying = stage >= 2 && tick % 2 === 1
  if (!isSwaying) return rows
  return rows.map((r, i) => (i < CANOPY_ROWS ? sway(r) : r))
}

const petalled = (frame: TreeFrame): string[] => {
  const rows = swayed(frame)
  if (frame.stage < BLOOM) return rows
  const petalRow = frame.tick % PETAL_FALL
  return rows.map((r, i) => (i === petalRow ? withPetal(r) : r))
}

export const treePixels = (frame: TreeFrame): string[] => {
  const rows = petalled(frame)
  return frame.isSparkling ? withSparkle(rows) : rows
}

const PIXEL_COLORS: Record<string, string> = {
  g: '#6fbf5a',
  k: '#f2b8c6',
  b: '#8a5a3b',
  p: '#b0764f',
  y: '#f2c14e',
}

export type TreeCell = { text: string; color?: string; backgroundColor?: string }

const cell = (top?: string, bottom?: string): TreeCell => {
  if (top !== undefined) {
    return bottom === undefined
      ? { text: '▀', color: top }
      : { text: '▀', color: top, backgroundColor: bottom }
  }
  return bottom === undefined ? { text: ' ' } : { text: '▄', color: bottom }
}

const rowPair = (top: string, bottom: string): TreeCell[] =>
  [...top].map((p, i) =>
    cell(PIXEL_COLORS[p], PIXEL_COLORS[bottom[i] ?? '.']))

export const treeCells = (pixels: string[]): TreeCell[][] => {
  const rows: TreeCell[][] = []
  for (let i = 0; i < pixels.length; i += 2) {
    rows.push(rowPair(pixels[i] ?? '', pixels[i + 1] ?? ''))
  }
  return rows
}

const SPARKLE_FRAMES = 4

export type TreeClock = {
  tick: number
  seen: number
  sparkUntil: number
  isSparkling: boolean
}

export const startClock = (turns: number): TreeClock =>
  ({ tick: 0, seen: turns, sparkUntil: 0, isSparkling: false })

export const advance = (clock: TreeClock, turns: number): TreeClock => {
  const tick = clock.tick + 1
  const sparkUntil = turns === clock.seen
    ? clock.sparkUntil
    : tick + SPARKLE_FRAMES
  return { tick, seen: turns, sparkUntil, isSparkling: tick < sparkUntil }
}
