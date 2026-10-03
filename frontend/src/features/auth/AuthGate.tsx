import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

export function AuthGate({ guest = false }: { guest?: boolean }) {
  const { user } = useAuth()
  if (guest && user) return <Navigate to="/dashboard" replace />
  if (!guest && !user) return <Navigate to="/login" replace />
  return <Outlet />
}
