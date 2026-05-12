import { BookMarked, BookOpen, LayoutDashboard, Network, PenLine, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { label: '总览', path: '/', icon: LayoutDashboard },
  { label: '课程', path: '/courses', icon: BookOpen },
  { label: '学术工作台', path: '/workbench', icon: Sparkles },
  { label: '文献库', path: '/library', icon: BookMarked },
  { label: '知识图谱', path: '/discovery', icon: Network },
  { label: 'AI 写作', path: '/writing', icon: PenLine },
]

export function GlobalSidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-scholar-border bg-scholar-bg-surface">
      <div className="flex h-16 items-center border-b border-scholar-border px-5">
        <NavLink to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-scholar-primary">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-scholar-primary text-sm font-black text-white">S</span>
          <span>ScholarScript</span>
        </NavLink>
      </div>

      <nav aria-label="全局导航" className="flex-1 space-y-1.5 px-3 py-4">
        {navItems.map(item => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'bg-blue-50 font-semibold text-scholar-primary'
                  : 'font-medium text-scholar-text-secondary hover:bg-gray-100 hover:text-scholar-text-primary'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
