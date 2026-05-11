import { create } from 'zustand';

export interface WorkbenchContext {
  sourceTitle: string;
  actionType: 'outline' | 'review' | 'gap' | 'polish' | 'blank';
  courseTitle?: string;
  sourceType?: 'course' | 'paper' | 'lecture' | 'manual';
  createdAt: string;
}

export const WORKBENCH_CONTEXT_KEY = 'workbench:context:v1';

interface LayoutState {
  isMobile: boolean;
  setIsMobile: (val: boolean) => void;
  workbenchContext: WorkbenchContext | null;
  setWorkbenchContext: (ctx: WorkbenchContext | null) => void;
  hydrateWorkbenchContext: () => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (val: boolean) => void;
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage ?? null;
}

function readStoredWorkbenchContext(): WorkbenchContext | null {
  try {
    const raw = getSessionStorage()?.getItem(WORKBENCH_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkbenchContext>;
    if (!parsed.sourceTitle || !parsed.actionType || !parsed.createdAt) return null;
    return parsed as WorkbenchContext;
  } catch {
    return null;
  }
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isMobile: window.innerWidth < 1024,
  setIsMobile: (val) => set({ isMobile: val }),

  workbenchContext: readStoredWorkbenchContext(),
  setWorkbenchContext: (ctx) => {
    if (ctx) {
      getSessionStorage()?.setItem(WORKBENCH_CONTEXT_KEY, JSON.stringify(ctx));
    } else {
      getSessionStorage()?.removeItem(WORKBENCH_CONTEXT_KEY);
    }
    set({ workbenchContext: ctx });
  },
  hydrateWorkbenchContext: () => set({ workbenchContext: readStoredWorkbenchContext() }),

  isRightPanelOpen: false,
  setIsRightPanelOpen: (val) => set({ isRightPanelOpen: val }),
}));
