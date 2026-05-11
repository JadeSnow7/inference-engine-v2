import { useEffect } from 'react'
import { useLayoutStore } from '../../store/layout'
import { useWorkspaceStore } from '../../store/workspace'
import { LeftSidebar } from './LeftSidebar'
import { MainWorkspace } from './MainWorkspace'
import { RightKnowledgePanel } from './RightKnowledgePanel'
import { TopBar } from './TopBar'

export function WorkspaceLayout() {
  const hydrateLocalDraft = useWorkspaceStore(state => state.hydrateLocalDraft)
  const setActiveSessionId = useWorkspaceStore(state => state.setActiveSessionId)
  const setRestoreSessionNotice = useWorkspaceStore(state => state.setRestoreSessionNotice)
  const workbenchContext = useLayoutStore(state => state.workbenchContext)
  const hydrateWorkbenchContext = useLayoutStore(state => state.hydrateWorkbenchContext)

  useEffect(() => {
    hydrateLocalDraft()
    hydrateWorkbenchContext()
  }, [hydrateLocalDraft, hydrateWorkbenchContext])

  useEffect(() => {
    const handleRestore = (event: Event) => {
      const { sessionId } = (event as CustomEvent<{ sessionId?: string }>).detail ?? {}
      if (!sessionId) return

      setActiveSessionId(sessionId)
      setRestoreSessionNotice('已载入历史会话，可继续生成修改建议')
    }

    window.addEventListener('restore-session', handleRestore)
    return () => window.removeEventListener('restore-session', handleRestore)
  }, [setActiveSessionId, setRestoreSessionNotice])

  return (
    <div className="h-screen w-full overflow-hidden bg-[#f6f7fb] text-scholar-text-primary">
      <TopBar />
      {workbenchContext && (
        <div className="border-b border-scholar-border bg-white px-5 py-2 text-xs text-scholar-text-secondary">
          <span className="font-semibold text-scholar-text-primary">当前研究上下文</span>
          <span className="mx-2 text-scholar-text-weak">/</span>
          <span>{workbenchContext.courseTitle ?? '空白工作台'}</span>
          <span className="mx-2 text-scholar-text-weak">/</span>
          <span className="font-medium text-scholar-primary">{workbenchContext.sourceTitle}</span>
        </div>
      )}
      <div className="flex h-[calc(100vh-60px)] min-h-0 gap-3 p-3">
        <LeftSidebar />
        <MainWorkspace />
        <RightKnowledgePanel />
      </div>
    </div>
  )
}
