import { expect, test } from 'claude-code/testing'
import { badgeSvg } from '../hooks/badge'

const segmentEdges = (svg: string) =>
  [...svg.matchAll(/<rect x="(\d+)" width="(\d+)"/g)]
    .map(m => [Number(m[1]), Number(m[2])])

test('segments fit the Verdana width of their own text', () => {
  const { svg, width } = badgeSvg({
    key: 'k',
    label: 'this session',
    segments: [{ value: 'w-34%', color: '#44cc11' }],
  })

  expect(segmentEdges(svg)).toEqual([[0, 80], [80, 56]])
  expect(width).toBe(136)
})

test('the divider between values is drawn on top of them', () => {
  const { svg } = badgeSvg({
    key: 'k',
    label: 'a',
    segments: [
      { value: '2', color: '#97ca00' },
      { value: '9', color: '#6c757d' },
    ],
  })

  const second = svg.indexOf('<rect x="46"')
  const divider = svg.indexOf('fill-opacity="0.35"')
  expect(second).toBeGreaterThan(-1)
  expect(divider).toBeGreaterThan(second)
})
