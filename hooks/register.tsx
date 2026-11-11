import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Worker, WorkerStatus } from '../types'
import { drawOffice, statusWords, WALK_MS } from './office'

const PANE = 'pixel-office'
const TITLE = 'Pixel Office'
const MAIN = 'main'
const MAX_ACTIONS = 8

const workers = atom({ plugin: 'pixel-office', key: 'workers' } as const, [] as Worker[], {
  shape: 'workers-1',
})
const selected = atom({ plugin: 'pixel-office', key: 'selected' } as const, '')

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}

function clip(s: string, n: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? one.slice(0, n - 1) + '…' : one
}

const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead', 'ToolSearch'])
const SHELL_TOOLS = new Set(['Bash', 'PowerShell', 'BashOutput', 'KillShell', 'Monitor'])
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch'])
const ASK_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])
const AGENT_TOOLS = new Set(['Agent', 'Task', 'SendMessage'])

type Activity = { status: WorkerStatus; tool: string; detail: string }

function activityOf(tool: string, input: Record<string, unknown>): Activity {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  let detail = ''
  if (str('file_path')) detail = basename(str('file_path'))
  else if (str('notebook_path')) detail = basename(str('notebook_path'))
  else if (str('command')) detail = clip(str('command'), 24)
  else if (str('pattern')) detail = clip(str('pattern'), 18)
  else if (str('url')) detail = str('url').replace(/^https?:\/\//, '').split('/')[0]
  else if (str('query')) detail = clip(str('query'), 18)
  else if (str('description')) detail = clip(str('description'), 22)

  const short = tool.startsWith('mcp__') ? tool.split('__').slice(-1)[0] : tool
  let status: WorkerStatus = 'typing'
  if (WRITE_TOOLS.has(tool)) status = 'typing'
  else if (READ_TOOLS.has(tool)) status = 'reading'
  else if (SHELL_TOOLS.has(tool)) status = 'terminal'
  else if (WEB_TOOLS.has(tool) || /browser|chrome|navigate/i.test(tool)) status = 'browsing'
  else if (ASK_TOOLS.has(tool)) status = 'waiting'
  else if (AGENT_TOOLS.has(tool)) status = 'delegating'
  return { status, tool: clip(short, 16), detail }
}

function freeDesk(list: Worker[]): number {
  const used = new Set(list.map(w => w.desk))
  let d = 1
  while (used.has(d)) d++
  return d
}

function newWorker(fields: Partial<Worker> & Pick<Worker, 'id' | 'name' | 'role' | 'desk'>, now: number): Worker {
  return {
    type: fields.role === 'main' ? 'main agent' : 'subagent',
    status: 'idle',
    tool: '',
    detail: '',
    look: hash(fields.id === MAIN ? 'claude-main' : fields.id),
    since: now,
    arrivedAt: now,
    leftAt: 0,
    cwd: '',
    actions: [],
    toolCount: 0,
    tokensIn: 0,
    tokensOut: 0,
    turns: 0,
    ...fields,
  }
}

function patch(list: Worker[], id: string, fn: (w: Worker) => Worker): Worker[] {
  return list.map(w => (w.id === id ? fn(w) : w))
}

function pushAction(w: Worker, now: number, text: string): Worker['actions'] {
  return [...w.actions, { at: now, text }].slice(-MAX_ACTIONS)
}

function ago(now: number, at: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function tokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

const DOT: Record<WorkerStatus, string> = {
  idle: '○',
  thinking: '◔',
  typing: '●',
  reading: '●',
  terminal: '●',
  browsing: '●',
  delegating: '◑',
  waiting: '!',
  leaving: '✓',
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, workers, list => {
      const kept = list.filter(w => w.role === 'main' || w.status !== 'leaving')
      if (kept.some(w => w.id === MAIN)) return patch(kept, MAIN, w => ({ ...w, cwd: e.cwd }))
      return [newWorker({ id: MAIN, name: 'Claude', role: 'main', desk: 0, cwd: e.cwd }, now), ...kept]
    })
    await $.command.register({ name: 'office', description: 'Open the Pixel Office pane' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'office' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Pixel Office opened.' }
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    const id = e.agentId ?? MAIN
    let name = 'Agent'
    let type = 'subagent'
    if (e.agentId !== undefined) {
      try {
        const info = (await $.agent.list()).find(a => a.id === e.agentId)
        if (info) {
          name = clip(info.name || info.description || info.type, 20)
          type = info.type
        }
      } catch {
        // the list is a nicety; the agent still gets a desk
      }
    }
    await update($, workers, list => {
      const found = list.find(w => w.id === id)
      if (!found) {
        if (id === MAIN) {
          return [newWorker({ id, name: 'Claude', role: 'main', desk: 0, status: 'thinking' }, now), ...list]
        }
        const w = newWorker({ id, name, type, role: 'subagent', desk: freeDesk(list), status: 'thinking' }, now)
        return [...list, { ...w, actions: pushAction(w, now, 'arrived at the office') }]
      }
      return patch(list, id, w => ({
        ...w,
        status: 'thinking',
        tool: '',
        detail: '',
        since: now,
        leftAt: 0,
        turns: w.turns + 1,
        actions: id === MAIN && e.text ? pushAction(w, now, `prompt: ${clip(e.text, 40)}`) : w.actions,
      }))
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const now = await $.clock.now()
    const act = activityOf(String(e.tool), e as unknown as Record<string, unknown>)
    await update($, workers, list => {
      const base = list.some(w => w.id === id)
        ? list
        : [...list, newWorker({ id, name: 'Agent', role: 'subagent', desk: freeDesk(list) }, now)]
      return patch(base, id, w => ({
        ...w,
        ...act,
        since: now,
        toolCount: w.toolCount + 1,
        actions: pushAction(w, now, `${act.tool}${act.detail ? ' ' + act.detail : ''}`),
      }))
    })
    try {
      return await next(e)
    } finally {
      await update($, workers, list =>
        patch(list, id, w =>
          (w.since === now || w.status === 'waiting') && w.status !== 'leaving'
            ? { ...w, status: 'thinking', tool: '', detail: '' }
            : w,
        ),
      )
    }
  }).catch(($, e, next) => next(e)) // the office never stands in a tool's way

  // A call that will be put to the person: raise the "!" until it runs. An ask
  // that a mode's own check answers (auto mode) is nobody's to answer here.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.approver === 'person' && e.tool_use_id !== undefined) {
      const id = e.agentId ?? MAIN
      const act = activityOf(e.tool, (e.input ?? {}) as Record<string, unknown>)
      const now = await $.clock.now()
      await update($, workers, list =>
        patch(list, id, w => ({
          ...w,
          status: 'waiting',
          tool: act.tool,
          detail: act.detail,
          since: now,
          actions: pushAction(w, now, `asked permission: ${act.tool}`),
        })),
      )
    }
    return verdict
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const now = await $.clock.now()
    const used = e.usage
    const tin = used ? used.input_tokens + (used.cache_read_input_tokens ?? 0) + (used.cache_creation_input_tokens ?? 0) : 0
    const tout = used ? used.output_tokens : 0
    await update($, workers, list =>
      patch(list, id, w => ({
        ...w,
        status: id === MAIN ? 'idle' : 'leaving',
        tool: '',
        detail: '',
        since: now,
        leftAt: id === MAIN ? 0 : now,
        tokensIn: w.tokensIn + tin,
        tokensOut: w.tokensOut + tout,
        actions: pushAction(w, now, e.isAborted ? 'interrupted' : id === MAIN ? 'turn finished' : 'finished, heading out'),
      })),
    )
    if (id !== MAIN) {
      $.clock.after(WALK_MS + 600, () => {
        void update($, workers, list => list.filter(w => !(w.id === id && w.status === 'leaving' && w.leftAt === now)))
      })
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, workers)
    const sel = await read($, selected)
    const now = await $.clock.now()
    const columns = e.props.bodyColumns ?? e.viewport?.columns ?? 80
    const picked = list.find(w => w.id === sel)
    const busy = list.filter(w => w.status !== 'idle' && w.status !== 'leaving').length

    const choose = (id: string) => () => update($, selected, cur => (cur === id ? '' : id))

    const details = (w: Worker, Box: any, Text: any) => (
      <Box flexDirection="column" borderStyle="round" paddingX={1} marginTop={1}>
        <Text bold>
          {w.name} <Text dimColor>· {w.type}</Text>
        </Text>
        <Text>Status: {statusWords(w)} <Text dimColor>({ago(now, w.since)})</Text></Text>
        {w.cwd !== '' && <Text dimColor>Folder: {w.cwd}</Text>}
        <Text dimColor>
          In the office {ago(now, w.arrivedAt)} · {w.toolCount} tool calls · {w.turns} turns
        </Text>
        <Text dimColor>
          Tokens: {tokens(w.tokensIn)} in · {tokens(w.tokensOut)} out
        </Text>
        <Text bold>Recent</Text>
        {w.actions.length === 0 && <Text dimColor>nothing yet</Text>}
        {[...w.actions].reverse().map(a => (
          <Text>
            <Text dimColor>{ago(now, a.at).padStart(4)} </Text>
            {a.text}
          </Text>
        ))}
      </Box>
    )

    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      return (
        <Box flexDirection="column" width={columns}>
          <Text bold>
            Pixel Office <Text dimColor>· {busy} working · open in the desktop app to see the pixel view</Text>
          </Text>
          {list.map(w => (
            <Button key={w.id} plain onPress={choose(w.id)}>
              {DOT[w.status]} {w.name} <Text dimColor>{statusWords(w)}</Text>
            </Button>
          ))}
          {picked && details(picked, Box, Text)}
        </Box>
      )
    }

    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const hour = new Date(now).getHours()
    const { svg } = drawOffice(list, { now, selected: sel, isNight: hour >= 19 || hour < 7 })
    const alt = list.map(w => `${w.name}: ${statusWords(w)}`).join('; ') || 'An empty office'
    return (
      <Box flexDirection="column">
        <Svg source={svg} alt={alt} />
        <Text dimColor>
          {busy} working · {list.length} in the office · click a name to label them in the office and see details
        </Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          {list.map(w => (
            <Button key={w.id} variant={w.id === sel ? 'primary' : 'secondary'} onPress={choose(w.id)}>
              {DOT[w.status]} {w.name} <Text dimColor>{w.status === 'waiting' ? 'needs you' : w.status}</Text>
            </Button>
          ))}
        </Box>
        {picked && details(picked, Box, Text)}
      </Box>
    )
  })
}
