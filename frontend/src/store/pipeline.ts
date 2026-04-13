import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

interface PipelineState {
  currentStage: string | null
  stageHistory: string[]
  setStage: (stage: string) => void
  clearStages: () => void
}

export const usePipelineStore = create<PipelineState>()(
  immer((set) => ({
    currentStage: null,
    stageHistory: [],

    setStage: (stage) => set((s) => {
      s.currentStage = stage
      s.stageHistory.push(stage)
    }),

    clearStages: () => set((s) => {
      s.currentStage = null
      s.stageHistory = []
    }),
  })),
)
