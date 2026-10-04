import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AppLayout() {
  const { user, logout } = useAuth()
  const isEditor = useLocation().pathname.endsWith('/editor')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogout() {
    setBusy(true)
    setError(null)
    try { await logout() }
    catch (error) { setError(error instanceof Error ? error.message : 'ログアウトできませんでした。') }
    finally { setBusy(false) }
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-5 px-6 py-5">
        <NavLink to="/dashboard" className="text-lg font-semibold tracking-tight">Translation AI Manager</NavLink>
        <nav aria-label="メインナビゲーション" className="flex gap-4 text-sm">
          {[['/dashboard', 'ダッシュボード'], ['/projects', 'PROJECTS']].map(([to, title]) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'font-semibold text-sky-700' : 'text-slate-600 hover:text-sky-700'}>{title}</NavLink>)}
        </nav>
        <div className="flex flex-wrap items-center gap-4 sm:ml-auto">
          <span className="break-all text-sm text-slate-500">{user?.email}</span>
          <button onClick={handleLogout} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">{busy ? '処理中…' : 'ログアウト'}</button>
        </div>
      </div>
      {error && <p role="alert" className="mx-auto max-w-6xl px-6 pb-4 text-sm text-red-700">{error}</p>}
    </header>
    <main className={`mx-auto px-6 py-10 ${isEditor ? 'max-w-7xl' : 'max-w-6xl'}`}><Outlet /></main>
  </div>
}
