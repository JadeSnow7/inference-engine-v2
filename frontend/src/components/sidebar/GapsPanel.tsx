import { useSidebarStore } from '../../store/sidebar'
import type { GapItem } from '../../types/events'

const SEVERITY_STYLES: Record<GapItem['severity'], string> = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-yellow-400',
  low: 'border-l-4 border-l-gray-300',
}

const HIGH_ADDRESSED_STYLE = 'border-l-4 border-l-orange-400'

export function GapsPanel() {
  const gaps = useSidebarStore((s) => s.gaps)

  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm px-4 text-center">
        发送消息后，研究空白将显示在此处
      </div>
    )
  }

  return (
    <div className="space-y-2 p-3">
      {gaps.map((gap) => {
        const isUnfilled = gap.severity === 'high' && gap.addressed_by === 0
        const borderClass =
          gap.severity === 'high' && gap.addressed_by > 0
            ? HIGH_ADDRESSED_STYLE
            : SEVERITY_STYLES[gap.severity]

        return (
          <div key={gap.id} className={`border rounded-lg p-3 text-sm ${borderClass}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-medium ${
                isUnfilled ? 'text-red-600' : gap.severity === 'high' ? 'text-orange-600' : 'text-gray-500'
              }`}>
                {gap.severity.toUpperCase()}
              </span>
              {isUnfilled && (
                <span className="text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">未填补</span>
              )}
            </div>
            {isUnfilled && (
              <p className="text-xs text-blue-600 mb-1.5">
                此空白暂无文献填补，可作为你的研究切入点
              </p>
            )}
            <p className="text-gray-700 leading-snug">{gap.description}</p>
          </div>
        )
      })}
    </div>
  )
}
