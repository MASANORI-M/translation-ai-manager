import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, type ValidationErrors } from '../../api/client'
import { glossaryApi, type Glossary, type GlossaryInput, type GlossaryList } from '../../api/glossary/glossaryApi'
import { projectApi } from '../../api/projects/projectApi'
import type { Project } from '../../types/projects'

const empty: GlossaryInput = { source_term: '', target_term: '', note: null }
const inputClass = 'mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100'

export function GlossaryPage() {
  const { projectId = '' } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [result, setResult] = useState<GlossaryList | null>(null)
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [editing, setEditing] = useState<Glossary | null>(null)
  const [values, setValues] = useState<GlossaryInput>(empty)
  const [deleting, setDeleting] = useState<Glossary | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const sourceInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    Promise.all([projectApi.get(projectId), glossaryApi.list(projectId, page)])
      .then(([project, list]) => { if (active) { setProject(project); setResult(list); setLoading(false) } })
      .catch((error: unknown) => { if (active) { setLoadError(error instanceof Error ? error.message : 'Glossaryを取得できませんでした。'); setLoading(false) } })
    return () => { active = false }
  }, [projectId, page, revision])

  function refresh(nextPage = page) {
    setLoading(true); setLoadError(null); setPage(nextPage); setRevision((value) => value + 1)
  }
  function reset() { setEditing(null); setValues(empty); setError(null); setErrors({}) }
  function edit(glossary: Glossary) {
    setEditing(glossary); setValues({ source_term: glossary.source_term, target_term: glossary.target_term, note: glossary.note })
    setError(null); setErrors({}); sourceInput.current?.focus()
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || loading) return
    setBusy(true); setError(null); setErrors({})
    const input = { source_term: values.source_term.trim(), target_term: values.target_term.trim(), note: values.note?.trim() || null }
    try {
      if (editing) await glossaryApi.update(projectId, editing.id, input)
      else await glossaryApi.create(projectId, input)
      const nextPage = editing ? page : 1
      reset(); refresh(nextPage)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Glossaryを保存できませんでした。')
      if (error instanceof ApiError) setErrors(error.errors)
    } finally { setBusy(false) }
  }
  async function remove() {
    if (!deleting || busy) return
    setBusy(true); setDeleteError(null)
    try {
      await glossaryApi.delete(projectId, deleting.id)
      if (editing?.id === deleting.id) reset()
      dialog.current?.close(); setDeleting(null)
      refresh(result?.data.length === 1 && page > 1 ? page - 1 : page)
    } catch (error) { setDeleteError(error instanceof Error ? error.message : 'Glossaryを削除できませんでした。') }
    finally { setBusy(false) }
  }
  function change(field: keyof GlossaryInput, value: string) { setValues((previous) => ({ ...previous, [field]: value })) }

  return <section className="mx-auto max-w-4xl">
    <Link to={`/projects/${projectId}`} className="text-sm text-sky-700 hover:underline">← 案件詳細</Link>
    <h1 className="mt-4 text-3xl font-semibold">Project Glossary</h1>
    {project && <p className="mt-2 break-words text-sm text-slate-500">{project.name}</p>}
    {loadError ? <div className="mt-6"><p role="alert" className="text-red-700">{loadError}</p><button onClick={() => refresh()} className="mt-3 text-sm text-sky-700">再読み込み</button></div> : <>
      <p className="mt-4 text-sm leading-7 text-slate-600">原文に含まれる用語をAI翻訳へ自動的に渡します。固有名詞を維持する場合はSource TermとTarget Termに同じ表記を登録してください。</p>
      <form onSubmit={(event) => void save(event)} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{editing ? 'Glossaryを編集' : 'Glossaryを追加'}</h2>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <fieldset disabled={busy || loading} className="mt-5 space-y-5">
          {(['source_term', 'target_term', 'note'] as const).map((field) => <div key={field}>
            <label htmlFor={field} className="text-sm font-medium">{{ source_term: 'Source Term（必須）', target_term: 'Target Term（必須）', note: 'Note' }[field]}</label>
            {field === 'note' ? <textarea id={field} value={values[field] ?? ''} onChange={(event) => change(field, event.target.value)} rows={3} maxLength={10000} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined} className={inputClass} /> : <input ref={field === 'source_term' ? sourceInput : undefined} id={field} required maxLength={255} value={values[field]} onChange={(event) => change(field, event.target.value)} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `${field}-error` : undefined} className={inputClass} />}
            {errors[field] && <p id={`${field}-error`} className="mt-2 text-sm text-red-700">{errors[field].join(' ')}</p>}
          </div>)}
          <div className="flex gap-4"><button type="submit" className="rounded-lg bg-sky-700 px-4 py-2 text-sm text-white">{busy ? '保存中…' : '保存する'}</button>{editing && <button type="button" onClick={reset} className="text-sm text-slate-600">編集をキャンセル</button>}</div>
        </fieldset>
      </form>
      <div className="mt-8"><h2 className="mb-4 text-xl font-semibold">Glossary一覧</h2>
        {loading ? <p role="status">読み込み中…</p> : result && <>
          {result.data.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">用語はまだ登録されていません。</p> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['Source Term', 'Target Term', 'Note', '操作'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody>{result.data.map((glossary) => <tr key={glossary.id} className="border-t border-slate-100"><td className="max-w-xs whitespace-pre-wrap break-words px-4 py-4">{glossary.source_term}</td><td className="max-w-xs whitespace-pre-wrap break-words px-4 py-4">{glossary.target_term}</td><td className="max-w-xs whitespace-pre-wrap break-words px-4 py-4">{glossary.note || '—'}</td><td className="whitespace-nowrap px-4 py-4"><div className="flex gap-4"><button disabled={busy} onClick={() => edit(glossary)} aria-label={`${glossary.source_term}を編集`} className="text-sky-700 disabled:opacity-50">編集</button><button disabled={busy} onClick={() => { setDeleting(glossary); setDeleteError(null); dialog.current?.showModal() }} aria-label={`${glossary.source_term}を削除`} className="text-red-700 disabled:opacity-50">削除</button></div></td></tr>)}</tbody></table></div>}
          <div className="mt-4 flex justify-end gap-4 text-sm"><span>{result.meta.total}件 / {result.meta.current_page}ページ</span><button disabled={busy || page <= 1} onClick={() => refresh(page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">前へ</button><button disabled={busy || page >= result.meta.last_page} onClick={() => refresh(page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">次へ</button></div>
        </>}
      </div>
    </>}
    <dialog ref={dialog} aria-labelledby="glossary-delete-title" onCancel={(event) => { if (busy) event.preventDefault() }} className="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl p-6 shadow-xl backdrop:bg-slate-900/40">
      <h2 id="glossary-delete-title" className="text-lg font-semibold">Glossaryを削除しますか？</h2>
      <p className="mt-3 break-words text-sm text-slate-600">「{deleting?.source_term}」を削除します。生成履歴に保存された用語は維持されます。</p>
      {deleteError && <p role="alert" className="mt-4 text-sm text-red-700">{deleteError}</p>}
      <div className="mt-6 flex justify-end gap-3"><button disabled={busy} onClick={() => dialog.current?.close()} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">キャンセル</button><button disabled={busy} onClick={() => void remove()} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? '削除中…' : '削除する'}</button></div>
    </dialog>
  </section>
}
