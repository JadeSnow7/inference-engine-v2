import { AlertTriangle, BookMarked, CheckCircle2, CircleDot, FileSearch } from 'lucide-react'
import type { WritingAnalyzeResponse } from '../../api/writing'
import { Badge, Button, Card, StateBlock } from '../../components/ui'

interface WritingAnalysisPanelProps {
  result: WritingAnalyzeResponse | null
  loading: boolean
  error: string
  onRetry?: () => void
  onPushToReview?: () => void
}

const validationTone = {
  pass: 'success',
  warning: 'warning',
  error: 'danger',
} as const

export function WritingAnalysisPanel({ result, loading, error, onRetry, onPushToReview }: WritingAnalysisPanelProps) {
  if (loading) {
    return <StateBlock title="正在分析学术规范" description="正在检索规范、扩展上下文并校验文本。" icon={<FileSearch size={24} />} />
  }

  if (error) {
    return (
      <Card>
        <StateBlock title="分析失败" description={error} icon={<AlertTriangle size={24} />} />
        {onRetry && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={onRetry}>重试分析</Button>
          </div>
        )}
      </Card>
    )
  }

  if (!result) {
    return <StateBlock title="等待分析" description="输入一段论文文本后，AI 会返回规范节点、上下文、校验结论和引用来源。" icon={<BookMarked size={24} />} />
  }

  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="规范节点">
          <div className="space-y-3">
            {result.nodes.length === 0 ? <EmptySection label="暂无规范节点" /> : result.nodes.map(node => (
              <div key={node.id} className="rounded-xl border border-scholar-border bg-scholar-bg-canvas px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-scholar-text-primary">{node.label}</div>
                    {node.type && <p className="mt-1 text-xs text-scholar-text-secondary">{node.type}</p>}
                  </div>
                  {typeof node.score === 'number' && <Badge tone="primary">{Math.round(node.score * 100)}%</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="扩展上下文">
          <div className="space-y-3">
            {result.expanded_context.length === 0 ? <EmptySection label="暂无扩展上下文" /> : result.expanded_context.map(context => (
              <div key={context.id} className="rounded-xl border border-scholar-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-scholar-text-primary">{context.title}</div>
                  {typeof context.score === 'number' && <Badge>{Math.round(context.score * 100)}%</Badge>}
                </div>
                {context.excerpt && <p className="mt-2 text-sm leading-6 text-scholar-text-secondary">{context.excerpt}</p>}
              </div>
            ))}
          </div>
        </Card>

        <Card title="校验结果">
          <div className="space-y-3">
            {result.validation.length === 0 ? <EmptySection label="暂无校验结论" /> : result.validation.map(item => (
              <div key={item.id} className="flex items-start gap-3 rounded-xl border border-scholar-border px-4 py-3">
                <CheckCircle2 size={18} className="mt-0.5 text-scholar-primary" />
                <div className="min-w-0 flex-1">
                  <Badge tone={validationTone[item.status]}>{item.status}</Badge>
                  <p className="mt-2 text-sm leading-6 text-scholar-text-primary">{item.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="引用来源">
          <div className="space-y-3">
            {result.references.length === 0 ? <EmptySection label="暂无引用来源" /> : result.references.map(reference => (
              <div key={reference.id} className="rounded-xl border border-scholar-border px-4 py-3">
                <div className="flex items-start gap-3">
                  <CircleDot size={16} className="mt-1 text-scholar-primary" />
                  <div className="min-w-0">
                    <div className="font-semibold text-scholar-text-primary">{reference.title}</div>
                    <p className="mt-1 text-xs text-scholar-text-secondary">
                      {[reference.source, reference.year].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {onPushToReview && (
        <button
          type="button"
          className="mt-4 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-scholar-primary transition hover:bg-blue-100"
          onClick={onPushToReview}
        >
          推入审阅队列
        </button>
      )}
    </div>
  )
}

function EmptySection({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas px-4 py-6 text-center text-sm font-medium text-scholar-text-secondary">
      {label}
    </div>
  )
}
