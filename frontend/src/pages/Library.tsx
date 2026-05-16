import { useEffect, useState } from 'react'
import { BookMarked, ExternalLink, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchEvidence, type EvidenceItem } from '../api/library'
import { Badge, Button, Card, StateBlock } from '../components/ui'
import type { EvidenceStatus } from '../types/workspace'

export default function Library() {
  const navigate = useNavigate()
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [query, setQuery] = useState('')
  const [type, setType] = useState('')
  const [status, setStatus] = useState<EvidenceStatus | ''>('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setErrorMessage(null)

    fetchEvidence({
      q: query.trim() || undefined,
      type: type || undefined,
      status: status || undefined,
    })
      .then(response => {
        if (!isCurrent) return
        setEvidence(response.items)
      })
      .catch(error => {
        if (!isCurrent) return
        setEvidence([])
        setErrorMessage(error instanceof Error ? error.message : '证据库暂时不可用')
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [query, type, status])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 border-b border-scholar-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-scholar-primary">
              <BookMarked size={18} />
              文献证据
            </div>
            <h1 className="text-2xl font-bold text-scholar-text-primary">文献库</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-scholar-text-secondary">
              汇总工作台、写作分析和历史会话产生的文献与规范证据，用于引用核查和综述写作。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1 text-xs font-semibold text-scholar-text-secondary">
              证据搜索
              <input
                aria-label="证据搜索"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="标题、来源或关键词"
                className="h-10 w-full rounded-xl border border-scholar-border bg-white px-3 text-sm font-normal text-scholar-text-primary outline-none transition focus:border-scholar-primary focus:ring-4 focus:ring-blue-100 sm:w-56"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-scholar-text-secondary">
              证据类型
              <select
                aria-label="证据类型"
                value={type}
                onChange={event => setType(event.target.value)}
                className="h-10 rounded-xl border border-scholar-border bg-white px-3 text-sm font-normal text-scholar-text-primary outline-none transition focus:border-scholar-primary focus:ring-4 focus:ring-blue-100"
              >
                <option value="">全部</option>
                <option value="paper">论文</option>
                <option value="norm">规范</option>
                <option value="dataset">数据集</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-scholar-text-secondary">
              证据状态
              <select
                aria-label="证据状态"
                value={status}
                onChange={event => setStatus(event.target.value as EvidenceStatus | '')}
                className="h-10 rounded-xl border border-scholar-border bg-white px-3 text-sm font-normal text-scholar-text-primary outline-none transition focus:border-scholar-primary focus:ring-4 focus:ring-blue-100"
              >
                <option value="">全部</option>
                <option value="candidate">候选</option>
                <option value="inserted">已插入</option>
                <option value="needs_review">待核验</option>
                <option value="verified">已核验</option>
                <option value="conflict">冲突</option>
              </select>
            </label>
          </div>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card title="证据库">
            <div className="space-y-3">
              {isLoading && <StateBlock title="正在加载证据库..." icon={<FileText size={22} />} />}
              {!isLoading && errorMessage && (
                <StateBlock title="证据库加载失败" description={errorMessage} icon={<FileText size={22} />} />
              )}
              {!isLoading && !errorMessage && evidence.length === 0 && (
                <StateBlock title="暂无证据" description="写作分析、SSE 检索或会话恢复后会在这里出现引用来源。" icon={<FileText size={22} />} />
              )}
              {!isLoading && !errorMessage && evidence.map(reference => (
                <article key={reference.id} className="rounded-2xl border border-scholar-border bg-white p-4 transition hover:border-scholar-primary/40 hover:bg-blue-50/40">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-scholar-text-primary">{reference.title}</h2>
                      <p className="mt-1 text-sm text-scholar-text-secondary">
                        {[reference.venue, reference.year].filter(Boolean).join(' · ') || '来源待补充'}
                      </p>
                    </div>
                    {typeof reference.score === 'number' && <Badge tone="primary">相关度 {Math.round(reference.score * 100)}%</Badge>}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge tone={getEvidenceStatusTone(reference.status)}>{getEvidenceStatusLabel(reference.status)}</Badge>
                    {typeof reference.confidence === 'number' && <Badge>可信度 {Math.round(reference.confidence * 100)}%</Badge>}
                    {reference.linkedBlockIds?.length ? <Badge>关联段落 {reference.linkedBlockIds.length}</Badge> : <Badge>未关联正文</Badge>}
                  </div>
                </article>
              ))}
            </div>
          </Card>

          <Card title="引用状态">
            <div className="space-y-4 text-sm text-scholar-text-secondary">
              <p>当前证据优先服务于“LLM 教育应用综述”主题，建议先处理高相关度规范与综述来源。</p>
              <div className="rounded-xl border border-scholar-border bg-scholar-bg-canvas p-3">
                <div className="font-semibold text-scholar-text-primary">AI 摘要</div>
                <p className="mt-2 leading-6">近期证据集中在学习反馈、教学评价和规范引用三个方向，可作为文献综述的二级结构。</p>
              </div>
              <Button variant="secondary" className="w-full" onClick={() => navigate('/workbench')}>
                <ExternalLink size={16} />
                打开工作台引用面板
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  )
}

function getEvidenceStatusLabel(status?: string): string {
  switch (status) {
    case 'inserted':
      return '已插入'
    case 'needs_review':
      return '待核验'
    case 'verified':
      return '已核验'
    case 'conflict':
      return '冲突'
    case 'candidate':
    default:
      return '候选'
  }
}

function getEvidenceStatusTone(status?: string): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
  if (status === 'verified') return 'success'
  if (status === 'needs_review') return 'warning'
  if (status === 'conflict') return 'danger'
  if (status === 'inserted') return 'primary'
  return 'neutral'
}
