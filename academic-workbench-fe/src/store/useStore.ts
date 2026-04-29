import { create } from 'zustand';

interface GlobalState {
  isMobile: boolean;
  setIsMobile: (val: boolean) => void;
  // 工作台上下文数据 (用以接收从【课程】页面跳转过来的参数)
  workbenchContext: {
    sourceTitle?: string;
    actionType?: string; // 'outline' | 'review' | 'gap' | 'polish'
  } | null;
  setWorkbenchContext: (ctx: { sourceTitle?: string, actionType?: string } | null) => void;
  // 控制移动端辅助面板开关
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (val: boolean) => void;
}

export const useStore = create<GlobalState>((set) => ({
  isMobile: window.innerWidth < 1024,
  setIsMobile: (val) => set({ isMobile: val }),
  
  workbenchContext: null,
  setWorkbenchContext: (ctx) => set({ workbenchContext: ctx }),
  
  isRightPanelOpen: false,
  setIsRightPanelOpen: (val) => set({ isRightPanelOpen: val })
}));
