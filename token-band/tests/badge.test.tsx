import { expect, test } from 'claude-code/testing'
import { badgeSvg } from '../hooks/badge'

const segmentEdges = (svg: string) =>
  [...svg.matchAll(/<rect x="(\d+)" width="(\d+)"/g)]
    .map(m => [Number(m[1]), Number(m[2])])

const textCentres = (svg: string) =>
  [...svg.matchAll(/<text x="([\d.]+)"/g)].map(m => Number(m[1]))

test('segments fit the Verdana width of their own text', () => {
  const { svg, width } = badgeSvg({
    key: 'k',
    label: 'this session',
    segments: [{ value: 'w-34%', color: '#44cc11' }],
  })

  expect(segmentEdges(svg)).toEqual([[0, 84], [84, 60]])
  expect(width).toBe(144)
})

test('text centres on the flat part, clear of the rounded ends', () => {
  const { svg } = badgeSvg({
    key: 'k',
    label: 'this session',
    segments: [{ value: 'w-34%', color: '#44cc11' }],
  })

  expect(textCentres(svg)).toEqual([44, 112])
})

test('values meet edge to edge, with no divider line', () => {
  const { svg } = badgeSvg({
    key: 'k',
    label: 'a',
    segments: [
      { value: '2', color: '#97ca00' },
      { value: '9', color: '#6c757d' },
    ],
  })

  expect(svg).not.toContain('fill-opacity')
})
