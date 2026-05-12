import { BookMarked, BookOpen, LayoutDashboard, Network, PenLine, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const mobileNavItems = [
  { label: '总览', path: '/', icon: LayoutDashboard },
  { label: '课程', path: '/courses', icon: BookOpen },
  { label: '工作台', path: '/workbench', icon: Sparkles },
  { label: '文献', path: '/library', icon: BookMarked },
  { label: '写作', path: '/writing', icon: PenLine },
  { label: '图谱', path: '/discovery', icon: Network },
]

export function GlobalMobileNav() {
  return (
    <nav aria-label="移动导航" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-6 border-t border-scholar-border bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
      {mobileNavItems.map(item => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
              isActive ? 'text-scholar-primary' : 'text-scholar-text-secondary'
            }`}
          >
            <Icon size={18} />
            <span className="truncate">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
