import { useEffect, useState } from 'react'
import { fetchNotifications, markNotificationRead, type NotificationItem } from '../../api/notifications'

export function NotificationsPopover() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setErrorMessage(null)

    fetchNotifications()
      .then(response => {
        if (!isCurrent) return
        setItems(response.items)
      })
      .catch(error => {
        if (!isCurrent) return
        setItems([])
        setErrorMessage(error instanceof Error ? error.message : '通知暂时不可用')
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

  const handleMarkRead = async (notificationId: string) => {
    const updated = await markNotificationRead(notificationId)
    setItems(current => current.map(item => (item.id === notificationId ? updated : item)))
  }

  return (
    <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-scholar-border bg-white p-3 shadow-xl">
      <div className="mb-2 text-sm font-bold text-scholar-text-primary">通知</div>
      {isLoading && <div className="rounded-lg bg-scholar-bg-canvas p-3 text-xs text-scholar-text-secondary">正在加载通知...</div>}
      {!isLoading && errorMessage && <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-600">{errorMessage}</div>}
      {!isLoading && !errorMessage && items.length === 0 && (
        <div className="rounded-lg bg-scholar-bg-canvas p-3 text-xs text-scholar-text-secondary">暂无通知</div>
      )}
      {!isLoading && !errorMessage && items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => (
            <article key={item.id} className="rounded-lg border border-scholar-border bg-scholar-bg-canvas p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-scholar-text-primary">{item.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-scholar-text-secondary">{item.body}</p>
                </div>
                {!item.read && (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-scholar-primary" aria-label="未读" />
                )}
              </div>
              {!item.read && (
                <button
                  type="button"
                  className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-scholar-primary transition hover:bg-blue-50"
                  onClick={() => void handleMarkRead(item.id)}
                >
                  标记已读
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
