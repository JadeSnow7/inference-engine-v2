import { useState } from 'react'
import { useSSE } from '../../hooks/useSSE'
import { useUserStore } from '../../store/user'
import { OnboardingModal } from '../onboarding/OnboardingModal'
import { StageIndicator } from './StageIndicator'

export function InputBar() {
  const [value, setValue] = useState('')
  const { send, isStreaming } = useSSE()
  const hasCompletedOnboarding = useUserStore((s) => s.profile.hasCompletedOnboarding)
  const token = useUserStore((s) => s.token)
  const [showOnboarding, setShowOnboarding] = useState(!!token && !hasCompletedOnboarding)

  const handleSubmit = () => {
    if (!value.trim() || isStreaming) return
    send(value.trim())
    setValue('')
  }

  return (
    <>
      <StageIndicator />
      <div className="px-4 py-3 flex gap-2 items-end border-t bg-white">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="描述写作需求，例如：帮我生成关于芯片功耗预测的开题报告大纲"
          disabled={isStreaming}
          rows={2}
          className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={isStreaming || !value.trim()}
          className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isStreaming ? '生成中…' : '发送'}
        </button>
      </div>

      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}
    </>
  )
}
