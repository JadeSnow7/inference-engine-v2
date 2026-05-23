import type { ReferenceItem } from '../../types/workspace'
import { Badge } from '../../components/ui'

interface CitationCardProps {
  reference: ReferenceItem
}

export function CitationCard({ reference }: CitationCardProps) {
  return (
    <article className="rounded-xl border border-scholar-border bg-white p-3 shadow-sm">
      <h3 className="line-clamp-2 text-sm font-bold text-scholar-text-primary">{reference.title}</h3>
      <p className="mt-1 text-xs text-scholar-text-weak">
        {[reference.venue, reference.year].filter(Boolean).join(' · ') || '来源待补充'}
      </p>
      {reference.excerpt && (
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-scholar-text-secondary">{reference.excerpt}</p>
      )}
      {typeof reference.score === 'number' && (
        <Badge tone="primary" className="mt-2">相关度 {Math.round(reference.score * 100)}%</Badge>
      )}
      {reference.evidenceStatus === 'unresolved' && (
        <Badge tone="warning" className="mt-2">unresolved</Badge>
      )}
    </article>
  )
}
