import { Navigate } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'
import { useUserStore } from '../../store/user'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useUserStore((s) => s.token)
  useProfile()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}
