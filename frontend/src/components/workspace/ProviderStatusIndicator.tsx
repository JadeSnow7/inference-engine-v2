import { CloudCog, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchConfigStatus, type ConfigStatus } from '../../api/config'

function providerLabel(status: ConfigStatus | null): string {
  if (!status) return 'AI 状态'
  if (status.active_provider === 'bailian_app') return '百炼优先'
  if (status.provider_preference === 'bailian_first') return '百炼回退'
  return '通用模型'
}

export function ProviderStatusIndicator() {
  const [status, setStatus] = useState<ConfigStatus | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = () => {
    setError('')
    fetchConfigStatus()
      .then(setStatus)
      .catch(() => setError('状态不可用'))
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const label = providerLabel(status)
  const model = status?.llm.model ?? '加载中'
  const bailianText = status?.bailian_app.configured ? '百炼 App：已启用' : '百炼 App：未启用'
  const searchText = '公网搜索：未接入'

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`当前 AI 能力：${label}`}
        className="hidden min-w-[150px] items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 xl:flex"
        onClick={() => setIsOpen(open => !open)}
      >
        <CloudCog size={16} />
        <span className="min-w-0 leading-tight">
          <span className="block font-semibold">{label}</span>
          <span className="block truncate text-[11px] text-emerald-700">{model}</span>
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-30 w-72 rounded-xl border border-scholar-border bg-white p-4 text-sm shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold text-scholar-text-primary">当前 AI 能力</div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-scholar-text-secondary transition hover:bg-scholar-bg-canvas hover:text-scholar-primary"
              onClick={loadStatus}
              aria-label="刷新 AI 能力状态"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <div className="space-y-2 text-scholar-text-secondary">
            <div>模型：{model}</div>
            <div>{bailianText}</div>
            <div>RAG：{status?.rag.configured ? status.rag.provider : '未启用'}</div>
            <div>{searchText}</div>
            {error && <div className="text-red-600">{error}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
