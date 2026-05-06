import { useWorkspaceStore } from '../../store/workspace'
import type { VersionBlockDiff } from './versionDiff'
import { changedVersionBlocks } from './versionDiff'

const MAX_VISIBLE_DIFFS = 5

export function VersionList() {
  const documentVersions = useWorkspaceStore(state => state.documentVersions)
  const documentBlocks = useWorkspaceStore(state => state.documentBlocks)
  const previewVersionId = useWorkspaceStore(state => state.previewVersionId)
  const isRestoringVersion = useWorkspaceStore(state => state.isRestoringVersion)
  const currentSuggestion = useWorkspaceStore(state => state.currentSuggestion)
  const saveStatus = useWorkspaceStore(state => state.saveStatus)
  const lastRestoreNotice = useWorkspaceStore(state => state.lastRestoreNotice)
  const startVersionPreview = useWorkspaceStore(state => state.startVersionPreview)
  const cancelVersionPreview = useWorkspaceStore(state => state.cancelVersionPreview)
  const restorePreviewVersion = useWorkspaceStore(state => state.restorePreviewVersion)
  const dismissRestoreNotice = useWorkspaceStore(state => state.dismissRestoreNotice)

  if (documentVersions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-scholar-border bg-white/60 px-3 py-4 text-center text-xs text-scholar-text-weak">
        暂无版本记录
      </div>
    )
  }

  const handleVersionClick = (versionId: string, active: boolean) => {
    if (active) return
    startVersionPreview(versionId)
  }

  const handleRestorePreview = () => {
    const previewVersion = documentVersions.find(version => version.id === previewVersionId)
    if (!previewVersion) return

    const needsCarefulConfirm = currentSuggestion || saveStatus === 'modified'
    const message = needsCarefulConfirm
      ? `当前存在待处理 AI 修改建议或未保存修改，恢复版本 ${previewVersion.label} 会覆盖当前文档状态。是否继续？`
      : `恢复版本 ${previewVersion.label} 会将正文切换到该历史快照。是否继续？`
    const confirmed = window.confirm(message)
    if (!confirmed) return

    restorePreviewVersion()
  }

  return (
    <div className="space-y-2">
      {lastRestoreNotice && (
        <RestoreAuditNotice
          versionTitle={lastRestoreNotice.versionTitle}
          changedBlockCount={lastRestoreNotice.changedBlockCount}
          restoredAt={lastRestoreNotice.restoredAt}
          onDismiss={dismissRestoreNotice}
        />
      )}
      <div className="space-y-1.5">
      {documentVersions.map(version => {
        const active = version.isCurrent
        const previewing = previewVersionId === version.id
        const blockDiffs = changedVersionBlocks(documentBlocks, version.documentBlocks)
        const visibleDiffs = blockDiffs.slice(0, MAX_VISIBLE_DIFFS)
        const hiddenDiffCount = Math.max(blockDiffs.length - visibleDiffs.length, 0)

        return (
          <div key={version.id} className="space-y-1">
            <button
              className={`w-full rounded-xl px-3 py-2 text-left transition ${
                active ? 'bg-indigo-50 text-scholar-primary shadow-sm' : previewing ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'text-scholar-text-secondary hover:bg-scholar-bg-canvas'
              }`}
              aria-current={active ? 'true' : undefined}
              onClick={() => handleVersionClick(version.id, active)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold">{version.label}</span>
                <span className="text-[11px] text-scholar-text-weak">{version.updatedAt}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-scholar-text-weak">{version.summary}</p>
            </button>

            {previewing && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                <div className="text-xs font-bold text-amber-800">正在预览历史版本</div>
                <p className="mt-1 text-[11px] leading-5 text-amber-800">
                  预览不会修改当前正文。该版本与当前正文有 {blockDiffs.length} 个段落差异。
                </p>
                <VersionDiffSummary diffs={visibleDiffs} hiddenCount={hiddenDiffCount} />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isRestoringVersion}
                    onClick={handleRestorePreview}
                  >
                    {isRestoringVersion ? '恢复中' : '恢复此版本'}
                  </button>
                  <button
                    className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                    onClick={cancelVersionPreview}
                  >
                    取消预览
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}

function VersionDiffSummary({ diffs, hiddenCount }: { diffs: VersionBlockDiff[]; hiddenCount: number }) {
  if (diffs.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-white/70 px-2.5 py-2 text-[11px] text-amber-800">
        版本差异预览：当前正文与该历史版本一致。
      </div>
    )
  }

  return (
    <div className="mt-2 border-t border-amber-200 pt-2">
      <div className="text-[11px] font-bold text-amber-900">版本差异预览</div>
      <div className="mt-1.5 space-y-1.5">
        {diffs.map(diff => (
          <div key={`${diff.kind}-${diff.id}`} className="border-l-2 border-amber-300 pl-2">
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                {diff.label}
              </span>
              <span className="truncate text-[11px] font-semibold text-amber-950">
                {diff.block.title ?? diff.block.content}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-amber-800">
              {formatDiffDescription(diff)}
            </p>
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <div className="mt-1.5 text-[11px] font-semibold text-amber-900">还有 {hiddenCount} 处变化</div>
      )}
    </div>
  )
}

function formatDiffDescription(diff: VersionBlockDiff): string {
  if (diff.kind === 'current-only') {
    return diff.currentBlock?.content ?? diff.block.content
  }

  if (diff.kind === 'snapshot-only') {
    return diff.snapshotBlock?.content ?? diff.block.content
  }

  const snapshotContent = diff.snapshotBlock?.content ?? diff.block.content
  const currentContent = diff.currentBlock?.content
  if (!currentContent || currentContent === snapshotContent) return snapshotContent

  return `历史：${snapshotContent} / 当前：${currentContent}`
}

interface RestoreAuditNoticeProps {
  versionTitle: string
  changedBlockCount: number
  restoredAt: string
  onDismiss: () => void
}

function RestoreAuditNotice({ versionTitle, changedBlockCount, restoredAt, onDismiss }: RestoreAuditNoticeProps) {
  const timeLabel = new Date(restoredAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div
      role="status"
      className="relative rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] leading-5 text-emerald-800 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Check circle icon */}
          <svg
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-bold text-emerald-900">恢复成功</span>
        </div>
        <button
          className="shrink-0 rounded p-0.5 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 transition"
          aria-label="关闭恢复提示"
          onClick={onDismiss}
        >
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>
      <div className="mt-1 space-y-0.5 pl-5">
        <div>
          已恢复至：<span className="font-semibold">{versionTitle}</span>
        </div>
        <div>
          影响段落：<span className="font-semibold">{changedBlockCount} 个段落</span>
        </div>
        <div>
          恢复时间：<span className="font-semibold">{timeLabel}</span>
        </div>
      </div>
    </div>
  )
}
