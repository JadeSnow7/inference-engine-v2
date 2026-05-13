import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { GlobalTopBar } from '../GlobalTopBar'
import { LeftSidebar } from '../../../features/workspace/LeftSidebar'
import { useUserStore } from '../../../store/user'
import { useWorkspaceStore } from '../../../store/workspace'

const fetchNotifications = vi.hoisted(() => vi.fn())
const markNotificationRead = vi.hoisted(() => vi.fn())
const fetchSettings = vi.hoisted(() => vi.fn())
const updateSettings = vi.hoisted(() => vi.fn())

vi.mock('../../../api/notifications', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotifications(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationRead(...args),
}))

vi.mock('../../../api/settings', () => ({
  fetchSettings: (...args: unknown[]) => fetchSettings(...args),
  updateSettings: (...args: unknown[]) => updateSettings(...args),
}))

function renderWithRouter(node: ReactNode) {
  render(<BrowserRouter>{node}</BrowserRouter>)
}

function installMemoryStorage() {
  const values = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  vi.stubGlobal('localStorage', localStorage)
  useUserStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) })
}

describe('notifications and settings controls', () => {
  beforeEach(() => {
    installMemoryStorage()
    fetchNotifications.mockReset()
    markNotificationRead.mockReset()
    fetchSettings.mockReset()
    updateSettings.mockReset()
    fetchNotifications.mockResolvedValue({
      unreadCount: 1,
      items: [{
        id: 'norm-reminder',
        title: '规范校验提醒',
        body: '有 3 处引用格式建议需要处理。',
        kind: 'warning',
        read: false,
        createdAt: '2026-05-13T00:00:00Z',
      }],
    })
    markNotificationRead.mockResolvedValue({
      id: 'norm-reminder',
      title: '规范校验提醒',
      body: '有 3 处引用格式建议需要处理。',
      kind: 'warning',
      read: true,
      createdAt: '2026-05-13T00:00:00Z',
    })
    fetchSettings.mockResolvedValue({
      workspaceDensity: 'comfortable',
      autoSave: true,
      notificationsEnabled: true,
      citationStyle: 'GB/T 7714',
    })
    updateSettings.mockResolvedValue({
      workspaceDensity: 'compact',
      autoSave: true,
      notificationsEnabled: false,
      citationStyle: 'GB/T 7714',
    })
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('loads notifications and marks a notification as read', async () => {
    renderWithRouter(<GlobalTopBar />)

    fireEvent.click(screen.getByRole('button', { name: '通知' }))

    expect(await screen.findByText('规范校验提醒')).toBeInTheDocument()
    expect(screen.getByText('有 3 处引用格式建议需要处理。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '标记已读' }))

    expect(markNotificationRead).toHaveBeenCalledWith('norm-reminder')
  })

  it('loads and saves settings from the top bar settings button', async () => {
    renderWithRouter(<GlobalTopBar />)

    fireEvent.click(screen.getByRole('button', { name: '设置' }))

    expect(await screen.findByRole('dialog', { name: '工作区设置' })).toBeInTheDocument()
    fireEvent.change(await screen.findByLabelText('工作区密度'), { target: { value: 'compact' } })
    fireEvent.click(screen.getByLabelText('通知提醒'))
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    expect(updateSettings).toHaveBeenCalledWith({
      workspaceDensity: 'compact',
      autoSave: true,
      notificationsEnabled: false,
      citationStyle: 'GB/T 7714',
    })
  })

  it('opens settings from the left sidebar footer', async () => {
    renderWithRouter(<LeftSidebar />)

    fireEvent.click(screen.getByRole('button', { name: '设置' }))

    expect(await screen.findByRole('dialog', { name: '工作区设置' })).toBeInTheDocument()
  })
})
