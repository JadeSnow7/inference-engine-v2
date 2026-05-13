import { apiFetch } from './client'

export interface NotificationItem {
  id: string
  title: string
  body: string
  kind: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  createdAt: string
}

export interface NotificationsResponse {
  items: NotificationItem[]
  unreadCount: number
}

export function fetchNotifications(): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>('/api/notifications')
}

export function markNotificationRead(notificationId: string): Promise<NotificationItem> {
  return apiFetch<NotificationItem>(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
  })
}
