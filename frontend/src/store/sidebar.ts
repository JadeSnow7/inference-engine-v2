import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { PaperItem, GapItem } from '../types/events'

interface SidebarState {
  papers: PaperItem[]
  gaps: GapItem[]
  activeTab: 'papers' | 'gaps'
  setPapers: (papers: PaperItem[]) => void
  setGaps: (gaps: GapItem[]) => void
  setActiveTab: (tab: 'papers' | 'gaps') => void
  clear: () => void
}

export const useSidebarStore = create<SidebarState>()(
  immer((set) => ({
    papers: [],
    gaps: [],
    activeTab: 'papers',

    setPapers: (papers) => set((s) => {
      s.papers = papers
      s.activeTab = 'papers' // auto-switch per spec
    }),

    setGaps: (gaps) => set((s) => { s.gaps = gaps }),

    setActiveTab: (tab) => set((s) => { s.activeTab = tab }),

    clear: () => set((s) => {
      s.papers = []
      s.gaps = []
    }),
  })),
)
