import type { DocumentBlock } from '../../types/workspace'

export function DocumentOutlineCard({ blocks }: { blocks: DocumentBlock[] }) {
  const headings = blocks.filter(block => block.type === 'heading' || block.title)

  return (
    <aside className="sticky top-4 hidden w-44 shrink-0 rounded-2xl border border-scholar-border bg-white/95 p-4 shadow-lg shadow-slate-100 xl:block">
      <h3 className="mb-3 text-sm font-bold">大纲</h3>
      <div className="space-y-2">
        {headings.map((block, index) => (
          <a
            key={block.id}
            className={`block truncate text-xs leading-relaxed transition hover:text-scholar-primary ${
              index === 0 ? 'font-semibold text-scholar-primary' : 'text-scholar-text-secondary'
            }`}
            href={`#${block.id}`}
          >
            {block.title ?? block.content}
          </a>
        ))}
      </div>
    </aside>
  )
}
