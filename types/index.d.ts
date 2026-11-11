export type WorkerStatus =
  | 'idle'
  | 'thinking'
  | 'typing'
  | 'reading'
  | 'terminal'
  | 'browsing'
  | 'delegating'
  | 'waiting'
  | 'leaving'

export type WorkerAction = { at: number; text: string }

export type Worker = {
  id: string
  name: string
  role: 'main' | 'subagent'
  type: string
  status: WorkerStatus
  tool: string
  detail: string
  desk: number
  look: number
  since: number
  arrivedAt: number
  leftAt: number
  cwd: string
  actions: WorkerAction[]
  toolCount: number
  tokensIn: number
  tokensOut: number
  turns: number
}

declare module 'claude-code' {
  interface PluginState {
    'pixel-office': {
      workers: Shaped<Worker[]>
      selected: string
    }
  }
}
