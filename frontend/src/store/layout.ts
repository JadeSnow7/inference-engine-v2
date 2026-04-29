import { create } from 'zustand';

interface LayoutState {
  isMobile: boolean;
  setIsMobile: (val: boolean) => void;
  workbenchContext: {
    sourceTitle?: string;
    actionType?: string; // 'outline' | 'review' | 'gap' | 'polish'
  } | null;
  setWorkbenchContext: (ctx: { sourceTitle?: string; actionType?: string } | null) => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (val: boolean) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  isMobile: window.innerWidth < 1024,
  setIsMobile: (val) => set({ isMobile: val }),

  workbenchContext: null,
  setWorkbenchContext: (ctx) => set({ workbenchContext: ctx }),

  isRightPanelOpen: false,
  setIsRightPanelOpen: (val) => set({ isRightPanelOpen: val }),
}));
