import { ApiError, apiRequest, initializeCsrf } from '../../lib/api'
import type { Credentials, Registration, User } from './types'

interface UserResponse {
  data: User
}

export const authApi = {
  async currentUser(): Promise<User | null> {
    try {
      return (await apiRequest<UserResponse>('/user')).data
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  async login(credentials: Credentials): Promise<User> {
    await initializeCsrf()
    return (await apiRequest<UserResponse>('/login', { method: 'POST', body: credentials })).data
  },
  async register(registration: Registration): Promise<User> {
    await initializeCsrf()
    return (await apiRequest<UserResponse>('/register', { method: 'POST', body: registration })).data
  },
  async logout(): Promise<void> {
    await initializeCsrf()
    try {
      await apiRequest<void>('/logout', { method: 'POST' })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return
      throw error
    }
  },
}
