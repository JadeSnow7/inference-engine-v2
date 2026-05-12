import { useEffect } from 'react'
import { fetchProfile, type UserProfile } from '../api/sessions'
import { useUserStore } from '../store/user'

type TeachingStyle = 'step_by_step' | 'directional' | 'rewrite_first'
type FeedbackVerbosity = 'concise' | 'balanced' | 'detailed'

export function useProfile() {
  const token = useUserStore((s) => s.token)
  const profile = useUserStore((s) => s.profile)
  const setProfile = useUserStore((s) => s.setProfile)
  const setProfileStatus = useUserStore((s) => s.setProfileStatus)

  useEffect(() => {
    const currentStatus = useUserStore.getState().profileStatus
    if (!token || currentStatus === 'loading' || currentStatus === 'loaded') return

    let active = true
    setProfileStatus('loading')
    fetchProfile()
      .then((backendProfile) => {
        if (!active) return
        setProfile(mapBackendProfile(backendProfile))
        setProfileStatus('loaded')
      })
      .catch((error: unknown) => {
        if (!active) return
        setProfileStatus('error', error instanceof Error ? error.message : '资料加载失败')
      })

    return () => {
      active = false
    }
  }, [setProfile, setProfileStatus, token])

  return profile
}

function mapBackendProfile(profile: UserProfile) {
  return {
    teachingStyle: normalizeTeachingStyle(profile.teaching_style),
    feedbackVerbosity: normalizeVerbosity(profile.feedback_verbosity),
    writingStage: profile.writing_stage || null,
    hasCompletedOnboarding: true,
  }
}

function normalizeTeachingStyle(value: string): TeachingStyle | null {
  if (value === 'step_by_step' || value.includes('严格')) return 'step_by_step'
  if (value === 'directional' || value.includes('方向')) return 'directional'
  if (value === 'rewrite_first' || value.includes('改写')) return 'rewrite_first'
  return null
}

function normalizeVerbosity(value: string): FeedbackVerbosity | null {
  if (value === 'concise' || value.includes('简洁')) return 'concise'
  if (value === 'balanced' || value.includes('平衡')) return 'balanced'
  if (value === 'detailed' || value.includes('详细')) return 'detailed'
  return null
}
