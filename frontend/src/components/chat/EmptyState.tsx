import { useSSE } from '../../hooks/useSSE'

const QUICK_STARTS = [
  '帮我生成开题报告大纲',
  '整理相关文献综述',
  '润色这段论文内容',
]

export function EmptyState() {
  const { send } = useSSE()

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
      <p className="text-gray-500 text-sm">发送消息开始学术写作辅助</p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {QUICK_STARTS.map((text) => (
          <button
            key={text}
            onClick={() => send(text)}
            className="px-4 py-2.5 text-sm text-left border rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors text-gray-700"
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
