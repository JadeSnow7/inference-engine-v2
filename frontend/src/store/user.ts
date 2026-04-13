import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface Profile {
  teachingStyle: 'step_by_step' | 'directional' | 'rewrite_first' | null
  feedbackVerbosity: 'concise' | 'balanced' | 'detailed' | null
  writingStage: string | null
  hasCompletedOnboarding: boolean
}

interface UserState {
  token: string | null
  userId: string | null
  profile: Profile
  setToken: (token: string, userId?: string) => void
  setProfile: (profile: Partial<Profile>) => void
  logout: () => void
}

const defaultProfile: Profile = {
  teachingStyle: null,
  feedbackVerbosity: null,
  writingStage: null,
  hasCompletedOnboarding: false,
}

export const useUserStore = create<UserState>()(
  persist(
    immer((set) => ({
      token: null,
      userId: null,
      profile: { ...defaultProfile },

      setToken: (token, userId) => set((s) => {
        s.token = token
        s.userId = userId ?? null
        localStorage.setItem('edu_token', token)
      }),

      setProfile: (partial) => set((s) => {
        Object.assign(s.profile, partial)
      }),

      logout: () => set((s) => {
        s.token = null
        s.userId = null
        s.profile = { ...defaultProfile }
        localStorage.removeItem('edu_token')
      }),
    })),
    { name: 'edu_user' },
  ),
)
