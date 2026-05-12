import { BookMarked } from 'lucide-react'
import { StateBlock } from '../../components/ui'
import type { ReferenceItem } from '../../types/workspace'
import { CitationCard } from './CitationCard'

interface ReferenceListProps {
  references: ReferenceItem[]
  limit?: number
}

export function ReferenceList({ references, limit }: ReferenceListProps) {
  const visibleReferences = typeof limit === 'number' ? references.slice(0, limit) : references

  if (visibleReferences.length === 0) {
    return <StateBlock title="暂无上下文证据" description="生成或恢复会话后，引用来源会显示在这里。" icon={<BookMarked size={20} />} />
  }

  return (
    <div className="space-y-3">
      {visibleReferences.map(reference => (
        <CitationCard key={reference.id} reference={reference} />
      ))}
    </div>
  )
}
