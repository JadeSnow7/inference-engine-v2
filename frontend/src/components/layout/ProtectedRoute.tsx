import { Navigate } from 'react-router-dom'
import { useUserStore } from '../../store/user'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useUserStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}
