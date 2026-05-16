import { Check, Clock3, X } from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspace'
import { AISuggestionPanel } from '../ai/AISuggestionPanel'

export function ReviewQueuePanel() {
  const reviewItems = useWorkspaceStore(state => state.reviewItems)
  const currentSuggestion = useWorkspaceStore(state => state.currentSuggestion)
  const setReviewItemStatus = useWorkspaceStore(state => state.setReviewItemStatus)
  const acceptReviewItem = useWorkspaceStore(state => state.acceptReviewItem)

  if (!currentSuggestion && reviewItems.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas p-4 text-center">
        <div className="text-sm font-semibold text-scholar-text-primary">暂无待处理审阅项</div>
        <p className="mt-1 text-xs leading-5 text-scholar-text-secondary">AI 建议和写作校审结果会先进入这里，确认后再写入正文。</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {currentSuggestion && (
        <section className="rounded-xl border border-blue-100 bg-blue-50/20">
          <AISuggestionPanel />
        </section>
      )}
      {reviewItems.map(item => (
        <article key={item.id} className="rounded-xl border border-scholar-border bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-scholar-text-primary">{item.reason || '待审阅修改'}</h3>
              <p className="mt-1 text-xs text-scholar-text-secondary">{item.kind} · {item.status}</p>
            </div>
            <StatusIcon status={item.status} />
          </div>
          {item.changes[0]?.revisedText && (
            <p className="mt-3 line-clamp-3 text-xs leading-5 text-scholar-text-secondary">{item.changes[0].revisedText}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-scholar-primary" onClick={() => acceptReviewItem(item.id)}>
              接受
            </button>
            <button type="button" className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-scholar-text-secondary" onClick={() => setReviewItemStatus(item.id, 'deferred')}>
              稍后
            </button>
            <button type="button" className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600" onClick={() => setReviewItemStatus(item.id, 'rejected')}>
              拒绝
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'accepted') return <Check size={16} className="text-emerald-600" />
  if (status === 'rejected') return <X size={16} className="text-red-600" />
  return <Clock3 size={16} className="text-amber-600" />
}
