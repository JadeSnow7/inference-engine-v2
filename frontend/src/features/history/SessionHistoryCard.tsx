import { Loader2, Trash2 } from 'lucide-react'
import type { SessionItem } from '../../api/sessions'

interface SessionHistoryCardProps {
  session: SessionItem
  restoring: boolean
  onRestore: () => void
  onDelete: () => void
}

export function SessionHistoryCard({ session, restoring, onRestore, onDelete }: SessionHistoryCardProps) {
  return (
    <div className="group flex items-start gap-2 rounded-xl border border-scholar-border bg-white p-3 shadow-sm">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onRestore}>
        <h3 className="truncate text-sm font-bold text-scholar-text-primary">{session.title}</h3>
        <p className="mt-1 text-xs text-scholar-text-weak">
          {session.scene || '研究会话'} · {session.message_count} 条消息
        </p>
        {restoring && (
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-scholar-primary">
            <Loader2 size={12} className="animate-spin" />
            正在恢复
          </span>
        )}
      </button>
      <button
        type="button"
        className="rounded-lg p-1 text-scholar-text-weak opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
        onClick={onDelete}
        aria-label={`删除 ${session.title}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}
