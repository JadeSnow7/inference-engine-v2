import { useState } from 'react'
import { PenLine, Sparkles } from 'lucide-react'
import { Button, Card, Tabs } from '../components/ui'
import { WritingAnalysisPanel } from '../features/writing/WritingAnalysisPanel'
import { useWritingAnalysis, type WritingMode } from '../features/writing/useWritingAnalysis'
import { useWorkspaceStore } from '../store/workspace'

const modeItems = [
  { id: 'norms', label: '规范校验' },
  { id: 'citation', label: '引文核查' },
  { id: 'structure', label: '结构建议' },
]

export default function Writing() {
  const [text, setText] = useState('')
  const [mode, setMode] = useState<WritingMode>('norms')
  const activeSessionId = useWorkspaceStore(state => state.activeSessionId)
  const { result, loading, error, runAnalysis } = useWritingAnalysis()

  const canAnalyze = text.trim().length > 0

  const handleAnalyze = () => {
    if (!canAnalyze) return
    void runAnalysis(text.trim(), mode, activeSessionId ?? undefined)
  }

  return (
    <div data-testid="writing-page" className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 overflow-y-auto p-6 md:p-8">
      <header className="flex flex-col gap-4 border-b border-scholar-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-scholar-primary">
            <PenLine size={18} />
            AI 写作助手
          </div>
          <h1 className="text-2xl font-bold text-scholar-text-primary">AI 写作</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-scholar-text-secondary">
            面向论文正文、摘要和章节草稿的规范校验工作台。
          </p>
        </div>
        <Tabs items={modeItems} value={mode} onChange={value => setMode(value as WritingMode)} />
      </header>

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card title="文本输入" className="h-fit">
          <label htmlFor="writing-analysis-text" className="text-sm font-semibold text-scholar-text-primary">
            待分析文本
          </label>
          <textarea
            id="writing-analysis-text"
            value={text}
            onChange={event => setText(event.target.value)}
            className="mt-3 min-h-72 w-full resize-y rounded-2xl border border-scholar-border bg-white px-4 py-3 text-sm leading-6 text-scholar-text-primary outline-none transition placeholder:text-scholar-text-weak focus:border-scholar-primary focus:ring-4 focus:ring-blue-50"
            placeholder="粘贴摘要、正文段落或章节草稿..."
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-scholar-text-weak">{text.trim().length} 字符</span>
            <Button onClick={handleAnalyze} loading={loading} disabled={!canAnalyze}>
              <Sparkles size={16} />
              分析学术规范
            </Button>
          </div>
        </Card>

        <WritingAnalysisPanel result={result} loading={loading} error={error} onRetry={handleAnalyze} />
      </div>
    </div>
  )
}
