import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

interface Profile {
  teachingStyle: 'step_by_step' | 'directional' | 'rewrite_first' | null
  feedbackVerbosity: 'concise' | 'balanced' | 'detailed' | null
  writingStage: string | null
  hasCompletedOnboarding: boolean
}

type ProfileStatus = 'idle' | 'loading' | 'loaded' | 'error'

interface UserState {
  token: string | null
  userId: string | null
  profile: Profile
  profileStatus: ProfileStatus
  profileError: string
  setToken: (token: string, userId?: string) => void
  setProfile: (profile: Partial<Profile>) => void
  setProfileStatus: (status: ProfileStatus, error?: string) => void
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
      profileStatus: 'idle',
      profileError: '',

      setToken: (token, userId) => set((s) => {
        s.token = token
        s.userId = userId ?? null
        s.profileStatus = 'idle'
        s.profileError = ''
        localStorage.setItem('edu_token', token)
      }),

      setProfile: (partial) => set((s) => {
        Object.assign(s.profile, partial)
      }),

      setProfileStatus: (status, error = '') => set((s) => {
        s.profileStatus = status
        s.profileError = error
      }),

      logout: () => set((s) => {
        s.token = null
        s.userId = null
        s.profile = { ...defaultProfile }
        s.profileStatus = 'idle'
        s.profileError = ''
        localStorage.removeItem('edu_token')
      }),
    })),
    { name: 'edu_user' },
  ),
)
