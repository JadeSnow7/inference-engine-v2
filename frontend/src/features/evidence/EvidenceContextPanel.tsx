import { useWorkspaceStore } from '../../store/workspace'

export function EvidenceContextPanel() {
  const references = useWorkspaceStore(state => state.references)
  const documentBlocks = useWorkspaceStore(state => state.documentBlocks)
  const selectedBlockId = useWorkspaceStore(state => state.selectedBlockId)
  const selectedBlock = documentBlocks.find(block => block.id === selectedBlockId)
  const selectedReferenceIds = new Set(selectedBlock?.citations?.map(citation => citation.referenceId) ?? [])
  const linked = selectedBlockId
    ? references.filter(reference => selectedReferenceIds.has(reference.id))
    : references

  if (linked.length === 0) {
    return <div className="rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas p-4 text-sm text-scholar-text-secondary">暂无关联证据</div>
  }

  return (
    <div className="space-y-3">
      {linked.map(reference => (
        <article key={reference.id} className="rounded-xl border border-scholar-border bg-white p-3">
          <h3 className="text-sm font-bold text-scholar-text-primary">{reference.title}</h3>
          <p className="mt-1 text-xs text-scholar-text-secondary">{[reference.venue, reference.year].filter(Boolean).join(' · ') || '来源待补充'}</p>
        </article>
      ))}
    </div>
  )
}
