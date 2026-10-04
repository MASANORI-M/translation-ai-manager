import { createContext } from 'react'
import type { Credentials, Registration, User } from '../../types/auth'

export interface AuthState {
  user: User | null
  status: 'loading' | 'ready' | 'error'
  error: string | null
}

export interface AuthContextValue extends AuthState {
  login: (credentials: Credentials) => Promise<void>
  register: (registration: Registration) => Promise<void>
  logout: () => Promise<void>
  retry: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
