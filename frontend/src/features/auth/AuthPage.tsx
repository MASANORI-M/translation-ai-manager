import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { ValidationErrors } from '../../lib/api'
import { useAuth } from './useAuth'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const registering = mode === 'register'
  const { login, register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setMessage(null)
    setErrors({})
    try {
      if (registering) {
        await register({ email: email.trim(), password, password_confirmation: confirmation })
      } else {
        await login({ email: email.trim(), password })
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作に失敗しました。')
      if (error instanceof ApiError) setErrors(error.errors)
    } finally {
      setBusy(false)
    }
  }

  const fieldClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50'

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-lg font-semibold tracking-tight text-slate-900">Translation AI Manager</Link>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{registering ? 'アカウント登録' : 'ログイン'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{registering ? '翻訳作業を始めるためのアカウントを作成します。' : 'アカウントにログインして作業を再開しましょう。'}</p>
          {message && <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-slate-700">メールアドレス</label>
              <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} className={fieldClass} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
              {errors.email && <p id="email-error" className="mt-2 text-xs text-red-700">{errors.email[0]}</p>}
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium text-slate-700">パスワード</label>
              <input id="password" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : undefined} maxLength={72} value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} className={fieldClass} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} />
              {registering && <p className="mt-2 text-xs text-slate-500">8文字以上、UTF-8で72バイト以内で入力してください。</p>}
              {errors.password && <p id="password-error" className="mt-2 text-xs text-red-700">{errors.password[0]}</p>}
            </div>
            {registering && <div>
              <label htmlFor="password-confirmation" className="text-sm font-medium text-slate-700">パスワード（確認）</label>
              <input id="password-confirmation" name="password_confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} className={fieldClass} />
            </div>}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-wait disabled:opacity-60">{busy ? '処理中…' : registering ? '登録する' : 'ログイン'}</button>
          </form>
        </section>
        <p className="mt-6 text-center text-sm text-slate-500">{registering ? 'アカウントをお持ちですか？' : 'アカウントをお持ちでない方は'}{' '}<Link to={registering ? '/login' : '/register'} className="font-medium text-sky-700 hover:underline">{registering ? 'ログイン' : 'アカウント登録'}</Link></p>
      </div>
    </main>
  )
}
