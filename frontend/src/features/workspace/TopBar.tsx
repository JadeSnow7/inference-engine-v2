import { Bell, CircleHelp, GraduationCap, ShieldCheck } from 'lucide-react'
import { SearchBox } from '../../components/workspace/SearchBox'
import { useUserStore } from '../../store/user'
import { useWorkspaceStore } from '../../store/workspace'
import type { WorkspaceSaveStatus } from '../../types/workspace'

export function TopBar() {
  const userId = useUserStore(state => state.userId)
  const saveStatus = useWorkspaceStore(state => state.saveStatus)
  const documentBlocks = useWorkspaceStore(state => state.documentBlocks)
  const setRestoreSessionNotice = useWorkspaceStore(state => state.setRestoreSessionNotice)
  const workspaceTitle = documentBlocks.find(block => block.type === 'heading')?.content ?? '研究工作台'

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-4 border-b border-scholar-border bg-white/90 px-5 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-scholar-primary to-scholar-discovery text-white shadow-lg shadow-blue-200">
          <GraduationCap size={21} />
        </div>
        <span className="whitespace-nowrap text-base font-bold tracking-tight">学术写作助手</span>
      </div>

      <div className="h-6 w-px bg-scholar-border" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-scholar-text-primary">
            {workspaceTitle}
          </span>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
            {getSaveStatusLabel(saveStatus)}
          </span>
        </div>
      </div>

      <SearchBox
        ariaLabel="工作台搜索"
        placeholder="搜索当前工作台"
        scope="workspace"
        wrapperClassName="relative hidden w-[300px] md:block"
        inputClassName="h-9 w-full rounded-xl border border-transparent bg-scholar-bg-canvas pl-9 pr-3 text-sm outline-none transition focus:border-scholar-primary/40 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />

      <button
        className="rounded-xl p-2 text-scholar-text-secondary transition hover:bg-scholar-bg-canvas hover:text-scholar-primary"
        aria-label="通知"
        onClick={() => setRestoreSessionNotice('暂无新通知')}
      >
        <Bell size={18} />
      </button>
      <button
        className="rounded-xl p-2 text-scholar-text-secondary transition hover:bg-scholar-bg-canvas hover:text-scholar-primary"
        aria-label="帮助"
        onClick={() => setRestoreSessionNotice('帮助：在文档中选中段落，然后使用底部 AI 输入框生成修改建议')}
      >
        <CircleHelp size={18} />
      </button>

      <div className="flex items-center gap-2 rounded-2xl border border-scholar-border bg-white px-2 py-1.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-blue-100 text-sm font-bold text-scholar-academic">
          张
        </div>
        <div className="hidden leading-tight lg:block">
          <div className="text-xs font-semibold">{userId ?? '张同学'}</div>
          <div className="flex items-center gap-1 text-[10px] text-emerald-600">
            <ShieldCheck size={10} />
            学术模式
          </div>
        </div>
      </div>
    </header>
  )
}

function getSaveStatusLabel(status: WorkspaceSaveStatus): string {
  switch (status) {
    case 'saved':
      return '已保存'
    case 'saving':
      return '保存中'
    case 'modified':
      return '已修改'
    case 'local-saved':
      return '已保存到本地'
    case 'error':
      return '保存失败'
  }
}
