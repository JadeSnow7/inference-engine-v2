import { ChevronRight, FileText } from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspace'
import type { GapItem, PaperItem } from '../../types/events'
import type { DocumentBlock, WorkspaceGraphNode } from '../../types/workspace'

const typeLabels: Record<WorkspaceGraphNode['type'], string> = {
  core: '核心主题',
  concept: '核心概念',
  method: '方法',
  technology: '技术',
  paper: '论文',
  gap: '研究空白',
}

export function NodeDetailCard({ node }: { node: WorkspaceGraphNode }) {
  const references = useWorkspaceStore(state => state.references)
  const ragPapers = useWorkspaceStore(state => state.ragPapers)
  const ragGaps = useWorkspaceStore(state => state.ragGaps)
  const documentBlocks = useWorkspaceStore(state => state.documentBlocks)
  const selectedBlockId = useWorkspaceStore(state => state.selectedBlockId)
  const setSelectedBlock = useWorkspaceStore(state => state.setSelectedBlock)
  const relatedReferences = node.referenceIds
    .map(id => references.find(reference => reference.id === id))
    .filter(reference => reference !== undefined)
  const dynamicPaper = node.type === 'paper' ? findDynamicPaper(node, ragPapers) : undefined
  const dynamicGap = node.type === 'gap' ? findDynamicGap(node, ragGaps) : undefined
  const relatedBlocks = findRelatedBlocks(node, documentBlocks)

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-scholar-primary to-scholar-discovery text-white shadow-md shadow-blue-100">
          <FileText size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-black">{node.label}</h3>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-scholar-primary">
              {typeLabels[node.type]}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-scholar-text-secondary">{node.description}</p>
        </div>
      </div>

      {dynamicPaper && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2">
          <div className="text-xs font-bold text-scholar-primary">本轮 SSE 检索结果</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-scholar-text-secondary">
            <InfoPill label="年份" value={formatYear(dynamicPaper.year)} />
            <InfoPill label="相关度" value={formatScore(dynamicPaper.score)} />
          </div>
          <p className="mt-2 text-xs leading-5 text-scholar-text-secondary">
            {dynamicPaper.title ?? node.label}
          </p>
        </div>
      )}

      {dynamicGap && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2">
          <div className="text-xs font-bold text-amber-800">本轮 SSE 检索结果</div>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-amber-800">
            <InfoPill label="风险等级" value={severityLabel(dynamicGap.severity)} />
            <InfoPill label="填补情况" value={formatAddressedBy(dynamicGap.addressed_by)} />
            <InfoPill label="相关度" value={formatScore(dynamicGap.score)} />
          </div>
          <p className="mt-2 text-xs leading-5 text-amber-800">
            {dynamicGap.description ?? node.label}
          </p>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-black">相关文献（{relatedReferences.length}）</h4>
        </div>
        <div className="space-y-2">
          {relatedReferences.map((reference, index) => (
            <article key={reference.id} className="rounded-xl border border-scholar-border bg-white px-3 py-2 transition hover:border-scholar-primary/30 hover:bg-blue-50/30">
              <div className="flex gap-2">
                <span className="text-xs font-bold text-scholar-text-weak">{index + 1}.</span>
                <div className="min-w-0">
                  <h5 className="line-clamp-2 text-sm font-bold leading-5 text-scholar-text-primary">{reference.title}</h5>
                  <p className="mt-1 text-xs text-scholar-text-weak">
                    {formatReferenceMeta(reference.authors, reference.year, reference.venue, reference.score)}
                  </p>
                </div>
              </div>
            </article>
          ))}
          {relatedReferences.length === 0 && (
            <div className="rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas px-3 py-3 text-sm text-scholar-text-secondary">
              暂无可解释检索证据
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-black">关联正文段落</h4>
        </div>
        <div className="space-y-2">
          {relatedBlocks.map(block => (
            <button
              key={block.id}
              type="button"
              aria-label={`定位正文段落 ${block.id}`}
              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                selectedBlockId === block.id
                  ? 'border-scholar-primary bg-blue-50'
                  : 'border-scholar-border bg-white hover:border-scholar-primary/30 hover:bg-blue-50/30'
              }`}
              onClick={() => setSelectedBlock(block.id)}
            >
              <div className="text-xs font-bold text-scholar-primary">{block.title ?? '正文段落'}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-scholar-text-secondary">
                {formatBlockPreview(block)}
              </p>
            </button>
          ))}
          {relatedBlocks.length === 0 && (
            <div className="rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas px-3 py-3 text-sm text-scholar-text-secondary">
              暂无关联正文段落
            </div>
          )}
        </div>
      </div>

      <button className="flex w-full items-center justify-center gap-1 rounded-xl border border-scholar-border bg-white px-3 py-2 text-sm font-semibold text-scholar-text-secondary transition hover:border-scholar-primary/30 hover:bg-blue-50 hover:text-scholar-primary">
        查看更多
        <ChevronRight size={15} />
      </button>
    </section>
  )
}

function findRelatedBlocks(node: WorkspaceGraphNode, blocks: DocumentBlock[]): DocumentBlock[] {
  const relatedIds = new Set(node.blockIds ?? [])

  blocks.forEach(block => {
    if (block.type !== 'paragraph') return
    const hasRelatedReference = block.citations?.some(citation => node.referenceIds.includes(citation.referenceId))
    if (hasRelatedReference) relatedIds.add(block.id)
  })

  return blocks.filter(block => block.type === 'paragraph' && relatedIds.has(block.id))
}

function formatBlockPreview(block: DocumentBlock): string {
  if (block.title) return `段落 ID：${block.id}`

  const content = block.content.trim()
  const excerpt = content.length > 32 ? content.slice(24, 96) : content.slice(0, 12)
  return `内容摘要：${excerpt}...`
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/75 px-2 py-1">
      <span className="font-semibold">{label}：</span>
      <span>{value}</span>
    </div>
  )
}

function findDynamicPaper(node: WorkspaceGraphNode, papers: PaperItem[]): PaperItem | undefined {
  const paperId = node.id.startsWith('paper:') ? node.id.slice('paper:'.length) : node.referenceIds[0]
  return papers.find(paper => paper.id === paperId)
}

function findDynamicGap(node: WorkspaceGraphNode, gaps: GapItem[]): GapItem | undefined {
  const gapId = node.id.startsWith('gap:') ? node.id.slice('gap:'.length) : node.id
  return gaps.find(gap => gap.id === gapId)
}

function formatReferenceMeta(authors: string | undefined, year: number | undefined, venue: string | undefined, score: number | undefined): string {
  const source = [authors, venue].filter(Boolean).join(' · ') || '来源待补充'
  const scoreText = typeof score === 'number' ? ` · 相关度 ${Math.round(score * 100)}%` : ''
  return `${source}（${formatYear(year)}）${scoreText}`
}

function formatYear(year: number | undefined): string {
  return typeof year === 'number' ? `${year}` : '年份未知'
}

function formatScore(score: number | undefined): string {
  return typeof score === 'number' ? `相关度 ${Math.round(score * 100)}%` : '相关度待补充'
}

function formatAddressedBy(addressedBy: number | undefined): string {
  if (typeof addressedBy !== 'number') return '暂无填补文献统计'
  return addressedBy === 0 ? '暂无文献填补' : `${addressedBy} 篇文献涉及`
}

function severityLabel(severity: GapItem['severity']): string {
  if (!severity) return '暂无风险等级'

  switch (severity) {
    case 'high':
      return '高风险空白'
    case 'medium':
      return '中等空白'
    case 'low':
      return '低风险空白'
  }
}
