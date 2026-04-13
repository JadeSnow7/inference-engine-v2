import { useSidebarStore } from '../../store/sidebar'

export function LiteraturePanel() {
  const papers = useSidebarStore((s) => s.papers)

  if (papers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm px-4 text-center">
        发送消息后，相关文献将显示在此处
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      {papers.map((paper) => (
        <div key={paper.id} className="border rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.round(paper.score * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0">
              {Math.round(paper.score * 100)}%
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
              {paper.year}
            </span>
            <p className="text-gray-700 line-clamp-2 leading-snug">{paper.title}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
