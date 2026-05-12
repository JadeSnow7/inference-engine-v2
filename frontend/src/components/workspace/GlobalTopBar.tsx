import { Bell, Plus, Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../store/user'

export function GlobalTopBar() {
  const navigate = useNavigate()
  const userId = useUserStore(state => state.userId)

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-scholar-border bg-white/90 px-5 shadow-sm backdrop-blur">
      <div className="min-w-0 flex-1">
        <label className="relative flex max-w-[440px] items-center">
          <Search className="absolute left-3 text-scholar-text-weak" size={16} />
          <input
            disabled
            aria-label="全局搜索暂未接入"
            className="h-10 w-full rounded-xl border border-scholar-border bg-scholar-bg-canvas pl-9 pr-3 text-sm outline-none transition focus:border-scholar-primary/40 focus:bg-white focus:ring-4 focus:ring-blue-100"
            placeholder="全局搜索暂未接入"
          />
        </label>
      </div>

      <button
        className="hidden items-center gap-2 rounded-xl bg-scholar-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-scholar-primary-hover md:flex"
        onClick={() => navigate('/workbench')}
      >
        <Plus size={16} />
        新建
      </button>
      <button
        className="rounded-xl p-2 text-scholar-text-secondary transition hover:bg-scholar-bg-canvas hover:text-scholar-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-scholar-text-secondary"
        aria-label="通知暂未接入"
        disabled
      >
        <Bell size={18} />
      </button>
      <button
        className="rounded-xl p-2 text-scholar-text-secondary transition hover:bg-scholar-bg-canvas hover:text-scholar-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-scholar-text-secondary"
        aria-label="设置暂未接入"
        disabled
      >
        <Settings size={18} />
      </button>

      <div className="flex items-center gap-2 rounded-2xl border border-scholar-border bg-white px-2 py-1.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-blue-100 text-sm font-bold text-scholar-academic">
          张
        </div>
        <div className="hidden leading-tight lg:block">
          <div className="text-xs font-semibold">{userId ?? '张同学'}</div>
          <div className="text-[10px] text-emerald-600">学术模式</div>
        </div>
      </div>
    </header>
  )
}
