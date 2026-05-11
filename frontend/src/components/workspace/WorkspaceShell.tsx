import { Outlet } from 'react-router-dom'
import { GlobalSidebar } from './GlobalSidebar'
import { GlobalTopBar } from './GlobalTopBar'
import { WorkspaceRightPanel } from './WorkspaceRightPanel'

export function WorkspaceShell() {
  return (
    <div data-testid="workspace-shell" className="flex h-screen w-full overflow-hidden bg-scholar-bg-canvas text-scholar-text-primary">
      <GlobalSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <GlobalTopBar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <WorkspaceRightPanel />
    </div>
  )
}
