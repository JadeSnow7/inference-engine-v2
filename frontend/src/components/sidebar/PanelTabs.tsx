import { useSidebarStore } from '../../store/sidebar'
import { LiteraturePanel } from './LiteraturePanel'
import { GapsPanel } from './GapsPanel'

export function PanelTabs() {
  const activeTab = useSidebarStore((s) => s.activeTab)
  const setActiveTab = useSidebarStore((s) => s.setActiveTab)
  const paperCount = useSidebarStore((s) => s.papers.length)
  const gapCount = useSidebarStore((s) => s.gaps.length)

  const tabs = [
    { key: 'papers' as const, label: '相关文献', count: paperCount },
    { key: 'gaps' as const, label: '研究空白', count: gapCount },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}{tab.count > 0 ? `（${tab.count}）` : ''}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'papers' ? <LiteraturePanel /> : <GapsPanel />}
      </div>
    </div>
  )
}
