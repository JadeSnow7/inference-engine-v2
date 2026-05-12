import { ArrowRight, BookOpen, CheckCircle2, FileText, Network, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card } from '../components/ui'
import { useWorkspaceStore } from '../store/workspace'

const taskItems = [
  { title: '补全文献综述中的教育场景证据', meta: '工作台 · 2 个待处理修改' },
  { title: '核查摘要是否符合本科论文规范', meta: 'AI 写作 · 建议先分析规范' },
  { title: '整理知识图谱中新增的学习分析节点', meta: '知识图谱 · 5 个关联节点' },
]

const recentDocuments = [
  { title: 'LLM-in-Education-review.md', type: '综述草稿', updated: '今天 09:24' },
  { title: 'HUST-thesis-norms.pdf', type: '规范证据', updated: '昨天 21:10' },
  { title: 'Survey-on-AI-tools.csv', type: '文献表', updated: '昨天 17:42' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const references = useWorkspaceStore(state => state.references)
  const documentBlocks = useWorkspaceStore(state => state.documentBlocks)

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 border-b border-scholar-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-scholar-primary">
              <Sparkles size={18} />
              ScholarScript 工作区
            </div>
            <h1 className="text-2xl font-bold text-scholar-text-primary">研究工作台总览</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-scholar-text-secondary">
              聚合课程、文献、知识图谱和 AI 写作反馈，继续推进当前毕业论文研究。
            </p>
          </div>
          <Button onClick={() => navigate('/workbench')}>
            <Sparkles size={16} />
            进入学术工作台
          </Button>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="当前正文块" value={documentBlocks.length.toString()} icon={<FileText size={18} />} />
          <MetricCard label="证据来源" value={references.length.toString()} icon={<BookOpen size={18} />} />
          <MetricCard label="图谱更新" value="12" icon={<Network size={18} />} />
          <MetricCard label="规范提醒" value="3" icon={<CheckCircle2 size={18} />} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Card title="当前研究焦点">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">进行中</Badge>
                <Badge>教育技术</Badge>
                <Badge>论文综述</Badge>
              </div>
              <h2 className="mt-4 text-xl font-bold text-scholar-text-primary">大语言模型在教育领域的应用综述</h2>
              <p className="mt-2 text-sm leading-6 text-scholar-text-secondary">
                当前重点是补齐规范证据、细化研究问题，并把知识图谱中的教学评价、学习分析和生成式反馈节点接入正文。
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
              {taskItems.map(item => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => navigate(item.title.includes('摘要') ? '/writing' : '/workbench')}
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
              <WorkspaceLink title="Research Methods in Education" meta="研究主题：LLM 课堂反馈 · 18 篇文献" onClick={() => navigate('/courses')} />
              <WorkspaceLink title="Academic Writing" meta="研究主题：本科论文规范 · 7 条规范证据" onClick={() => navigate('/writing')} />
            </div>
          </Card>

          <Card title="最近文档">
            <div className="space-y-3">
              {recentDocuments.map(document => (
                <WorkspaceLink key={document.title} title={document.title} meta={`${document.type} · ${document.updated}`} onClick={() => navigate('/library')} />
              ))}
            </div>
          </Card>
        </section>
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

function WorkspaceLink({ title, meta, onClick }: { title: string; meta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-scholar-border px-4 py-3 text-left transition hover:border-scholar-primary/40 hover:bg-scholar-bg-canvas"
    >
      <span>
        <span className="block text-sm font-semibold text-scholar-text-primary">{title}</span>
        <span className="mt-1 block text-xs text-scholar-text-secondary">{meta}</span>
      </span>
      <ArrowRight size={16} className="shrink-0 text-scholar-text-weak" />
    </button>
  )
}
