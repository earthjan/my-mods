export type Status = 'pending' | 'in_progress' | 'completed'

export type Step = {
  id: string
  title: string
  status: Status
  startedAt?: number
  finishedAt?: number
  errors: number
}

export type Run = {
  id: string
  label: string
  startedAt: number
  isWaiting: boolean
  agent?: { title: string; model?: string }
}

export type AgentDone = { title: string; finishedAt: number }

export type Board = {
  steps: Step[]
  runs: Run[]
  agentsDone: AgentDone[]
  startedAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'task-board': { board: Shaped<Board> }
  }
}
