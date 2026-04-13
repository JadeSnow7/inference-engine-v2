import { Header } from './Header'
import { ChatPanel } from '../chat/ChatPanel'
import { InputBar } from '../chat/InputBar'
import { PanelTabs } from '../sidebar/PanelTabs'

export function Shell() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Main chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          <ChatPanel />
          <InputBar />
        </div>

        {/* Sidebar */}
        <aside className="w-72 shrink-0 border-l bg-white flex flex-col overflow-hidden">
          <PanelTabs />
        </aside>
      </div>
    </div>
  )
}
