import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { projectApi } from '../projects/projectApi'
import { displayRate, type Project } from '../projects/types'
import { payment, scriptApi, type Script } from './scriptApi'
import { ScriptStatusBadge } from './ScriptStatusBadge'
export function ScriptDetailPage() {
  const { projectId = '', scriptId = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const [data, setData] = useState<{ project: Project; script: Script } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    Promise.all([projectApi.get(projectId), scriptApi.get(projectId, scriptId)]).then(([project, script]) => { if (active) setData({ project, script }) }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : '取得できませんでした。') })
    return () => { active = false }
  }, [projectId, scriptId])
  async function remove() {
    if (busy) return
    setBusy(true); setDeleteError(null)
    try { await scriptApi.delete(projectId, scriptId); navigate(`/projects/${projectId}`, { replace: true }) }
    catch (error) { setDeleteError(error instanceof Error ? error.message : '削除できませんでした。') }
    finally { setBusy(false) }
  }
  const back = <Link to={`/projects/${projectId}`} className="text-sm text-sky-700">← 案件詳細</Link>
  if (error) return <section>{back}<p role="alert" className="mt-6 text-red-700">{error}</p></section>
  if (!data) return <p role="status">読み込み中…</p>
  const { script, project } = data
  const dateTime = (value: string | null) => value ? new Date(value).toLocaleString() : '—'
  return <section className="mx-auto max-w-4xl">{back}<div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-slate-500">Script</p><h1 className="mt-1 break-words text-3xl font-semibold">{script.title}</h1><div className="mt-3"><ScriptStatusBadge status={script.status} /></div></div><div className="flex gap-3"><Link to={`/projects/${projectId}/scripts/${scriptId}/edit`} className="rounded-lg border bg-white px-4 py-2 text-sm">編集</Link><button onClick={() => { setDeleteError(null); dialog.current?.showModal() }} className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-700">削除</button></div></div>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"><div><h2 className="font-semibold">翻訳進捗</h2><p className="mt-1 text-sm text-slate-600">{script.progress?.completed ?? 0} / {script.progress?.total ?? 0}件 · {script.progress?.total ? Math.round(script.progress.completed / script.progress.total * 100) : 0}%</p></div><div className="flex flex-wrap gap-3"><Link to={`/projects/${projectId}/scripts/${scriptId}/editor`} className="rounded-lg border border-sky-700 px-4 py-2 text-sm font-medium text-sky-700">翻訳エディターを開く</Link><Link to={`/projects/${projectId}/scripts/${scriptId}/segments/new`} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white">セグメントを追加</Link></div></div>
    <dl className="mt-6 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-slate-500">案件</dt><dd><Link to={`/projects/${projectId}`} className="break-words text-sky-700">{project.name}</Link></dd></div>{[
      ['原文語数', script.word_count.toLocaleString()], ['納期', script.deadline ?? '—'], ['見込額', payment(script)], ['単価', displayRate(script)], ['開始日時', dateTime(script.started_at)], ['完了日時', dateTime(script.completed_at)],
    ].map(([label, value]) => <div key={label} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr]"><dt className="text-sm text-slate-500">{label}</dt><dd className="break-words text-sm tabular-nums">{value}</dd></div>)}</dl>
    <dialog ref={dialog} aria-labelledby="delete-script-title" onCancel={(e) => { if (busy) e.preventDefault() }} className="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl p-6 shadow-xl backdrop:bg-slate-900/40"><h2 id="delete-script-title" className="text-lg font-semibold">スクリプトを削除しますか？</h2><p className="mt-3 break-words text-sm text-slate-600">「{script.title}」は一覧から削除されます。画面から元に戻すことはできません。</p>{deleteError && <p role="alert" className="mt-4 text-red-700">{deleteError}</p>}<div className="mt-6 flex justify-end gap-3"><button disabled={busy} onClick={() => dialog.current?.close()} className="rounded-lg border px-4 py-2 text-sm">キャンセル</button><button disabled={busy} onClick={() => void remove()} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? '削除中…' : '削除する'}</button></div></dialog>
  </section>
}
