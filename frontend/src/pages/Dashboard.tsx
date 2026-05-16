import { ArrowRight, BookOpen, CheckCircle2, FileText, Network, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDashboardSummary, type DashboardLinkItem, type DashboardSummary } from '../api/dashboard'
import { Badge, Button, Card } from '../components/ui'

export default function Dashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    setErrorMessage('')

    fetchDashboardSummary()
      .then(data => {
        if (!active) return
        setSummary(data)
        setIsLoading(false)
      })
      .catch(error => {
        if (!active) return
        setErrorMessage(error instanceof Error ? error.message : '工作区总览服务暂时不可用')
        setSummary(null)
        setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const metrics = summary?.metrics ?? {
    documentBlocks: 0,
    evidenceSources: 0,
    graphUpdates: 0,
    normReminders: 0,
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 border-b border-scholar-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-scholar-primary">
              <Sparkles size={18} />
              学术写作助手
            </div>
            <h1 className="text-2xl font-bold text-scholar-text-primary">写作工作台总览</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-scholar-text-secondary">
              聚合课程、文献、知识图谱和 AI 写作反馈，继续推进当前毕业论文研究。
            </p>
          </div>
          <Button onClick={() => navigate('/workbench')}>
            <Sparkles size={16} />
            进入学术工作台
          </Button>
        </header>

        {isLoading && (
          <section className="rounded-2xl border border-dashed border-scholar-border bg-white/70 px-5 py-10 text-center text-sm font-semibold text-scholar-text-secondary">
            正在加载工作区总览...
          </section>
        )}

        {!isLoading && errorMessage && (
          <section className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-8 text-center">
            <h2 className="text-base font-bold text-rose-700">工作区总览加载失败</h2>
            <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && summary && (
          <>
        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="当前正文块" value={metrics.documentBlocks.toString()} icon={<FileText size={18} />} />
          <MetricCard label="证据来源" value={metrics.evidenceSources.toString()} icon={<BookOpen size={18} />} />
          <MetricCard label="图谱更新" value={metrics.graphUpdates.toString()} icon={<Network size={18} />} />
          <MetricCard label="规范提醒" value={metrics.normReminders.toString()} icon={<CheckCircle2 size={18} />} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Card title="当前研究焦点">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <div className="flex flex-wrap items-center gap-2">
                {(summary.focus.tags.length > 0 ? summary.focus.tags : ['待开始']).map((tag, index) => (
                  <Badge key={tag} tone={index === 0 ? 'primary' : 'neutral'}>{tag}</Badge>
                ))}
              </div>
              <h2 className="mt-4 text-xl font-bold text-scholar-text-primary">{summary.focus.title}</h2>
              <p className="mt-2 text-sm leading-6 text-scholar-text-secondary">
                {summary.focus.summary}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button onClick={() => navigate('/workbench')}>
                  继续写作
                  <ArrowRight size={16} />
                </Button>
                <Button variant="secondary" onClick={() => navigate('/library')}>
                  查看证据库
                </Button>
              </div>
            </div>
          </Card>

          <Card title="AI 建议">
            <div className="space-y-3">
              {summary.tasks.length === 0 && <EmptyLine label="暂无 AI 建议" />}
              {summary.tasks.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.target ?? '/workbench')}
                  className="w-full rounded-xl border border-scholar-border bg-white px-4 py-3 text-left transition hover:border-scholar-primary/40 hover:bg-blue-50"
                >
                  <div className="text-sm font-semibold text-scholar-text-primary">{item.title}</div>
                  <div className="mt-1 text-xs text-scholar-text-secondary">{item.meta}</div>
                </button>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Card title="最近课程">
            <div className="space-y-3">
              {summary.recentCourses.length === 0 && <EmptyLine label="暂无最近课程" />}
              {summary.recentCourses.map(course => (
                <WorkspaceLink key={course.id} item={course} fallbackTarget="/courses" onNavigate={navigate} />
              ))}
            </div>
          </Card>

          <Card title="最近文档">
            <div className="space-y-3">
              {summary.recentDocuments.length === 0 && <EmptyLine label="暂无最近文档" />}
              {summary.recentDocuments.map(document => (
                <WorkspaceLink key={document.id} item={document} fallbackTarget="/library" onNavigate={navigate} />
              ))}
            </div>
          </Card>
        </section>
          </>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-blue-50 p-2 text-scholar-primary">{icon}</div>
        <span className="text-2xl font-bold text-scholar-text-primary">{value}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-scholar-text-secondary">{label}</p>
    </Card>
  )
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-scholar-border bg-white/70 px-4 py-3 text-sm text-scholar-text-secondary">
      {label}
    </div>
  )
}

function WorkspaceLink({
  item,
  fallbackTarget,
  onNavigate,
}: {
  item: DashboardLinkItem
  fallbackTarget: string
  onNavigate: (target: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.target ?? fallbackTarget)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-scholar-border px-4 py-3 text-left transition hover:border-scholar-primary/40 hover:bg-scholar-bg-canvas"
    >
      <span>
        <span className="block text-sm font-semibold text-scholar-text-primary">{item.title}</span>
        <span className="mt-1 block text-xs text-scholar-text-secondary">{item.meta}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-scholar-text-weak" />
    </button>
  )
}
