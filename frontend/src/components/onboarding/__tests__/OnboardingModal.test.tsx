import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { OnboardingModal } from '../OnboardingModal'
import { apiFetch } from '../../../api/client'
import { useUserStore } from '../../../store/user'

vi.mock('../../../api/client', () => ({
  apiFetch: vi.fn(),
}))

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

describe('OnboardingModal', () => {
  beforeEach(() => {
    installMemoryStorage()
    vi.mocked(apiFetch).mockReset()
    useUserStore.setState({
      token: 'token-1',
      userId: 'alex@hust.edu.cn',
      profile: {
        teachingStyle: null,
        feedbackVerbosity: null,
        writingStage: null,
        hasCompletedOnboarding: false,
      },
    })
  })

  it('keeps onboarding incomplete and shows an inline retry error when profile init fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('server down'))
    const onComplete = vi.fn()

    render(<OnboardingModal onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: /严格拆步引导/ }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: /平衡/ }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: /正在写第一篇/ }))
    fireEvent.click(screen.getByRole('button', { name: '开始使用' }))

    expect(await screen.findByText('保存失败，请重试。')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
    expect(useUserStore.getState().profile.hasCompletedOnboarding).toBe(false)
  })

  it('marks onboarding complete only after profile init succeeds', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true })
    const onComplete = vi.fn()

    render(<OnboardingModal onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: /严格拆步引导/ }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: /平衡/ }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: /正在写第一篇/ }))
    fireEvent.click(screen.getByRole('button', { name: '开始使用' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(useUserStore.getState().profile.hasCompletedOnboarding).toBe(true)
  })
})
