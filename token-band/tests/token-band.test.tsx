import { expect, mock, test } from 'claude-code/testing'
import type { On, TurnUsage } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

const BAND = {
  plugin: 'token-band',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const TURN = {
  answer: 'done',
  durationMs: 1000,
  isAborted: false,
  reason: 'answer',
} as const

const HOUR = 3_600_000
const T0 = 1_700_000_000_000

const memoryStore = (on: On, entries: Record<string, unknown>) => {
  on('store.get', (_, e) => ({ value: entries[e.key] }))
  on('store.set', (_, e) => {
    entries[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', (_, e) => {
    delete entries[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(entries) }))
}

const engine = (on: On, store: Record<string, unknown> = {}) => {
  on('turn.complete', () => ({ text: 'done' }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.id', () => ({ value: 'me' }))
  memoryStore(on, store)
  return mock.clock(on, { now: T0 })
}

const usage = (over: Partial<TurnUsage> = {}): TurnUsage => ({
  model: 'claude-opus-5-5',
  input_tokens: 500,
  output_tokens: 1000,
  cache_read_input_tokens: 20000,
  cache_creation_input_tokens: 2000,
  ...over,
})

const measure = (
  percentUsed: number,
  resetsAt: number,
  context = 40000,
  usd?: number,
) => ({
  context: { tokens: context, window: 200000 },
  ...(usd === undefined ? {} : { cost: { usd } }),
  rateLimits: [
    { kind: 'five_hour', percentUsed: 90 },
    {
      kind: 'seven_day',
      percentUsed,
      resetsAt: new Date(resetsAt).toISOString(),
    },
  ],
  changed: ['rateLimits' as const],
})

type Band = {
  badges?: string
  cause?: string
  mineColor?: unknown
  levelColor?: unknown
  weeklyColor?: unknown
}

type Pill = { label: string; values: string[]; colors: unknown[] }

const PILLS = ['mine', 'account'] as const

const unescape = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

const desktopPill = (source: string): Pill => {
  const segments = [...source.matchAll(
    /<rect[^>]*fill="([^"]+)"\/><text[^>]*>([^<]*)<\/text>/g,
  )]
  const [label, ...values] = segments
  return {
    label: unescape(label?.[2] ?? ''),
    values: values.map(v => unescape(v[2] ?? '')),
    colors: values.map(v => v[1]),
  }
}

type Drawn = { props: Record<string, unknown>; children: unknown[] }

const textOf = (part: unknown): string =>
  String((part as Drawn | undefined)?.children?.[0] ?? '').trim()

const terminalPill = (pill: Drawn | undefined): Pill => {
  const [label, ...values] = pill?.children ?? []
  return {
    label: textOf(label),
    values: values.map(textOf),
    colors: values.map(v => (v as Drawn).props.backgroundColor),
  }
}

type Mounted = Awaited<ReturnType<Parameters<TestBody>[0]['ui']['mount']>>

const readPill = async (
  ui: Pick<Mounted, 'find'>,
  key: string,
  surface: 'terminal' | 'desktop',
): Promise<Pill> => {
  if (surface === 'terminal') return terminalPill(await ui.find({ key }))
  const box = await ui.find({ key: `${key}-svg` })
  const svg = box?.children[0] as Drawn | undefined
  return desktopPill(String(svg?.props.source ?? ''))
}

const readSurface = async (
  $: Parameters<TestBody>[0],
  surface: 'terminal' | 'desktop',
): Promise<Band> => {
  const ui = await $.ui.mount({ ...BAND, surface })
  const cause = (await ui.find({ key: 'note' }))?.text
  const [mine, account] = await Promise.all(
    PILLS.map(key => readPill(ui, key, surface)),
  )
  await ui.unmount()
  const show = (p: Pill) => [p.label, ...p.values].join(' ')
  return {
    badges: [mine, account].map(p => show(p as Pill)).join(' · '),
    cause,
    mineColor: mine?.colors[0],
    levelColor: (account?.colors.length ?? 0) > 1 ? account?.colors[0] : undefined,
    weeklyColor: account?.colors.at(-1),
  }
}

const readBand = async ($: Parameters<TestBody>[0]) => {
  const terminal = await readSurface($, 'terminal')
  const desktop = await readSurface($, 'desktop')
  expect(terminal).toEqual(desktop)
  return desktop
}

test('session tokens sum every turn, subagents included', async ($, on) => {
  engine(on)
  await $.turn.complete({
    ...TURN,
    turnId: 't1',
    agentId: 'sub-1',
    usage: usage({ input_tokens: 500, cache_creation_input_tokens: 0 }),
  })
  await $.turn.complete({
    ...TURN,
    turnId: 't2',
    usage: usage({ input_tokens: 1000, cache_read_input_tokens: 10000 }),
  })

  expect(await readBand($)).toEqual({
    badges: 'session no estimate 35.5k · account no reading',
    mineColor: '#9f9f9f',
    weeklyColor: '#9f9f9f',
  })
})

test('a pace that runs out before reset is level 4', async ($, on) => {
  const clock = engine(on)
  await $.session.measure(measure(40, T0 + 74 * HOUR))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(44, T0 + 74 * HOUR))

  expect(await readBand($)).toEqual({
    badges: 'session no estimate 0 · account 4 · 1d 4h 0 w-44%',
    mineColor: '#9f9f9f',
    cause: 'weekly % rising fast, check other sessions',
    levelColor: '#fe7d37',
    weeklyColor: '#44cc11',
  })
})

test('a pace that runs out within a day is level 5', async ($, on) => {
  const clock = engine(on)
  await $.session.measure(measure(60, T0 + 74 * HOUR))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(70, T0 + 74 * HOUR))

  const band = await readBand($)
  expect(band.badges).toMatch(/account 5 · 6h 0 w-/)
  expect(band.levelColor).toBe('#e05d44')
})

test('under an hour left reads as less than an hour', async ($, on) => {
  const clock = engine(on)
  await $.session.measure(measure(90, T0 + 74 * HOUR))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(99, T0 + 74 * HOUR))

  expect((await readBand($)).badges).toMatch(/account 5 · <1h 0 w-/)
})

test('a slow pace is level 1 with nothing to blame', async ($, on) => {
  const clock = engine(on)
  await $.session.measure(measure(40, T0 + 26 * HOUR))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(41, T0 + 26 * HOUR))

  expect(await readBand($)).toEqual({
    badges: 'session no estimate 0 · account 1 0 w-41%',
    mineColor: '#9f9f9f',
    levelColor: '#44cc11',
    weeklyColor: '#44cc11',
  })
})

test('a projection near the limit is level 3', async ($, on) => {
  const clock = engine(on)
  await $.session.measure(measure(70, T0 + 26 * HOUR))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(71, T0 + 26 * HOUR))

  const band = await readBand($)
  expect(band.badges).toMatch(/account 3 0 w-/)
  expect(band.levelColor).toBe('#dfb317')
})

test('before the pace is known, the weekly % sets the level', async ($, on) => {
  engine(on)
  await $.session.measure(measure(96, T0 + 26 * HOUR))

  expect((await readBand($)).badges).toMatch(/account 5 0 w-/)
})

test('the weekly badge is coloured by how much of the week is used', async ($, on) => {
  engine(on)
  const cases: [number, string][] = [
    [49, '#44cc11'],
    [50, '#97ca00'],
    [70, '#dfb317'],
    [85, '#fe7d37'],
    [95, '#e05d44'],
  ]
  for (const [percent, color] of cases) {
    await $.session.measure(measure(percent, T0 + 26 * HOUR))
    expect((await readBand($)).weeklyColor).toBe(color)
  }
})

test('a big conversation is named as the cause', async ($, on) => {
  engine(on)
  await $.session.measure(measure(40, T0 + 26 * HOUR, 160000))

  expect(await readBand($)).toEqual({
    badges: 'session no estimate 0 · account 1 0 w-40%',
    mineColor: '#9f9f9f',
    cause: 'big conversation, 160k re-read each turn',
    levelColor: '#44cc11',
    weeklyColor: '#44cc11',
  })
})

test('the two pills and the note share one row that wraps', async ($, on) => {
  engine(on)
  await $.session.measure(measure(40, T0 + 26 * HOUR, 160000))

  for (const surface of ['terminal', 'desktop'] as const) {
    for (const bodyColumns of [60, 200]) {
      const ui = await $.ui.mount({
        ...BAND,
        surface,
        props: { ...BAND.props, bodyColumns },
      })
      const band = await ui.find({ key: 'band' })
      const pills = await Promise.all(
        PILLS.map(key => ui.find({ key })),
      )
      const boxes = await ui.findAll({ type: 'Box' })
      const note = await ui.find({ key: 'note' })
      await ui.unmount()

      expect(band?.props.flexDirection).toBe('row')
      expect(band?.props.flexWrap).toBe('wrap')
      expect(band?.props.rowGap).toBe(surface === 'desktop' ? 1 : 0)
      for (const pill of pills) {
        expect(pill?.props.flexShrink).toBe(0)
      }
      expect(boxes.some(b => b.key?.startsWith('divider'))).toBe(false)
      expect(note?.text).toBe('big conversation, 160k re-read each turn')
    }
  }
})

test('alone on the machine, the session carries the whole pace', async ($, on) => {
  const clock = engine(on)
  await $.session.measure(measure(40, T0 + 74 * HOUR, 40000, 0))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(44, T0 + 74 * HOUR, 40000, 2))

  const band = await readBand($)
  expect(band.badges).toMatch(/^session 4 · 1d 4h 0 · /)
  expect(band.mineColor).toBe('#fe7d37')
})

test('a busier session elsewhere takes its share of the pace', async ($, on) => {
  const peer = { usdPerMs: 7 / HOUR, at: T0 + 2 * HOUR }
  const clock = engine(on, { 'session:other': peer })
  await $.session.measure(measure(40, T0 + 74 * HOUR, 40000, 0))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(44, T0 + 74 * HOUR, 40000, 2))

  const band = await readBand($)
  expect(band.badges).toBe(
    'session 2 0 · account 4 · 1d 4h 0 w-44%',
  )
  expect(band.mineColor).toBe('#97ca00')
})

test('a session idle for over half an hour is left out', async ($, on) => {
  const peer = { usdPerMs: 7 / HOUR, at: T0 + HOUR - 60_000 }
  const clock = engine(on, { 'session:other': peer })
  await $.session.measure(measure(40, T0 + 74 * HOUR, 40000, 0))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(44, T0 + 74 * HOUR, 40000, 2))

  expect((await readBand($)).badges).toMatch(/^session 4 · 1d 4h 0 · /)
})

test('the session publishes its spend rate for the others', async ($, on) => {
  const store: Record<string, unknown> = {}
  const clock = engine(on, store)
  await $.session.measure(measure(40, T0 + 74 * HOUR, 40000, 0))
  await clock.advance(2 * HOUR)
  await $.session.measure(measure(44, T0 + 74 * HOUR, 40000, 2))

  expect(store['session:me']).toEqual({
    usdPerMs: 1 / HOUR,
    at: T0 + 2 * HOUR,
  })
})

test('the session estimate waits for ten minutes of spend', async ($, on) => {
  engine(on)
  await $.session.measure(measure(40, T0 + 74 * HOUR, 40000, 0))

  const band = await readBand($)
  expect(band.badges).toMatch(/^session measuring 0 · /)
  expect(band.mineColor).toBe('#9f9f9f')
})

test('a cache miss outranks every other cause', async ($, on) => {
  engine(on)
  await $.session.measure(measure(40, T0 + 26 * HOUR, 160000))
  await $.turn.complete({
    ...TURN,
    turnId: 't1',
    usage: usage({ cache_creation_input_tokens: 120000 }),
  })

  expect((await readBand($)).cause).toBe('cache miss, 120k re-written')
})

test('a subagent fan-out is named as the cause', async ($, on) => {
  engine(on)
  for (const agentId of ['a1', 'a2', 'a2', 'a3']) {
    await $.turn.complete({ ...TURN, turnId: agentId, agentId, usage: usage() })
  }
  await $.turn.complete({ ...TURN, turnId: 'main', usage: usage() })

  expect((await readBand($)).cause).toBe('subagents, 3 ran last turn')
})

test('the next turn clears a cause that has passed', async ($, on) => {
  engine(on)
  for (const agentId of ['a1', 'a2', 'a3']) {
    await $.turn.complete({ ...TURN, turnId: agentId, agentId, usage: usage() })
  }
  await $.turn.complete({ ...TURN, turnId: 'm1', usage: usage() })
  await $.turn.complete({ ...TURN, turnId: 'm2', usage: usage() })

  expect(await readBand($)).toEqual({
    badges: 'session no estimate 117.5k · account no reading',
    mineColor: '#9f9f9f',
    weeklyColor: '#9f9f9f',
  })
})

test('the Fable model is named as the cause', async ($, on) => {
  engine(on)
  await $.turn.complete({
    ...TURN,
    turnId: 't1',
    usage: usage({ model: 'claude-fable-5-1' }),
  })

  expect((await readBand($)).cause).toBe('Fable model, priciest tier')
})

test('long output or thinking is named as the cause', async ($, on) => {
  engine(on)
  await $.turn.complete({
    ...TURN,
    turnId: 't1',
    usage: usage({ output_tokens: 25000 }),
  })

  expect((await readBand($)).cause).toBe('long output or thinking, 25k')
})

test('the weekly reading is taken when the session starts', async ($, on) => {
  mock.clock(on, { now: T0 })
  memoryStore(on, {})
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({
    value: { startedAt: T0, ...measure(40, T0 + 26 * HOUR) },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  expect((await readBand($)).badges).toBe(
    'session no estimate 0 · account 1 0 w-40%',
  )
})

test('the account total adds every session since the weekly reset', async ($, on) => {
  const resetsAt = T0 + 26 * HOUR
  engine(on, {
    'window:other': { resetsAt, tokens: 100000 },
    'window:old': { resetsAt: resetsAt - 168 * HOUR, tokens: 999999 },
  })
  await $.session.measure(measure(40, resetsAt))
  await $.turn.complete({ ...TURN, turnId: 't1', usage: usage() })

  expect((await readBand($)).badges).toBe(
    'session no estimate 23.5k · account 1 123.5k w-40%',
  )
})

test('a session that runs past the reset counts again from zero', async ($, on) => {
  engine(on)
  await $.session.measure(measure(90, T0 + HOUR))
  await $.turn.complete({ ...TURN, turnId: 't1', usage: usage() })
  await $.session.measure(measure(1, T0 + 169 * HOUR))
  await $.turn.complete({ ...TURN, turnId: 't2', usage: usage() })

  expect((await readBand($)).badges).toMatch(/^session no estimate 47k · account 1 23.5k w-1%/)
})

test('the band stays empty before anything is measured', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})
