import { expect, test } from 'claude-code/testing'
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
