import { ScriptListSection } from '../scripts/ScriptListSection'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from './projectApi'
import { ProjectStatusBadge } from './ProjectStatusBadge'
import { displayRate, rateTypes, type Project } from './types'

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    projectApi.get(id).then((data) => { if (active) setProject(data) }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : '案件を取得できませんでした。') })
    return () => { active = false }
  }, [id])
  async function remove() {
    if (busy) return
    setBusy(true); setDeleteError(null)
    try { await projectApi.delete(id); navigate('/projects', { replace: true }) }
    catch (error) { setDeleteError(error instanceof Error ? error.message : '削除できませんでした。') }
    finally { setBusy(false) }
  }
  if (error) return <section><Link to="/projects" className="text-sky-700">← 案件一覧</Link><p role="alert" className="mt-6 text-red-700">{error}</p></section>
  if (!project) return <p role="status" className="text-slate-500">読み込み中…</p>
  return <section className="mx-auto max-w-4xl">
    <Link to="/projects" className="text-sm text-sky-700 hover:underline">← 案件一覧</Link>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div><h1 className="break-words text-3xl font-semibold">{project.name}</h1><div className="mt-3"><ProjectStatusBadge status={project.status} /></div></div><div className="flex gap-3"><Link to={`/projects/${id}/edit`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">編集</Link><button onClick={() => { setDeleteError(null); dialog.current?.showModal() }} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-700">削除</button></div></div>
    <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{[
      ['顧客名', project.client_name], ['説明', project.description], ['翻訳スタイル', project.translation_style], ['翻訳ルール', project.translation_rules], ['単価', displayRate(project)], ['通貨', project.currency], ['単価方式', rateTypes[project.rate_type]],
    ].map(([label, value]) => <div key={label} className="grid gap-2 py-5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr]"><dt className="text-sm font-medium text-slate-500">{label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words text-sm leading-7">{value || '—'}</dd></div>)}</dl>
    <ScriptListSection projectId={id} />
    <dialog ref={dialog} aria-labelledby="delete-title" onCancel={(event) => { if (busy) event.preventDefault() }} className="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl p-6 shadow-xl backdrop:bg-slate-900/40">
      <h2 id="delete-title" className="text-lg font-semibold">案件を削除しますか？</h2><p className="mt-3 break-words text-sm text-slate-600">「{project.name}」と配下のスクリプトは一覧から削除されます。画面から元に戻すことはできません。</p>
      {deleteError && <p role="alert" className="mt-4 text-sm text-red-700">{deleteError}</p>}
      <div className="mt-6 flex justify-end gap-3"><button onClick={() => dialog.current?.close()} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">キャンセル</button><button onClick={() => void remove()} disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? '削除中…' : '削除する'}</button></div>
    </dialog>
  </section>
}
