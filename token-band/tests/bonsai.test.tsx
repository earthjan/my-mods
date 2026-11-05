import { expect, test } from 'claude-code/testing'
import { bonsaiSvg, skyFor } from '../hooks/drawing'
import type { Sky } from '../hooks/drawing'
import { advance, stageFor, startClock, treeCells, treePixels } from '../hooks/bonsai'

test('the tree grows a stage at 100, 500, 2,000 and 10,000 turns', () => {
  const turns = [0, 1, 99, 100, 499, 500, 1999, 2000, 9999, 10000, 50000]
  expect(turns.map(stageFor)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4])
})

test('a grown tree sways its canopy one pixel on every other tick', () => {
  expect(treePixels({ stage: 3, tick: 0, isSparkling: false })).toEqual([
    '..gggg..',
    '.ggbggg.',
    '...b....',
    '..pppp..',
  ])
  expect(treePixels({ stage: 3, tick: 1, isSparkling: false })).toEqual([
    '...gggg.',
    '..ggbggg',
    '...b....',
    '..pppp..',
  ])
})

test('a tree in bloom drops a petal down its right side', () => {
  const at = (tick: number) =>
    treePixels({ stage: 4, tick, isSparkling: false })
  expect(at(0)).toEqual([
    '..gkgg.k',
    '.gkbgkg.',
    '...b....',
    '..pppp..',
  ])
  expect(at(3)).toEqual([
    '...gkgg.',
    '..gkbgkg',
    '...b....',
    '..pppp.k',
  ])
  expect(at(4)).toEqual([
    '..gkgg..',
    '.gkbgkg.',
    '...b....',
    '..pppp..',
  ])
})

test('a finished turn shows a sparkle beside the sprout', () => {
  expect(treePixels({ stage: 0, tick: 0, isSparkling: true })).toEqual([
    '........',
    '.....y..',
    '...g....',
    '..pppp..',
  ])
})

test('each text cell carries two pixels as a half block', () => {
  expect(treeCells(['g.p', 'k.b'])).toEqual([[
    { text: '▀', color: '#6fbf5a', backgroundColor: '#f2b8c6' },
    { text: ' ' },
    { text: '▀', color: '#b0764f', backgroundColor: '#8a5a3b' },
  ]])
  expect(treeCells(['.', 'y'])).toEqual([[
    { text: '▄', color: '#f2c14e' },
  ]])
  expect(treeCells(['g', '.'])).toEqual([[
    { text: '▀', color: '#6fbf5a' },
  ]])
})

test('a new turn sparkles for four frames, the first count does not', () => {
  const sparkles: boolean[] = []
  let clock = startClock(5)
  for (const turns of [5, 6, 6, 6, 6, 6]) {
    clock = advance(clock, turns)
    sparkles.push(clock.isSparkling)
  }
  expect(sparkles).toEqual([false, true, true, true, true, false])
})

const PINK = '#f4b6c8'
const count = (text: string, part: string) => text.split(part).length - 1

test('only the tree in bloom has flowers and falling petals', () => {
  expect(count(bonsaiSvg(3, 1, 'day'), PINK)).toBe(0)
  expect(count(bonsaiSvg(4, 1, 'day'), `<circle`)).toBeGreaterThan(
    count(bonsaiSvg(3, 1, 'day'), `<circle`),
  )
  expect(count(bonsaiSvg(4, 1, 'day'), `<ellipse cx`)).toBeGreaterThan(
    count(bonsaiSvg(3, 1, 'day'), `<ellipse cx`),
  )
  expect(count(bonsaiSvg(4, 1, 'day'), PINK)).toBeGreaterThan(0)
})

test('each finished turn draws a fresh picture that sparkles once', () => {
  const before = bonsaiSvg(3, 2000, 'day')
  const after = bonsaiSvg(3, 2001, 'day')
  expect(after).not.toBe(before)
  expect(count(after, '#f2c14e')).toBeGreaterThan(0)
  expect(after).toContain('repeatCount="1"')
})

test('the sky follows the local hour', () => {
  const hours = [4, 5, 7, 8, 16, 17, 19, 20, 23]
  expect(hours.map(skyFor)).toEqual([
    'night', 'dawn', 'dawn', 'day', 'day', 'dusk', 'dusk', 'night', 'night',
  ])
})

test('each time of day paints its own sky, stars only at night', () => {
  const at = (sky: Sky) => bonsaiSvg(3, 1, sky)
  expect(at('dawn')).toContain('#f6c8a8')
  expect(at('day')).toContain('#7cb8e8')
  expect(at('dusk')).toContain('#5a4a8a')
  expect(at('night')).toContain('#0f1a33')
  expect(count(at('night'), 'class="star"')).toBeGreaterThan(0)
  expect(count(at('day'), 'class="star"')).toBe(0)
})
