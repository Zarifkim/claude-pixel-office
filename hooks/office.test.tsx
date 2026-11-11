import { expect, test } from 'claude-code/testing'

import type { Worker } from '../types'
import { drawOffice } from './office'

// The desktop draws the office as an image, which refuses XML a page would forgive.
test('the office SVG is strict XML: no tag repeats an attribute', async () => {
  const w = (id: string, desk: number, status: Worker['status'], at: number): Worker => ({
    id, name: id, role: id === 'main' ? 'main' : 'subagent', type: 'Explore', status, tool: 'Bash', detail: 'a < b & "c"',
    desk, look: desk * 7919, since: 0, arrivedAt: at, leftAt: at, cwd: '', actions: [], toolCount: 0, tokensIn: 0, tokensOut: 0, turns: 0,
  })
  for (const isNight of [false, true]) {
    const { svg } = drawOffice(
      [w('main', 0, 'idle', 0), w('a', 1, 'waiting', 0), w('b', 2, 'typing', 1000), w('c', 3, 'leaving', 1000), w('d', 4, 'thinking', 0)],
      { now: 1500, selected: 'a', isNight },
    )
    expect(svg.length).toBeLessThan(131072)
    for (const tag of svg.matchAll(/<([a-zA-Z]+)((?:\s+[^\s=>/]+="[^"]*")*)\s*\/?>/g)) {
      const names = [...tag[2].matchAll(/\s([^\s=]+)=/g)].map(m => m[1])
      expect(new Set(names).size).toBe(names.length)
    }
    expect(svg).not.toContain('a < b')
  }
})

const PANE = {
  plugin: 'pixel-office',
  component: 'Pane',
  requestId: 'pixel-office',
  props: {
    title: 'Pixel Office',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('Claude and a subagent show up, and a name opens the details', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('command.register',() => ({ value: { command: 'office' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [{ id: 'a9', description: 'Odd hash', type: 'unknown-type', status: 'running' }, { id: 'a1',description: 'Explore repo', type: 'Explore', status: 'running' }] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/work', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1', agentId: 'a1' })
  for (let i = 0; i < 40; i++) await $.turn.start({ text: '', turnId: 'x' + i, agentId: 'agent-' + i.toString(16) + 'f7c3' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Button', key: 'a1' })).toBeTruthy()
    await ui.press({ key: 'main' })
    expect((await ui.find({ type: 'Text', text: /Folder: \/work/ }))?.text).toContain('/work')
    await ui.press({ key: 'main' })
    await ui.unmount()
  }
})
