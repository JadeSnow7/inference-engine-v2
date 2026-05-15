import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, FilePenLine, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { deleteSession, fetchSessions, type SessionItem } from '../../api/sessions'
import { SessionHistoryCard } from '../../features/history/SessionHistoryCard'
import { ReferenceList } from '../../features/references/ReferenceList'
import { useWorkspaceStore } from '../../store/workspace'
import { Badge, Button, StateBlock, Tabs } from '../ui'

export function WorkspaceRightPanel() {
  const navigate = useNavigate()
  const restoreSession = useWorkspaceStore(state => state.restoreSession)
  const references = useWorkspaceStore(state => state.references)
  const editingStages = useWorkspaceStore(state => state.editingStages)
  const editingPatches = useWorkspaceStore(state => state.editingPatches)
  const editingGateReport = useWorkspaceStore(state => state.editingGateReport)
  const [activeTab, setActiveTab] = useState<'evidence' | 'editing' | 'history'>('evidence')
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
            { id: 'editing', label: '编辑流程' },
            { id: 'history', label: '历史记录' },
          ]}
          value={activeTab}
          onChange={(value) => setActiveTab(value as 'evidence' | 'editing' | 'history')}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === 'evidence' && (
          <ReferenceList references={references} limit={5} />
        )}

        {activeTab === 'editing' && (
          <EditingProgressPanel
            stages={editingStages}
            patchCount={editingPatches.length}
            gate={editingGateReport}
          />
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

function EditingProgressPanel({
  stages,
  patchCount,
  gate,
}: {
  stages: ReturnType<typeof useWorkspaceStore.getState>['editingStages']
  patchCount: number
  gate: ReturnType<typeof useWorkspaceStore.getState>['editingGateReport']
}) {
  if (stages.length === 0 && !gate) {
    return <StateBlock title="暂无编辑流程" description="选择深度编辑、学术增强、降重或引用增强后会显示阶段进度。" icon={<FilePenLine size={20} />} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-scholar-border bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-scholar-text-primary">补丁候选</div>
            <p className="mt-1 text-xs text-scholar-text-secondary">接受前会进入版本快照，可逐条回滚。</p>
          </div>
          <Badge tone="primary">{patchCount} 条</Badge>
        </div>
      </div>

      <div className="space-y-2">
        {stages.map(stage => (
          <div key={stage.stage_id} className="rounded-xl border border-scholar-border bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-scholar-text-primary">{stage.label}</div>
                <p className="mt-1 text-xs text-scholar-text-weak">
                  {[stage.model, stage.thinking ? 'thinking' : 'non-thinking'].filter(Boolean).join(' · ')}
                </p>
                {stage.summary && <p className="mt-2 text-xs leading-5 text-scholar-text-secondary">{stage.summary}</p>}
              </div>
              <Badge tone={stage.status === 'failed' ? 'danger' : stage.status === 'completed' ? 'success' : 'primary'}>
                {stage.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {gate && (
        <div className="rounded-xl border border-scholar-border bg-white p-3">
          <div className="flex items-center gap-2">
            {gate.status === 'fail'
              ? <AlertTriangle size={17} className="text-amber-500" />
              : <CheckCircle2 size={17} className="text-emerald-500" />}
            <div className="text-sm font-bold text-scholar-text-primary">质量门禁</div>
            <Badge tone={gate.status === 'pass' ? 'success' : gate.status === 'fail' ? 'danger' : 'warning'}>{gate.status}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-scholar-text-secondary">
            <span>忠实性 {Math.round(gate.fidelity_score * 100)}%</span>
            <span>语义保持 {Math.round(gate.semantic_similarity * 100)}%</span>
            <span className="col-span-2">未解析证据 {gate.citation_unresolved_count} 条</span>
          </div>
          {gate.messages.length > 0 && (
            <div className="mt-3 space-y-1">
              {gate.messages.map(message => (
                <p key={message} className="text-xs leading-5 text-scholar-text-secondary">{message}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
