import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useLayoutStore } from '../store/layout'
import { connectSSE, type SSEController } from '../api/sse'
import { fetchSessionMessages, fetchSessionArtifact } from '../api/sessions'
import type { PaperItem, GapItem } from '../types/events'
import { Sparkles, ArrowRight, Play, Loader2, Link as LinkIcon, Send, RotateCcw } from 'lucide-react'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
type StreamState = 'idle' | 'generating' | 'done' | 'restoring'

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function Workbench() {
  const workbenchContext   = useLayoutStore(state => state.workbenchContext)
  const setWorkbenchContext = useLayoutStore(state => state.setWorkbenchContext)
  const setIsRightPanelOpen = useLayoutStore(state => state.setIsRightPanelOpen)

  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined)
  const [inputText, setInputText]   = useState('')
  const [streamState, setStreamState] = useState<StreamState>('idle')
  const [currentStage, setCurrentStage] = useState('')
  const [outputText, setOutputText] = useState('')   // 累加的 Markdown 正文
  const [papers, setPapers]         = useState<PaperItem[]>([])
  const [gaps, setGaps]             = useState<GapItem[]>([])
  const [errorMsg, setErrorMsg]     = useState('')
  const [restoredTitle, setRestoredTitle] = useState('')  // 恢复的会话标题提示

  const sseRef    = useRef<SSEController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ── 从课程页带入上下文 ──────────────────────────────────────
  useEffect(() => {
    if (workbenchContext && streamState === 'idle') {
      const actionMap: Record<string, string> = {
        outline: '生成开题报告大纲',
        review:  '整理文献综述',
        gap:     '提炼研究空白',
        polish:  '润色论文段落',
      }
      const verb = workbenchContext.actionType
        ? (actionMap[workbenchContext.actionType] ?? '分析')
        : '分析'
      setInputText(`请针对相关资料《${workbenchContext.sourceTitle}》进行深度${verb}。`)
      setWorkbenchContext(null)
    }
  }, [workbenchContext, streamState, setWorkbenchContext])

  // ── 历史会话恢复 ────────────────────────────────────────────
  useEffect(() => {
    const handleRestore = async (e: Event) => {
      const { sessionId } = (e as CustomEvent<{ sessionId: string }>).detail
      if (!sessionId) return

      setStreamState('restoring')
      setOutputText('')
      setPapers([])
      setGaps([])
      setErrorMsg('')
      setRestoredTitle('')
      setIsRightPanelOpen(true)

      try {
        const [msgRes, artifactRes] = await Promise.all([
          fetchSessionMessages(sessionId),
          fetchSessionArtifact(sessionId),
        ])

        // Re-build output text from message history (assistant turns only)
        const assistantTexts = msgRes.messages
          .filter(m => m.role === 'assistant')
          .map(m => m.content)
        setOutputText(assistantTexts.join('\n\n---\n\n'))

        // Restore sidebar panels
        if (artifactRes.papers && artifactRes.papers.length > 0) {
          setPapers(artifactRes.papers)
        }
        if (artifactRes.gaps && artifactRes.gaps.length > 0) {
          setGaps(artifactRes.gaps)
        }

        setActiveSessionId(sessionId)
        setRestoredTitle('已恢复历史会话 — 可继续输入对话')
      } catch {
        setRestoredTitle('会话恢复失败，请重试')
      } finally {
        setStreamState('done')
      }
    }

    window.addEventListener('restore-session', handleRestore)
    return () => window.removeEventListener('restore-session', handleRestore)
  }, [setIsRightPanelOpen])

  // ── 自动滚动 ──────────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [outputText, currentStage])

  // ── 清理：组件卸载时中止 SSE ──────────────────────────────────
  useEffect(() => () => { sseRef.current?.abort() }, [])


  // ── 发送 ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    if (!inputText.trim() || streamState === 'generating' || streamState === 'restoring') return

    // 重置状态
    setStreamState('generating')
    setOutputText('')
    setCurrentStage('连接中...')
    setErrorMsg('')
    setPapers([])
    setGaps([])
    setIsRightPanelOpen(true)

    sseRef.current = connectSSE(inputText.trim(), {
      onSessionId: (sessionId) => setActiveSessionId(sessionId),
      onStage:  (stage)   => setCurrentStage(stage),
      onPapers: (items)   => setPapers(items),
      onGaps:   (items)   => setGaps(items),
      onToken:  (token)   => setOutputText(prev => prev + token),
      onDone:   ()        => {
        window.dispatchEvent(new Event('session-history-changed'))
        setStreamState('done')
        setCurrentStage('')
      },
      onError:  (msg)     => {
        setOutputText(prev => prev + `\n\n> ⚠ ${msg}`)
        setStreamState('done')
        setCurrentStage('')
      },
    }, activeSessionId)
  }, [activeSessionId, inputText, streamState, setIsRightPanelOpen])

  // ── Enter 发送（Shift+Enter 换行）──────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleAbort = () => {
    sseRef.current?.abort()
    setStreamState('done')
    setCurrentStage('')
  }

  // ── render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-scholar-bg-canvas relative overflow-hidden">

      {/* 顶部工具栏 */}
      <header className="h-14 border-b border-scholar-border bg-scholar-bg-surface flex items-center justify-between px-6 shrink-0 z-10 w-full">
        <div className="flex space-x-6 text-sm font-medium">
          <button className="text-scholar-academic relative after:absolute after:bottom-[-16px] after:left-0 after:w-full after:h-0.5 after:bg-scholar-academic">
            学术工作台
          </button>
          <button className="text-scholar-text-secondary hover:text-scholar-text-primary">代码引擎</button>
        </div>

        {/* 阶段进度 / 恢复中提示 */}
        {currentStage && (
          <span className="text-xs font-mono text-scholar-academic bg-blue-50 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            {currentStage}
          </span>
        )}
        {streamState === 'restoring' && !currentStage && (
          <span className="text-xs font-mono text-scholar-text-secondary bg-gray-100 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            正在恢复会话…
          </span>
        )}
        {/* 新会话按钮 */}
        {activeSessionId && streamState !== 'generating' && streamState !== 'restoring' && (
          <button
            onClick={() => {
              setActiveSessionId(undefined)
              setOutputText('')
              setPapers([])
              setGaps([])
              setRestoredTitle('')
              setStreamState('idle')
            }}
            className="text-xs text-scholar-text-secondary hover:text-scholar-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
            title="开始新会话"
          >
            <RotateCcw size={12} />
            新会话
          </button>
        )}
      </header>

      {/* 中心内容区 */}
      <div className="flex-1 overflow-hidden w-full flex flex-col p-4 md:p-8 items-center">
        <div className="w-full max-w-4xl h-full flex flex-col bg-scholar-bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.02)] rounded-xl border border-scholar-border overflow-hidden">

          {streamState === 'idle' ? (
            <EmptyState onClickChip={(text) => setInputText(text)} />
          ) : (
            <div className="flex-1 overflow-y-auto p-6 md:p-10" ref={scrollRef}>

              {/* 历史恢复提示条 */}
              {restoredTitle && (
                <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                  <RotateCcw size={12} />
                  {restoredTitle}
                </div>
              )}
              {/* papers 检索结果 */}
              {papers.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50/60 border border-blue-100 rounded-xl">
                  <p className="text-xs font-bold text-scholar-academic mb-3 uppercase tracking-wider">
                    检索到 {papers.length} 篇相关文献
                  </p>
                  <div className="space-y-2">
                    {papers.map(p => (
                      <div key={p.id} className="flex items-start justify-between gap-2">
                        <span className="text-sm text-scholar-text-primary leading-snug">{p.title ?? `检索文献 ${p.id}`}</span>
                        <span className="text-[11px] text-scholar-text-weak shrink-0 font-mono">
                          {p.year ?? '年份未知'} · {typeof p.score === 'number' ? `${(p.score * 100).toFixed(0)}%` : '相关度待补充'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* gaps 研究空白 */}
              {gaps.length > 0 && (
                <div className="mb-6 p-4 bg-purple-50/60 border border-purple-100 rounded-xl">
                  <p className="text-xs font-bold text-scholar-discovery mb-3 uppercase tracking-wider">
                    识别到 {gaps.length} 个研究空白
                  </p>
                  <div className="space-y-2">
                    {gaps.map(g => (
                      <div key={g.id} className="flex items-start gap-2">
                        <SeverityDot severity={g.severity} />
                        <span className="text-sm text-scholar-text-primary leading-snug">{g.description ?? '暂无研究空白描述'}</span>
                        {g.addressed_by === 0 && (
                          <span className="text-[10px] shrink-0 text-white bg-scholar-discovery px-1.5 py-0.5 rounded font-bold">未填补</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 正文 Markdown 输出 */}
              {outputText && (
                <div className="prose prose-sm md:prose-base prose-slate max-w-none
                  prose-headings:text-scholar-text-primary
                  prose-p:text-scholar-text-primary/90
                  prose-blockquote:border-l-scholar-primary
                  prose-blockquote:text-scholar-text-secondary
                  prose-code:bg-gray-100 prose-code:text-scholar-code
                  prose-strong:text-scholar-text-primary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {outputText}
                  </ReactMarkdown>
                </div>
              )}

              {/* 生成中光标 */}
              {streamState === 'generating' && (
                <span className="inline-block w-0.5 h-4 bg-scholar-primary animate-pulse ml-0.5 align-middle" />
              )}

              {/* 完成后操作按钮 */}
              {streamState === 'done' && outputText && !errorMsg && (
                <div className="mt-10 pt-6 border-t border-scholar-border/60 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <ActionButton icon={<ArrowRight size={14} />} text="继续提炼核心矛盾" onClick={() => {}} />
                  <ActionButton icon={<Sparkles size={14} />} text="改写为学术摘要语气" onClick={() => {}} />
                  <ActionButton
                    icon={<LinkIcon size={14} />}
                    text="一键导出为飞书云文档"
                    highlight
                    onClick={() => alert('飞书导出（待 P4 接入）')}
                  />
                </div>
              )}
            </div>
          )}

          {/* 底部输入区 */}
          <div className="p-4 border-t border-scholar-border bg-white mt-auto shrink-0">
            <div className="flex items-end bg-scholar-bg-canvas border border-scholar-border focus-within:border-scholar-primary/50 rounded-xl overflow-hidden shadow-sm transition-colors">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入要探索的课题，或载入指定的文献上下文… (Enter 发送，Shift+Enter 换行)"
                className="flex-1 max-h-40 min-h-[60px] bg-transparent outline-none p-4 text-sm resize-none text-scholar-text-primary"
              />
              <div className="p-3 shrink-0 flex flex-col gap-2">
                {streamState === 'generating' ? (
                  <button
                    onClick={handleAbort}
                    className="p-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    title="停止生成"
                  >
                    <span className="w-[18px] h-[18px] flex items-center justify-center">
                      <span className="w-3 h-3 bg-white rounded-sm" />
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={handleGenerate}
                    disabled={!inputText.trim()}
                    className="p-2.5 bg-scholar-primary text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-scholar-primary-hover transition-colors"
                  >
                    <Send size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------
function SeverityDot({ severity }: { severity: 'high' | 'medium' | 'low' | undefined }) {
  const color = severity === 'high'
    ? 'bg-red-400'
    : severity === 'medium'
      ? 'bg-yellow-400'
      : 'bg-green-400'
  return <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${color}`} />
}

function EmptyState({ onClickChip }: { onClickChip: (text: string) => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="w-16 h-16 bg-blue-50/50 text-scholar-primary rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
        <Sparkles size={32} />
      </div>
      <h2 className="text-2xl font-bold text-scholar-text-primary mb-3">开始严谨高效的学术创作</h2>
      <p className="text-scholar-text-secondary text-sm md:text-base text-center max-w-md mb-10">
        将数百篇文献的智慧与你的灵感交织。工作台强制伴随证据输出，杜绝 AI 幻觉。
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
        <Chip text="整理指定课题文献综述" onClick={() => onClickChip('请帮我整理基于多模态大模型的最新文献综述，重点关注架构演进。')} />
        <Chip text="生成开题报告大纲"     onClick={() => onClickChip('我准备写一篇关于行为经济学沉没成本的开题报告，请帮我生成结构化大纲。')} />
        <Chip text="润色为学术段落"       onClick={() => onClickChip('请将我复制到输入框的口语化文字，逐句润色为严谨的学术论文论述调性。')} />
        <Chip text="提炼交叉领域研究空白" onClick={() => onClickChip('分析人工智能生成内容（AIGC）与传统版权保护法案之间的冲突核心与研究空白。')} />
      </div>
    </div>
  )
}

function Chip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="py-3 px-4 bg-scholar-bg-canvas border border-scholar-border text-sm text-scholar-text-secondary hover:text-scholar-primary hover:border-scholar-primary/30 rounded-xl text-left transition-all flex items-center space-x-2 group"
    >
      <Play size={14} className="opacity-40 group-hover:opacity-100" />
      <span>{text}</span>
    </button>
  )
}

function ActionButton({
  icon, text, highlight, onClick,
}: {
  icon: React.ReactNode; text: string; highlight?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
        highlight
          ? 'bg-blue-50 text-scholar-primary border-blue-100 hover:bg-blue-100'
          : 'bg-scholar-bg-surface text-scholar-text-secondary border-scholar-border hover:bg-scholar-bg-canvas hover:text-scholar-text-primary'
      }`}
    >
      {icon}
      <span>{text}</span>
    </button>
  )
}
