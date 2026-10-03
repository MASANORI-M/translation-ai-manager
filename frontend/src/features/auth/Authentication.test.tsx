import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../lib/api'
import { AuthProvider } from './AuthProvider'
import { authApi } from './authApi'
import type { User } from './types'

vi.mock('./authApi', () => ({ authApi: { currentUser: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() } }))

const user: User = { id: 1, email: 'translator@example.com', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

function open(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /><Location /></AuthProvider></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authApi.currentUser).mockResolvedValue(null)
})

describe('Authentication routing and forms', () => {
  it('redirects an unauthenticated dashboard visitor to login', async () => {
    open('/dashboard')
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it.each(['/login', '/register'])('redirects an authenticated visitor from %s to dashboard', async (path) => {
    vi.mocked(authApi.currentUser).mockResolvedValue(user)
    open(path)
    expect(await screen.findByRole('heading', { name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard')
  })

  it('restores the user when the app is mounted again after reload', async () => {
    vi.mocked(authApi.currentUser).mockResolvedValue(user)
    const first = open('/dashboard')
    expect(await screen.findByText(user.email)).toBeInTheDocument()
    first.unmount()
    open('/dashboard')
    expect(await screen.findByText(user.email)).toBeInTheDocument()
    expect(authApi.currentUser).toHaveBeenCalledTimes(2)
  })

  it('logs in and then blocks dashboard access after logout', async () => {
    const browser = userEvent.setup()
    vi.mocked(authApi.login).mockResolvedValue(user)
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
    open('/login')
    await screen.findByRole('heading', { name: 'ログイン' })
    await browser.type(screen.getByLabelText('メールアドレス'), user.email)
    await browser.type(screen.getByLabelText('パスワード'), 'test-password')
    await browser.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByText(user.email)).toBeInTheDocument()
    expect(authApi.login).toHaveBeenCalledWith({ email: user.email, password: 'test-password' })
    await browser.click(screen.getByRole('button', { name: 'ログアウト' }))
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('registers with password confirmation and opens dashboard', async () => {
    const browser = userEvent.setup()
    vi.mocked(authApi.register).mockResolvedValue(user)
    open('/register')
    await screen.findByRole('heading', { name: 'アカウント登録' })
    await browser.type(screen.getByLabelText('メールアドレス'), user.email)
    await browser.type(screen.getByLabelText('パスワード', { exact: true }), 'test-password')
    await browser.type(screen.getByLabelText('パスワード（確認）'), 'test-password')
    await browser.click(screen.getByRole('button', { name: '登録する' }))
    expect(await screen.findByText(user.email)).toBeInTheDocument()
    expect(authApi.register).toHaveBeenCalledWith({ email: user.email, password: 'test-password', password_confirmation: 'test-password' })
  })

  it('shows validation errors without leaving the form', async () => {
    const browser = userEvent.setup()
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(422, '入力内容を確認してください。', { email: ['メールアドレスまたはパスワードが正しくありません。'] }))
    open('/login')
    await screen.findByRole('heading', { name: 'ログイン' })
    await browser.type(screen.getByLabelText('メールアドレス'), user.email)
    await browser.type(screen.getByLabelText('パスワード'), 'wrong-password')
    await browser.click(screen.getByRole('button', { name: 'ログイン' }))
    expect(await screen.findByText('メールアドレスまたはパスワードが正しくありません。')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login')
  })

  it('keeps a session-check failure visible and permits retry', async () => {
    const browser = userEvent.setup()
    vi.mocked(authApi.currentUser).mockRejectedValueOnce(new ApiError(0, 'サーバーに接続できません。')).mockResolvedValueOnce(user)
    open('/dashboard')
    expect(await screen.findByRole('alert')).toHaveTextContent('サーバーに接続できません。')
    await browser.click(screen.getByRole('button', { name: '再試行' }))
    await waitFor(() => expect(screen.getByText(user.email)).toBeInTheDocument())
  })
})
