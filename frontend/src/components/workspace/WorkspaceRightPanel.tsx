import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { deleteSession, fetchSessions, type SessionItem } from '../../api/sessions'
import { useWorkspaceStore } from '../../store/workspace'
import { Button, StateBlock, Tabs } from '../ui'

export function WorkspaceRightPanel() {
  const location = useLocation()
  const navigate = useNavigate()
  const restoreSession = useWorkspaceStore(state => state.restoreSession)
  const references = useWorkspaceStore(state => state.references)
  const [activeTab, setActiveTab] = useState<'evidence' | 'history'>('evidence')
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetchSessions()
      setSessions(result.items)
    } catch {
      setError('加载失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      void loadSessions()
    }
  }, [activeTab, loadSessions])

  const handleRestore = async (sessionId: string) => {
    setRestoringId(sessionId)
    await restoreSession(sessionId)
    setRestoringId(null)
    navigate('/workbench')
  }

  const handleDelete = async (sessionId: string) => {
    await deleteSession(sessionId)
    setSessions(current => current.filter(session => session.session_id !== sessionId))
  }

  if (location.pathname === '/workbench') return null

  return (
    <aside className="hidden w-80 shrink-0 border-l border-scholar-border bg-scholar-bg-surface xl:flex xl:flex-col">
      <div className="border-b border-scholar-border px-4 py-3">
        <Tabs
          items={[
            { id: 'evidence', label: '上下文证据' },
            { id: 'history', label: '历史记录' },
          ]}
          value={activeTab}
          onChange={(value) => setActiveTab(value as 'evidence' | 'history')}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === 'evidence' && (
          <div className="space-y-3">
            {references.slice(0, 5).map(reference => (
              <div key={reference.id} className="rounded-xl border border-scholar-border bg-white p-3 shadow-sm">
                <h3 className="line-clamp-2 text-sm font-bold text-scholar-text-primary">{reference.title}</h3>
                <p className="mt-1 text-xs text-scholar-text-weak">
                  {[reference.venue, reference.year].filter(Boolean).join(' · ') || '来源待补充'}
                </p>
              </div>
            ))}
            {references.length === 0 && (
              <StateBlock title="暂无上下文证据" description="生成或恢复会话后，引用来源会显示在这里。" />
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {loading && (
              <StateBlock title="正在加载历史记录" description="请稍候。" icon={<Loader2 size={20} className="animate-spin" />} />
            )}
            {error && (
              <div className="space-y-3">
                <StateBlock title={error} description="历史记录暂时不可用。" />
                <Button variant="secondary" onClick={loadSessions}>重新加载</Button>
              </div>
            )}
            {!loading && !error && sessions.length === 0 && (
              <StateBlock title="暂无历史记录" description="开始一次研究后会显示在这里。" icon={<Clock size={20} />} />
            )}
            {!loading && !error && sessions.map(session => (
              <div key={session.session_id} className="group flex items-start gap-2 rounded-xl border border-scholar-border bg-white p-3 shadow-sm">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void handleRestore(session.session_id)}
                >
                  <h3 className="truncate text-sm font-bold text-scholar-text-primary">{session.title}</h3>
                  <p className="mt-1 text-xs text-scholar-text-weak">
                    {session.scene || '研究会话'} · {session.message_count} 条消息
                  </p>
                  {restoringId === session.session_id && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-scholar-primary">
                      <Loader2 size={12} className="animate-spin" />
                      正在恢复
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1 text-scholar-text-weak opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  onClick={() => void handleDelete(session.session_id)}
                  aria-label={`删除 ${session.title}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
