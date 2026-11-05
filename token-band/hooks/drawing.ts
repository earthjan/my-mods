const DARK = '#2f6e30'
const MID = '#4f9a44'
const LIGHT = '#8fd06c'
const BARK = '#5a3d26'
const BARK_LIT = '#8a6240'

export const STAGE_NAMES = ['sprout', 'seedling', 'sapling', 'tree', 'in bloom']

const PINK = '#f4b6c8'
const CREAM = '#fff6d8'

type Pad = {
  x: number
  y: number
  scale: number
  seconds: number
  isBlooming?: boolean
}

const FLOWERS: [number, number][] = [[-6, 1], [2, -4], [7, 3], [-1, 4]]

const LEAVES: [number, number, number, string][] = [
  [-9, 2, 7, DARK], [0, -2, 9, DARK], [9, 2, 7, DARK], [0, 4, 7, DARK],
  [-6, -1, 5.5, MID], [3, -5, 6, MID], [8, 0, 4.5, MID],
  [-3, -6, 3.2, LIGHT], [5, -7, 2.6, LIGHT], [-9, -1, 2.4, LIGHT],
]

const round = (n: number) => Math.round(n * 100) / 100

const circle = (x: number, y: number, r: number, fill: string) =>
  `<circle cx="${round(x)}" cy="${round(y)}" r="${round(r)}" ` +
  `fill="${fill}"/>`

const sway = ({ x, y, scale, seconds }: Pad): string => {
  const pivot = `${x} ${y + 8 * scale}`
  return `<animateTransform attributeName="transform" type="rotate" ` +
    `values="-2 ${pivot};2 ${pivot};-2 ${pivot}" dur="${seconds}s" ` +
    'repeatCount="indefinite"/>'
}

const flowers = ({ x, y, scale }: Pad): string =>
  FLOWERS.map(([dx, dy]) => {
    const fx = x + dx * scale
    const fy = y + dy * scale
    return circle(fx, fy, 1.7 * scale, PINK) +
      circle(fx, fy, 0.6 * scale, CREAM)
  }).join('')

const pad = (p: Pad): string => {
  const leaves = LEAVES.map(([dx, dy, r, fill]) =>
    circle(p.x + dx * p.scale, p.y + dy * p.scale, r * p.scale, fill))
  const blooms = p.isBlooming ? flowers(p) : ''
  return `<g>${sway(p)}${leaves.join('')}${blooms}</g>`
}

const WIDTH = 340
const TREE_X = WIDTH - 120
const PETAL_COUNT = 9

const drift = (attribute: string, values: string, timing: string) =>
  `<animate attributeName="${attribute}" values="${values}" ${timing} ` +
  'repeatCount="indefinite"/>'

const petal = (i: number): string => {
  const y = 20 + (i * 13) % 40
  const timing = `dur="${5 + i % 3}s" begin="${(i * 0.9).toFixed(1)}s"`
  const from = TREE_X + 60
  return `<ellipse cx="${from}" cy="${y}" rx="2" ry="1.2" ` +
    `fill="${PINK}" opacity="0">` +
    drift('cx', `${from};${from - WIDTH * 0.9}`, timing) +
    drift('cy', `${y};${y + 18};${y + 8};${y + 30}`, timing) +
    drift('opacity', '0;1;1;0', timing) +
    '</ellipse>'
}

const PETALS = Array.from({ length: PETAL_COUNT }, (_, i) => petal(i)).join('')

const POT =
  '<rect x="32" y="94" width="8" height="3" rx="1" fill="#2c4250"/>' +
  '<rect x="80" y="94" width="8" height="3" rx="1" fill="#2c4250"/>' +
  '<path d="M26 83 L94 83 L90 94 L30 94 Z" fill="#3a5666"/>' +
  '<path d="M30 92 L90 92 L90 94 L30 94Z" fill="#2c4250"/>' +
  '<rect x="22" y="78" width="76" height="5" rx="1.5" fill="#4a6b7d"/>' +
  '<rect x="22" y="78" width="76" height="1.5" rx=".75" fill="#6b8ea0"/>' +
  '<ellipse cx="60" cy="78.5" rx="33" ry="3" fill="#5f7f34"/>'

const branch = (d: string, width: number) =>
  `<path d="${d}" stroke="${BARK}" stroke-width="${width}" ` +
  'stroke-linecap="round" fill="none"/>'

const SPROUT =
  `<path d="M60 79 C60 75 61 73 61 70" stroke="${MID}" ` +
  'stroke-width="1.6" fill="none"/>' +
  `<ellipse cx="57.5" cy="70" rx="3.5" ry="1.8" fill="${LIGHT}" ` +
  'transform="rotate(-25 57.5 70)"/>' +
  `<ellipse cx="64" cy="69" rx="3.5" ry="1.8" fill="${MID}" ` +
  'transform="rotate(25 64 69)"/>'

const SEEDLING =
  '<path d="M60 79 C59 72 63 68 61 60" stroke="#6b4a2e" ' +
  'stroke-width="2" fill="none"/>' +
  pad({ x: 61, y: 58, scale: 0.45, seconds: 5 })

const SAPLING =
  '<path d="M57 79 C56 72 62 68 60 60 C59 55 62 50 63 46 L65 47 ' +
  `C63 52 62 56 63 60 C64 68 60 72 62 79Z" fill="${BARK}"/>` +
  branch('M60 62 C55 60 50 60 46 60', 2) +
  pad({ x: 64, y: 42, scale: 0.75, seconds: 4.5 }) +
  pad({ x: 45, y: 58, scale: 0.5, seconds: 5.5 })

const TRUNK =
  branch('M50 60 C42 58 36 57 30 57', 3.2) +
  branch('M61 45 C70 45 78 43 87 41', 2.6) +
  '<path d="M52 79 C51 70 45 66 47 58 C49 50 59 48 57 40 C56 34 61 30 ' +
  '65 28 L68 30 C64 34 63 38 64 42 C66 52 57 54 56 60 C55 66 62 72 ' +
  `66 79 Z" fill="${BARK}"/>` +
  '<path d="M53 77 C52 70 47 65 49 58 C51 52 58 49 58 42" ' +
  `stroke="${BARK_LIT}" stroke-width="1.3" fill="none" ` +
  'stroke-linecap="round"/>' +
  '<path d="M46 79 Q52 76 54 79 M64 79 Q68 76 73 79" ' +
  `stroke="${BARK}" stroke-width="2" fill="none"/>`

const GROWN_PADS: Pad[] = [
  { x: 30, y: 54, scale: 0.85, seconds: 5.2 },
  { x: 88, y: 38, scale: 0.8, seconds: 4.6 },
  { x: 66, y: 22, scale: 1, seconds: 4 },
]

const BLOOM = 4

const grown = (isBlooming: boolean): string => {
  const pads = GROWN_PADS.map(p => pad({ ...p, isBlooming })).join('')
  return TRUNK + pads
}

const plant = (stage: number): string =>
  [SPROUT, SEEDLING, SAPLING][stage] ?? grown(stage >= BLOOM)

const SPARKLE =
  '<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" ' +
  'dur="1.8s" repeatCount="1" fill="freeze"/>' +
  '<path d="M84 16 L86 22 L92 24 L86 26 L84 32 L82 26 L76 24 L82 22Z" ' +
  'fill="#f2c14e"/>' + circle(94, 14, 1.4, '#f2c14e') +
  circle(74, 14, 1, '#f2c14e') + '</g>'

export type Sky = 'dawn' | 'day' | 'dusk' | 'night'

const SKY_STARTS: [number, Sky][] = [[20, 'night'], [17, 'dusk'], [8, 'day'], [5, 'dawn']]

export const skyFor = (hour: number): Sky =>
  SKY_STARTS.find(([start]) => hour >= start)?.[1] ?? 'night'

type SkyPaint = {
  top: string
  bottom: string
  light: string
  lightY: number
  cloud: string
}

const SKIES: Record<Sky, SkyPaint> = {
  dawn: { top: '#f6c8a8', bottom: '#f3e2c4', light: '#ffd27a',
    lightY: 70, cloud: '#fff4ea' },
  day: { top: '#7cb8e8', bottom: '#cfe8f7', light: '#fff3b0',
    lightY: 24, cloud: '#ffffff' },
  dusk: { top: '#5a4a8a', bottom: '#f19a7a', light: '#ffb36b',
    lightY: 66, cloud: '#f6c1b0' },
  night: { top: '#0f1a33', bottom: '#2a3a62', light: '#f2ecd0',
    lightY: 24, cloud: '#3c4c78' },
}

const STAR_COUNT = 14

const star = (i: number): string =>
  `<circle class="star" cx="${(i * 53) % 300 + 10}" ` +
  `cy="${(i * 29) % 50 + 8}" r="${i % 3 ? 0.9 : 1.4}" fill="#fff">` +
  '<animate attributeName="opacity" values="1;.3;1" ' +
  `dur="${2 + i % 3}s" repeatCount="indefinite"/></circle>`

const STARS = Array.from({ length: STAR_COUNT }, (_, i) => star(i)).join('')

const light = (sky: Sky, paint: SkyPaint): string => {
  const sun = circle(60, paint.lightY, 11, paint.light)
  if (sky !== 'night') return sun
  return circle(60, paint.lightY, 10, paint.light) +
    circle(65, paint.lightY - 3, 9, paint.top)
}

const cloud = (x: number, y: number, seconds: number, fill: string) =>
  `<g fill="${fill}" opacity=".85">` +
  '<animateTransform attributeName="transform" type="translate" ' +
  `values="0 0;${-WIDTH} 0" dur="${seconds}s" repeatCount="indefinite"/>` +
  `<ellipse cx="${x}" cy="${y}" rx="16" ry="6"/>` +
  `<ellipse cx="${x + 10}" cy="${y - 4}" rx="10" ry="6"/>` +
  `<ellipse cx="${x - 8}" cy="${y - 2}" rx="8" ry="5"/></g>`

const backdrop = (sky: Sky): string => {
  const paint = SKIES[sky]
  return '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">' +
    `<stop offset="0" stop-color="${paint.top}"/>` +
    `<stop offset="1" stop-color="${paint.bottom}"/></linearGradient>` +
    `<clipPath id="panel"><rect width="${WIDTH}" height="100" rx="14"/>` +
    '</clipPath></defs>' +
    `<rect width="${WIDTH}" height="100" fill="url(#sky)"/>` +
    (sky === 'night' ? STARS : '') + light(sky, paint) +
    cloud(150, 26, 40, paint.cloud) + cloud(330, 44, 55, paint.cloud) +
    `<rect y="88" width="${WIDTH}" height="12" fill="#3d5a2c" ` +
    'opacity=".55"/>'
}

export const bonsaiSvg = (stage: number, turns: number, sky: Sky) =>
  '<svg xmlns="http://www.w3.org/2000/svg" ' +
  `viewBox="0 0 ${WIDTH} 100" data-turns="${turns}">` +
  `<g clip-path="url(#panel)">${backdrop(sky)}` +
  `<g transform="translate(${TREE_X} 0)">${POT}${plant(stage)}` +
  `${SPARKLE}</g>${stage >= BLOOM ? PETALS : ''}</g></svg>`

