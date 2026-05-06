import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useLayoutStore } from '../../store/layout'
import { fetchSessions, deleteSession, type SessionItem } from '../../api/sessions'
import { LayoutDashboard, BookOpen, Sparkles, Network, Clock, Trash2, Loader2 } from 'lucide-react'

function useWindowSize() {
  const setIsMobile = useLayoutStore(state => state.setIsMobile)
  const [isMobile, setLocalIsMobile] = useState(window.innerWidth < 1024)

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024
      setLocalIsMobile(mobile)
      setIsMobile(mobile)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setIsMobile])

  return isMobile
}

// ── 右侧面板：证据 / 历史 ──────────────────────────────────────
type RightTab = 'evidence' | 'history'

function RightPanel({ currentPath }: { currentPath: string }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<RightTab>('evidence')
  const [sessions, setSessions]   = useState<SessionItem[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const loadSessions = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchSessions()
      setSessions(res.items)
    } catch {
      setError('加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'history') loadSessions()
  }, [activeTab])

  useEffect(() => {
    const handleHistoryChanged = () => {
      if (activeTab === 'history') {
        void loadSessions()
      }
    }
    window.addEventListener('session-history-changed', handleHistoryChanged)
    return () => window.removeEventListener('session-history-changed', handleHistoryChanged)
  }, [activeTab])

  const handleDelete = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.session_id !== sessionId))
    } catch { /* ignore */ }
  }

  const handleRestore = (sessionId: string) => {
    // Navigate to workbench first, then fire the restore event so Workbench
    // component has time to mount before receiving the event.
    navigate('/workbench')
    // Use a small delay to ensure the page has rendered before firing.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('restore-session', { detail: { sessionId } }))
    }, 50)
  }

  return (
    <aside className="w-80 flex-shrink-0 border-l border-scholar-border bg-scholar-bg-surface flex flex-col transition-all">
      {/* Tab 切换 */}
      <div className="border-b border-scholar-border bg-gray-50/50 shrink-0">
        <div className="flex">
          <TabButton active={activeTab === 'evidence'} onClick={() => setActiveTab('evidence')}>
            <span className="w-2 h-2 rounded-full bg-scholar-primary mr-1.5" />
            上下文证据
          </TabButton>
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            <Clock size={13} className="mr-1.5" />
            历史记录
          </TabButton>
        </div>

        {/* 证据 tab 的追踪来源按钮 */}
        {activeTab === 'evidence' && currentPath === '/workbench' && (
          <div className="px-4 pb-2">
            <button className="text-xs font-medium text-scholar-primary bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors">
              追踪来源
            </button>
          </div>
        )}
      </div>

      {/* 证据面板 */}
      {activeTab === 'evidence' && (
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fafbfc]">
          <EvidenceCard title="Generative AI in Academic Contexts" source="Nature Review, 2024" />
          <EvidenceCard title="The Economics of Information Access" source="Journal of Finance, 2023" />
        </div>
      )}

      {/* 历史面板 */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto bg-[#fafbfc]">
          {loading && (
            <div className="flex items-center justify-center h-32 text-scholar-text-weak">
              <Loader2 size={20} className="animate-spin mr-2" />
              <span className="text-sm">加载中…</span>
            </div>
          )}

          {error && (
            <div className="p-4">
              <p className="text-sm text-red-500 mb-2">{error}</p>
              <button
                onClick={loadSessions}
                className="text-xs text-scholar-primary hover:underline"
              >
                重新加载
              </button>
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-scholar-text-weak">
              <Clock size={24} className="mb-2 opacity-40" />
              <p className="text-sm">暂无历史记录</p>
            </div>
          )}

          {!loading && sessions.map(s => (
            <SessionCard key={s.session_id} session={s} onDelete={handleDelete} onRestore={handleRestore} />
          ))}
        </div>
      )}
    </aside>
  )
}

function TabButton({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center px-3 py-3 text-xs font-semibold transition-colors border-b-2 ${
        active
          ? 'text-scholar-primary border-scholar-primary bg-white'
          : 'text-scholar-text-secondary border-transparent hover:text-scholar-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

function SessionCard({
  session,
  onDelete,
  onRestore,
}: {
  session: SessionItem
  onDelete: (id: string, e: React.MouseEvent) => void
  onRestore: (id: string) => void
}) {
  const date = new Date(session.updated_at * 1000)
  const dateStr = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="group flex items-start justify-between px-4 py-3 border-b border-scholar-border hover:bg-white cursor-pointer transition-colors"
      onClick={() => onRestore(session.session_id)}
      title="点击恢复此会话"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-scholar-text-primary truncate leading-snug">{session.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-scholar-text-weak">{dateStr}</span>
          {session.scene && (
            <span className="text-[10px] text-scholar-academic bg-blue-50 px-1.5 py-0.5 rounded font-medium">
              {session.scene}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => onDelete(session.session_id, e)}
        className="shrink-0 ml-2 p-1 rounded text-scholar-text-weak opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
        title="删除会话"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}


function EvidenceCard({ title, source }: { title: string; source: string }) {
  return (
    <div className="p-3 border border-scholar-border rounded-xl bg-scholar-bg-surface hover:border-scholar-primary/50 transition-colors shadow-sm cursor-pointer">
      <h4 className="text-sm font-bold text-scholar-text-primary leading-tight mb-1.5 line-clamp-2">{title}</h4>
      <div className="flex items-center text-[11px] text-scholar-text-weak font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-300 mr-1.5" />
        {source}
      </div>
    </div>
  )
}

// ── 主布局 ─────────────────────────────────────────────────────
export default function WorkbenchLayout() {
  const isMobile = useWindowSize()
  const navigate = useNavigate()
  const location = useLocation()
  const isRightPanelOpen    = useLayoutStore(state => state.isRightPanelOpen)
  const setIsRightPanelOpen = useLayoutStore(state => state.setIsRightPanelOpen)

  const currentPath = location.pathname
  const isDashboard = currentPath === '/'

  if (!isMobile) {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-scholar-bg-canvas text-scholar-text-primary">
        {/* 左侧导航 */}
        <nav className="w-56 flex-shrink-0 border-r border-scholar-border bg-scholar-bg-surface flex flex-col">
          <div className="p-5 border-b border-scholar-border mb-4 cursor-pointer" onClick={() => navigate('/')}>
            <h1 className="text-xl font-bold tracking-tight text-scholar-primary flex items-center space-x-2">
              <span className="w-6 h-6 bg-scholar-primary text-white flex items-center justify-center rounded-md text-sm font-black">S</span>
              <span>Scholar<span className="font-light">Script</span></span>
            </h1>
          </div>
          <div className="flex-1 px-3 space-y-1.5">
            <NavItem icon={<LayoutDashboard size={18} />} label="总览"     path="/"          currentPath={currentPath} onClick={() => navigate('/')} />
            <NavItem icon={<BookOpen size={18} />}        label="课程"     path="/courses"    currentPath={currentPath} onClick={() => navigate('/courses')} />
            <NavItem icon={<Sparkles size={18} />}        label="学术工作台" path="/workbench"  currentPath={currentPath} onClick={() => navigate('/workbench')} />
            <NavItem icon={<Network size={18} />}         label="知识图谱"  path="/discovery"  currentPath={currentPath} onClick={() => navigate('/discovery')} />
          </div>
        </nav>

        {/* 中央主区 */}
        <main className="flex-1 min-w-0 bg-scholar-bg-canvas flex flex-col">
          <Outlet />
        </main>

        {/* 右侧面板（Dashboard 隐藏） */}
        {!isDashboard && <RightPanel currentPath={currentPath} />}
      </div>
    )
  }

  // ── Mobile ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-scholar-bg-canvas text-scholar-text-primary relative">

      {!isDashboard && (
        <header className="h-14 border-b border-scholar-border bg-scholar-bg-surface flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
          <span className="font-medium text-scholar-academic flex items-center space-x-1">
            <div className="w-4 h-4 bg-scholar-primary/20 rounded-full flex items-center justify-center">
              <div className="w-2 h-2 bg-scholar-primary rounded-full" />
            </div>
            <span>工作流环境</span>
          </span>
          <button
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className="text-xs font-semibold text-scholar-primary bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors"
          >
            {isRightPanelOpen ? '关闭面板' : '查看上下文证据'}
          </button>
        </header>
      )}

      <main className="flex-1 overflow-y-auto relative z-0">
        <Outlet />
      </main>

      <nav className="h-16 border-t border-scholar-border bg-scholar-bg-surface flex items-center justify-around pb-safe shrink-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
        <TabItem icon={<LayoutDashboard size={20} />} label="主页"  path="/"         currentPath={currentPath} onClick={() => navigate('/')} />
        <TabItem icon={<BookOpen size={20} />}        label="课程"  path="/courses"   currentPath={currentPath} onClick={() => navigate('/courses')} />
        <TabItem icon={<Sparkles size={20} />}        label="工作台" path="/workbench" currentPath={currentPath} onClick={() => navigate('/workbench')} />
        <TabItem icon={<Network size={20} />}         label="发现"  path="/discovery" currentPath={currentPath} onClick={() => navigate('/discovery')} />
      </nav>

      {/* 移动端抽屉 */}
      <div
        className={`absolute bottom-0 left-0 w-full bg-scholar-bg-surface rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] transition-transform duration-300 z-50 ${
          isRightPanelOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '75vh' }}
      >
        <div className="px-4 py-3 flex justify-center cursor-grab" onClick={() => setIsRightPanelOpen(false)}>
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        <div className="h-[calc(100%-40px)] overflow-hidden">
          <RightPanel currentPath={currentPath} />
        </div>
      </div>

      {isRightPanelOpen && (
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-[1px] z-40 transition-opacity"
          onClick={() => setIsRightPanelOpen(false)}
        />
      )}
    </div>
  )
}

function NavItem({
  icon, label, path, currentPath, onClick,
}: {
  icon: React.ReactNode; label: string; path: string; currentPath: string; onClick: () => void
}) {
  const active = currentPath === path || (path !== '/' && currentPath.startsWith(path))
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
        active
          ? 'bg-blue-50 text-scholar-primary font-semibold'
          : 'text-scholar-text-secondary hover:bg-gray-100 hover:text-scholar-text-primary font-medium'
      }`}
    >
      <span className={active ? 'opacity-100' : 'opacity-70'}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function TabItem({
  icon, label, path, currentPath, onClick,
}: {
  icon: React.ReactNode; label: string; path: string; currentPath: string; onClick: () => void
}) {
  const active = currentPath === path || (path !== '/' && currentPath.startsWith(path))
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center space-y-1 py-1 transition-colors ${
        active ? 'text-scholar-primary' : 'text-scholar-text-weak hover:text-scholar-text-secondary'
      }`}
    >
      <div className={`transition-transform duration-200 ${active ? 'scale-110 mb-0.5' : 'scale-100'}`}>
        {icon}
      </div>
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  )
}
