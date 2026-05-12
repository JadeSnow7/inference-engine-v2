import { useCallback, useEffect, useState } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { deleteSession, fetchSessions, type SessionItem } from '../../api/sessions'
import { SessionHistoryCard } from '../../features/history/SessionHistoryCard'
import { ReferenceList } from '../../features/references/ReferenceList'
import { useWorkspaceStore } from '../../store/workspace'
import { Button, StateBlock, Tabs } from '../ui'

export function WorkspaceRightPanel() {
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
          <ReferenceList references={references} limit={5} />
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
              <SessionHistoryCard
                key={session.session_id}
                session={session}
                restoring={restoringId === session.session_id}
                onRestore={() => void handleRestore(session.session_id)}
                onDelete={() => void handleDelete(session.session_id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
