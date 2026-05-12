import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { useProfile } from '../useProfile'
import { fetchProfile } from '../../api/sessions'
import { useUserStore } from '../../store/user'

vi.mock('../../api/sessions', () => ({
  fetchProfile: vi.fn(),
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

function ProfileProbe() {
  useProfile()
  return null
}

describe('useProfile', () => {
  beforeEach(() => {
    installMemoryStorage()
    vi.mocked(fetchProfile).mockReset()
    useUserStore.setState({
      token: 'token-1',
      userId: 'alex@hust.edu.cn',
      profileStatus: 'idle',
      profileError: '',
      profile: {
        teachingStyle: null,
        feedbackVerbosity: null,
        writingStage: null,
        hasCompletedOnboarding: false,
      },
    })
  })

  it('loads backend profile for an authenticated user and maps it into user store', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({
      teaching_style: 'step_by_step',
      feedback_verbosity: 'balanced',
      writing_stage: '正在写第一篇',
      major: 'Computer Science',
      weak_points: {},
      total_sessions: 3,
      last_session_at: 1778510000,
    })

    render(<ProfileProbe />)

    await waitFor(() => expect(useUserStore.getState().profileStatus).toBe('loaded'))
    expect(fetchProfile).toHaveBeenCalledTimes(1)
    expect(useUserStore.getState().profile).toMatchObject({
      teachingStyle: 'step_by_step',
      feedbackVerbosity: 'balanced',
      writingStage: '正在写第一篇',
      hasCompletedOnboarding: true,
    })
  })
})
