import { useState } from 'react'
import { SurveyStep } from './SurveyStep'
import { apiFetch } from '../../api/client'
import { useUserStore } from '../../store/user'

interface Props {
  onComplete: () => void
}

const STEPS = [
  {
    question: '如果 AI 作为写作助教，你希望它怎么帮你？',
    key: 'q13',
    options: [
      { label: '严格拆步引导', description: '不直接代写，引导你一步步完成', value: '严格拆步推进，不直接代写' },
      { label: '指出问题方向', description: '告诉你哪里有问题，给 2-3 个修改方向', value: '指出问题并给 2-3 个修改方向' },
      { label: '先给示例改写', description: '先给可用的示例，再解释原因', value: '先给可用改写，再解释原因' },
    ],
  },
  {
    question: '你偏好的反馈详略程度是？',
    key: 'q14',
    options: [
      { label: '简洁', description: '直接点出问题，不展开', value: '简洁' },
      { label: '平衡', description: '重要问题展开，细节一句带过', value: '平衡' },
      { label: '详细', description: '逐条给出原因和修改建议', value: '详细' },
    ],
  },
  {
    question: '你目前的学术写作阶段是？',
    key: 'q9',
    options: [
      { label: '零基础', description: '从未写过学术论文', value: '零基础' },
      { label: '正在写第一篇', description: '有一定了解但不熟练', value: '正在写第一篇' },
      { label: '有投稿/发表经历', description: '', value: '有投稿/发表经历' },
    ],
  },
]

type Answers = Record<string, string>

export function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [loading, setLoading] = useState(false)
  const setProfile = useUserStore((s) => s.setProfile)

  const current = STEPS[step]
  const selected = answers[current.key] ?? null

  const handleNext = async () => {
    if (!selected) return
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
      return
    }
    setLoading(true)
    try {
      await apiFetch('/api/profile/init', {
        method: 'POST',
        body: JSON.stringify({ q13: answers.q13, q14: answers.q14, q9: answers.q9 }),
      })
    } catch {
      // Non-critical — complete onboarding even if save fails
    } finally {
      setProfile({ hasCompletedOnboarding: true })
      setLoading(false)
      onComplete()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-lg bg-white rounded-xl p-6 shadow-xl">
        <h2 className="text-base font-semibold text-gray-900 mb-5">快速设置（{step + 1}/{STEPS.length}）</h2>

        <SurveyStep
          question={current.question}
          options={current.options}
          selected={selected}
          onSelect={(value) => setAnswers((a) => ({ ...a, [current.key]: value }))}
        />

        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${i === step ? 'bg-blue-600' : i < step ? 'bg-blue-300' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={!selected || loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            {loading ? '保存中…' : step < STEPS.length - 1 ? '下一步' : '开始使用'}
          </button>
        </div>
      </div>
    </div>
  )
}
