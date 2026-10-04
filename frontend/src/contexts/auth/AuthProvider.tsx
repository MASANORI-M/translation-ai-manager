import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import type { AuthState } from './AuthContext'
import { authApi } from '../../api/auth/authApi'
import type { Credentials, Registration } from '../../types/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, status: 'loading', error: null })

  useEffect(() => {
    let active = true
    authApi.currentUser().then((user) => {
      if (active) setState({ user, status: 'ready', error: null })
    }).catch((error: unknown) => {
      if (active) setState({ user: null, status: 'error', error: error instanceof Error ? error.message : 'ログイン状態を確認できません。' })
    })
    return () => { active = false }
  }, [])

  async function retry() {
    setState({ user: null, status: 'loading', error: null })
    try {
      const user = await authApi.currentUser()
      setState({ user, status: 'ready', error: null })
    } catch (error) {
      setState({ user: null, status: 'error', error: error instanceof Error ? error.message : 'ログイン状態を確認できません。' })
    }
  }

  async function login(credentials: Credentials) {
    const user = await authApi.login(credentials)
    setState({ user, status: 'ready', error: null })
  }

  async function register(registration: Registration) {
    const user = await authApi.register(registration)
    setState({ user, status: 'ready', error: null })
  }

  async function logout() {
    await authApi.logout()
    setState({ user: null, status: 'ready', error: null })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, retry }}>
      {children}
    </AuthContext.Provider>
  )
}
