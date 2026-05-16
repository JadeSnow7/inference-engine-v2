import {
  BookMarked,
  Bot,
  FileClock,
  FolderOpen,
  HelpCircle,
  Maximize2,
  Network,
  NotebookPen,
  Paperclip,
  Plus,
  Settings,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { SearchBox } from '../../components/workspace/SearchBox'
import { SettingsDialog } from '../../components/workspace/SettingsDialog'
import { useWorkspaceStore } from '../../store/workspace'
import { VersionList } from '../version/VersionList'

const resourceItems = [
  { label: '我的文献库', count: 128, icon: BookMarked },
  { label: '知识图谱', count: 66, icon: Network },
  { label: '笔记', count: 24, icon: NotebookPen },
  { label: '附件', count: 15, icon: Paperclip },
]

export function LeftSidebar() {
  const activeConversationId = useWorkspaceStore(state => state.activeConversationId)
  const setRightPanelMode = useWorkspaceStore(state => state.setRightPanelMode)
  const resetWorkspace = useWorkspaceStore(state => state.resetWorkspace)
  const setRestoreSessionNotice = useWorkspaceStore(state => state.setRestoreSessionNotice)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleResourceClick = (label: string) => {
    if (label === '知识图谱') {
      setRightPanelMode('graph')
    } else {
      setRightPanelMode('evidence')
    }
    setRestoreSessionNotice(`已切换到${label}`)
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border border-scholar-border bg-white shadow-sm">
      <div className="p-4">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-scholar-primary to-scholar-discovery px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-100 transition hover:brightness-105"
          onClick={() => {
            resetWorkspace()
            setRestoreSessionNotice('已开始新对话')
          }}
        >
          <Plus size={16} />
          新建对话
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        <section>
          <SectionTitle icon={<Bot size={15} />} title="对话历史" />
          <SearchBox
            ariaLabel="对话搜索"
            placeholder="搜索对话"
            scope="conversations"
            wrapperClassName="relative mb-3"
            inputClassName="h-9 w-full rounded-xl border border-scholar-border bg-scholar-bg-canvas pl-9 pr-3 text-xs outline-none transition focus:border-scholar-primary/40 focus:bg-white"
          />
          <div className="rounded-xl border border-scholar-border bg-scholar-bg-canvas p-3 text-xs text-scholar-text-secondary">
            {activeConversationId ? `当前会话：${activeConversationId}` : '暂无已恢复的历史会话'}
          </div>
        </section>

        <section>
          <SectionTitle icon={<FileClock size={15} />} title="文档版本" />
          <VersionList />
        </section>

        <section>
          <SectionTitle icon={<FolderOpen size={15} />} title="资源库" />
          <div className="space-y-1.5">
            {resourceItems.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-scholar-text-secondary transition hover:bg-scholar-bg-canvas hover:text-scholar-primary"
                  onClick={() => handleResourceClick(item.label)}
                >
                  <Icon size={15} />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs text-scholar-text-weak">{item.count}</span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <div className="flex items-center justify-around border-t border-scholar-border bg-scholar-bg-canvas/60 p-3">
        <SidebarTool label="设置" icon={<Settings size={16} />} onClick={() => setIsSettingsOpen(true)} />
        <SidebarTool label="帮助" icon={<HelpCircle size={16} />} onClick={() => setRestoreSessionNotice('提示：选择正文段落后，可在底部输入修改或规范审查需求')} />
        <SidebarTool label="全屏" icon={<Maximize2 size={16} />} onClick={() => void document.documentElement.requestFullscreen?.()} />
      </div>
      {isSettingsOpen && <SettingsDialog onClose={() => setIsSettingsOpen(false)} />}
    </aside>
  )
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-bold text-scholar-text-primary">
      {icon}
      {title}
    </div>
  )
}

function SidebarTool({ icon, label, onClick, disabled = false }: { icon: ReactNode; label: string; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      className="rounded-xl p-2 text-scholar-text-secondary transition hover:bg-white hover:text-scholar-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-scholar-text-secondary"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  )
}
