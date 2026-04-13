import { useUserStore } from '../store/user'

export function useProfile() {
  return useUserStore((s) => s.profile)
}
