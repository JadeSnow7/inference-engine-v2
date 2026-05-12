import { BookMarked, ExternalLink, FileText, Filter } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, StateBlock } from '../components/ui'
import { useWorkspaceStore } from '../store/workspace'

const curatedEvidence = [
  { id: 'norm-hust-2026', title: '华中科技大学本科论文写作规范', venue: 'HUST Norm Corpus', year: 2026, score: 0.94 },
  { id: 'edu-llm-review-2025', title: 'Large Language Models in Education: A Comprehensive Review', venue: 'Computers & Education', year: 2025, score: 0.91 },
  { id: 'ai-feedback-2024', title: 'AI Feedback Tools and Learning Outcomes', venue: 'Learning Analytics', year: 2024, score: 0.87 },
]

export default function Library() {
  const navigate = useNavigate()
  const references = useWorkspaceStore(state => state.references)
  const evidence = references.length > 0 ? references : curatedEvidence

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
          <Button variant="secondary" disabled title="筛选暂未接入">
            <Filter size={16} />
            筛选暂未接入
          </Button>
        </header>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card title="证据库">
            <div className="space-y-3">
              {evidence.length === 0 && (
                <StateBlock title="暂无证据" description="写作分析、SSE 检索或会话恢复后会在这里出现引用来源。" icon={<FileText size={22} />} />
              )}
              {evidence.map(reference => (
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
                    <Badge>引用候选</Badge>
                    <Badge tone="success">可用于综述</Badge>
                    <Badge>待核验格式</Badge>
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
