import { SegmentFormPage } from './pages/segments/SegmentFormPage'
import { TranslationEditorPage } from './pages/translation/TranslationEditorPage'
import { ScriptFormPage } from './pages/scripts/ScriptFormPage'
import { ScriptDetailPage } from './pages/scripts/ScriptDetailPage'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProjectListPage } from './pages/projects/ProjectListPage'
import { ProjectFormPage } from './pages/projects/ProjectFormPage'
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage'
import { GlossaryPage } from './pages/glossary/GlossaryPage'
import { AuthGate } from './components/auth/AuthGate'
import { AuthPage } from './pages/auth/AuthPage'
import { DashboardPage } from './pages/auth/DashboardPage'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { status, error, retry, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500" role="status">ログイン状態を確認しています…</main>
  if (status === 'error') return <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-6"><p role="alert" className="text-sm text-red-700">{error}</p><button onClick={() => void retry()} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white">再試行</button></main>

  return (
    <Routes>
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route element={<AuthGate guest />}>
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      </Route>
      <Route element={<AuthGate />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/new" element={<ProjectFormPage key="new" />} />
          <Route path="/projects/:id" element={<ProjectDetailPage key={location.pathname} />} />
          <Route path="/projects/:projectId/glossary" element={<GlossaryPage key={location.pathname} />} />
          <Route path="/projects/:projectId/scripts/new" element={<ScriptFormPage key={location.pathname} />} />
          <Route path="/projects/:projectId/scripts/:scriptId" element={<ScriptDetailPage key={location.pathname} />} />
          <Route path="/projects/:projectId/scripts/:scriptId/editor" element={<TranslationEditorPage key={location.pathname} />} />
          <Route path="/projects/:projectId/scripts/:scriptId/segments/new" element={<SegmentFormPage key={location.pathname} />} />
          <Route path="/projects/:projectId/scripts/:scriptId/segments/:segmentId/edit" element={<SegmentFormPage key={location.pathname} editing />} />
          <Route path="/projects/:projectId/scripts/:scriptId/edit" element={<ScriptFormPage key={location.pathname} editing />} />
          <Route path="/projects/:id/edit" element={<ProjectFormPage key={location.pathname} editing />} />
          <Route path="/projects/edit/:id" element={<ProjectFormPage key={location.pathname} editing />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
