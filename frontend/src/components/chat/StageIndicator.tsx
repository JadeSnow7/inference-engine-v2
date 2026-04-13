import { usePipelineStore } from '../../store/pipeline'
import { useChatStore } from '../../store/chat'

const PRESET_STAGES = ['路由中', '意图解析', '文献检索中', '研究空白分析', '大纲生成', '审核修订']

export function StageIndicator() {
  const isStreaming = useChatStore((s) => s.isStreaming)
  const stageHistory = usePipelineStore((s) => s.stageHistory)
  const currentStage = usePipelineStore((s) => s.currentStage)

  // Use preset order if all stages are known presets; otherwise show history as-is
  const allPreset = stageHistory.every((s) => PRESET_STAGES.includes(s))
  const stages = allPreset ? PRESET_STAGES : stageHistory

  return (
    // Constraint 6: opacity toggle — no layout shift
    <div
      className={`px-4 py-1.5 flex items-center gap-1 overflow-x-auto transition-opacity duration-200 ${
        isStreaming && stageHistory.length > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ minHeight: '28px' }}
    >
      {stages.map((stage, i) => {
        const isDone = allPreset
          ? PRESET_STAGES.indexOf(stage) < PRESET_STAGES.indexOf(currentStage ?? '')
          : i < stageHistory.length - 1
        const isCurrent = stage === currentStage

        return (
          <div key={stage} className="flex items-center gap-1 shrink-0">
            {i > 0 && <span className="text-gray-300 text-xs">—</span>}
            <span
              className={`text-xs ${
                isDone
                  ? 'text-gray-400'
                  : isCurrent
                  ? 'text-blue-600 font-semibold'
                  : 'text-gray-300'
              }`}
            >
              {isDone ? '✓ ' : isCurrent ? '● ' : '○ '}{stage}
            </span>
          </div>
        )
      })}
    </div>
  )
}
