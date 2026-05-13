import { useEffect, useState } from 'react'
import { fetchSettings, updateSettings, type WorkspaceSettings } from '../../api/settings'

interface SettingsDialogProps {
  onClose: () => void
}

const fallbackSettings: WorkspaceSettings = {
  workspaceDensity: 'comfortable',
  autoSave: true,
  notificationsEnabled: true,
  citationStyle: 'GB/T 7714',
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [settings, setSettings] = useState<WorkspaceSettings>(fallbackSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setErrorMessage(null)

    fetchSettings()
      .then(response => {
        if (!isCurrent) return
        setSettings(response)
      })
      .catch(error => {
        if (!isCurrent) return
        setErrorMessage(error instanceof Error ? error.message : '设置暂时不可用')
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [])

  const handleSave = async () => {
    const saved = await updateSettings(settings)
    setSettings(saved)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="工作区设置"
        className="w-full max-w-md rounded-xl border border-scholar-border bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-scholar-text-primary">工作区设置</h2>
            <p className="mt-1 text-xs leading-5 text-scholar-text-secondary">调整当前工作区的显示和提醒偏好。</p>
          </div>
          <button type="button" className="rounded-lg px-2 py-1 text-sm text-scholar-text-secondary hover:bg-scholar-bg-canvas" onClick={onClose}>
            关闭
          </button>
        </div>

        {isLoading && <div className="mt-4 rounded-lg bg-scholar-bg-canvas p-3 text-sm text-scholar-text-secondary">正在加载设置...</div>}
        {!isLoading && errorMessage && <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-600">{errorMessage}</div>}

        {!isLoading && !errorMessage && (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-scholar-text-primary">
              工作区密度
              <select
                aria-label="工作区密度"
                value={settings.workspaceDensity}
                onChange={event => setSettings(current => ({ ...current, workspaceDensity: event.target.value as WorkspaceSettings['workspaceDensity'] }))}
                className="mt-2 h-10 w-full rounded-xl border border-scholar-border bg-white px-3 text-sm font-normal outline-none focus:border-scholar-primary focus:ring-4 focus:ring-blue-100"
              >
                <option value="comfortable">舒适</option>
                <option value="compact">紧凑</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-scholar-border bg-scholar-bg-canvas p-3 text-sm font-semibold text-scholar-text-primary">
              自动保存
              <input
                aria-label="自动保存"
                type="checkbox"
                checked={settings.autoSave}
                onChange={event => setSettings(current => ({ ...current, autoSave: event.target.checked }))}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-scholar-border bg-scholar-bg-canvas p-3 text-sm font-semibold text-scholar-text-primary">
              通知提醒
              <input
                aria-label="通知提醒"
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={event => setSettings(current => ({ ...current, notificationsEnabled: event.target.checked }))}
              />
            </label>

            <label className="block text-sm font-semibold text-scholar-text-primary">
              引用格式
              <select
                aria-label="引用格式"
                value={settings.citationStyle}
                onChange={event => setSettings(current => ({ ...current, citationStyle: event.target.value }))}
                className="mt-2 h-10 w-full rounded-xl border border-scholar-border bg-white px-3 text-sm font-normal outline-none focus:border-scholar-primary focus:ring-4 focus:ring-blue-100"
              >
                <option value="GB/T 7714">GB/T 7714</option>
                <option value="APA">APA</option>
                <option value="MLA">MLA</option>
              </select>
            </label>

            <button
              type="button"
              className="w-full rounded-xl bg-scholar-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-scholar-primary-hover"
              onClick={() => void handleSave()}
            >
              保存设置
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
