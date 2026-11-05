export type Segment = { value: string; color: string }

export type Badge = { key: string; label: string; segments: Segment[] }

export const LABEL_COLOR = '#555555'
export const LEVEL_COLORS = ['#44cc11', '#97ca00', '#dfb317', '#fe7d37', '#e05d44']
export const SESSION_COLOR = '#6c757d'
export const MISSING_COLOR = '#9f9f9f'

const HEIGHT = 20
const CHAR_WIDTH = 6.6
const PAD = 16
const RADIUS = HEIGHT / 2

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const segmentWidth = (text: string): number =>
  Math.round(text.length * CHAR_WIDTH + PAD)

const segment = (x: number, width: number, text: string, fill: string) =>
  `<rect x="${x}" width="${width}" height="${HEIGHT}" fill="${fill}"/>` +
  `<text x="${x + width / 2}" y="14">${escape(text)}</text>`

const SEPARATOR =
  `<rect width="1" height="${HEIGHT}" fill="#ffffff" fill-opacity="0.35"/>`

const values = (segments: Segment[], start: number) => {
  let x = start
  const parts = segments.map((s, i) => {
    const width = segmentWidth(s.value)
    const line = i === 0 ? '' : `<g transform="translate(${x})">${SEPARATOR}</g>`
    const drawn = line + segment(x, width, s.value, s.color)
    x += width
    return drawn
  })
  return { svg: parts.join(''), end: x }
}

export const badgeAlt = (b: Badge): string =>
  [b.label, ...b.segments.map(s => s.value)].join(' ')

export const badgeSvg = (b: Badge) => {
  const left = segmentWidth(b.label)
  const right = values(b.segments, left)
  const width = right.end
  const clip = `c-${b.key}`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}">` +
    `<clipPath id="${clip}"><rect width="${width}" height="${HEIGHT}" rx="${RADIUS}"/></clipPath>` +
    '<g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">' +
    `<g clip-path="url(#${clip})">` +
    segment(0, left, b.label, LABEL_COLOR) + right.svg +
    '</g></g></svg>'
  return { svg, width }
}
