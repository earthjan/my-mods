export type Segment = { value: string; color: string }

export type Badge = { key: string; label: string; segments: Segment[] }

export const LABEL_COLOR = '#555555'
export const LEVEL_COLORS = ['#44cc11', '#97ca00', '#dfb317', '#fe7d37', '#e05d44']
export const SESSION_COLOR = '#6c757d'
export const MISSING_COLOR = '#9f9f9f'

const HEIGHT = 20
const RADIUS = HEIGHT / 2
const PAD = 16
const DEFAULT_WIDTH = 6.6

const VERDANA_11: Record<string, number> = {
  ' ': 3.87, '!': 4.33, '%': 11.84, '(': 5, ')': 5, '+': 9, ',': 4,
  '-': 5, '.': 4, '/': 5, ':': 5, '<': 9, '>': 9, '?': 6, '·': 4,
  a: 6.61, b: 6.85, c: 5.73, d: 6.85, e: 6.55, f: 3.87, g: 6.85,
  h: 6.96, i: 3.02, j: 3.79, k: 6.51, l: 3.02, m: 10.7, n: 6.96,
  o: 6.68, p: 6.85, q: 6.85, r: 4.69, s: 5.73, t: 4.33, u: 6.96,
  v: 6.51, w: 9, x: 6.51, y: 6.51, z: 5.78, B: 7.54, K: 7.62,
  M: 9.27, T: 6.78,
}

const charWidth = (ch: string): number =>
  /[0-9]/.test(ch) ? 6.99 : VERDANA_11[ch] ?? DEFAULT_WIDTH

const textWidth = (text: string): number =>
  [...text].reduce((sum, ch) => sum + charWidth(ch), 0)

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const segmentWidth = (text: string): number =>
  Math.round(textWidth(text) + PAD)

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
    const drawn = segment(x, width, s.value, s.color) + line
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
