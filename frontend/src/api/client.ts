export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export type ValidationErrors = Record<string, string[]>

export class ApiError extends Error {
  status: number
  errors: ValidationErrors

  constructor(status: number, message: string, errors: ValidationErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

function xsrfToken(): string | undefined {
  const cookie = document.cookie.split('; ').find((value) => value.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined
}

function errorMessage(status: number): string {
  if (status === 401) return 'ログインが必要です。'
  if (status === 404) return '指定されたデータが見つかりません。削除済みの可能性があります。'
  if (status === 403) return 'この操作は現在許可されていません。'
  if (status === 419) return 'セッションの有効期限が切れました。もう一度お試しください。'
  if (status === 422) return '入力内容を確認してください。'
  if (status === 429) return '操作回数が多すぎます。少し待ってからお試しください。'
  return '通信に失敗しました。時間をおいてお試しください。'
}

async function request<T>(url: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers({ Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' })

  if (options.body !== undefined) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = xsrfToken()
    if (token) headers.set('X-XSRF-TOKEN', token)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'サーバーに接続できません。接続状況を確認してお試しください。')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { errors?: ValidationErrors }
    throw new ApiError(response.status, errorMessage(response.status), payload.errors)
  }

  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export function apiRequest<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  return request<T>(`${API_BASE_URL}${path}`, options)
}

export function initializeCsrf(): Promise<void> {
  const apiUrl = new URL(API_BASE_URL, window.location.origin)
  return request<void>(new URL('/sanctum/csrf-cookie', apiUrl).toString())
}
