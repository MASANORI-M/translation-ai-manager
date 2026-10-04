import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, type ValidationErrors } from '../../api/client'
import { projectApi } from '../../api/projects/projectApi'
import { scriptApi, scriptStatuses, type ScriptInput } from '../../api/scripts/scriptApi'
export function ScriptFormPage({ editing = false }: { editing?: boolean }) {
  const { projectId = '', scriptId = '' } = useParams()
  const navigate = useNavigate()
  const [values, setValues] = useState<ScriptInput>({ title: '', word_count: 0, deadline: null, status: 'pending' })
  const [projectName, setProjectName] = useState<string | null>(null)
  const [wordCountLocked, setWordCountLocked] = useState(false)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [busy, setBusy] = useState(false)
  const cancelTo = editing ? `/projects/${projectId}/scripts/${scriptId}` : `/projects/${projectId}`
  useEffect(() => {
    let active = true
    Promise.all([projectApi.get(projectId), editing ? scriptApi.get(projectId, scriptId) : Promise.resolve(null)]).then(([project, script]) => {
      if (active) { setProjectName(project.name); if (script) { setValues({ title: script.title, word_count: script.word_count, deadline: script.deadline, status: script.status }); setWordCountLocked(script.progress?.total > 0) } setReady(true) }
    }).catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : '取得できませんでした。') })
    return () => { active = false }
  }, [projectId, scriptId, editing])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(null); setErrors({})
    try { const input = { ...values, title: values.title.trim() }; const script = editing ? await scriptApi.update(projectId, scriptId, input) : await scriptApi.create(projectId, input); navigate(`/projects/${projectId}/scripts/${script.id}`, { replace: true }) }
    catch (error) { setError(error instanceof Error ? error.message : '保存できませんでした。'); if (error instanceof ApiError) setErrors(error.errors) }
    finally { setBusy(false) }
  }
  const inputClass = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-sky-600'
  function fieldError(field: string) { return errors[field] && <p id={`${field}-error`} className="mt-2 text-sm text-red-700">{errors[field].join(' ')}</p> }
  function attributes(field: string) { return { id: field, 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `${field}-error` : undefined } }
  return <section className="mx-auto max-w-3xl"><Link to={cancelTo} className="text-sm text-sky-700">← 戻る</Link><h1 className="mt-4 text-3xl font-semibold">{editing ? 'Scriptを編集' : '新規Script'}</h1><p className="mt-2 text-slate-500">{projectName}</p>
    {loadError ? <p role="alert" className="mt-6 text-red-700">{loadError}</p> : !ready ? <p role="status">読み込み中…</p> : <form onSubmit={save} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {error && <p role="alert" className="mb-6 text-red-700">{error}</p>}
      <fieldset disabled={busy} className="grid gap-6 sm:grid-cols-2">
        <div className="sm:col-span-2"><label htmlFor="title">タイトル（必須）</label><input {...attributes('title')} required maxLength={255} value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} className={inputClass} />{fieldError('title')}</div>
        <div><label htmlFor="word_count">原文語数（必須）</label><input {...attributes('word_count')} type="number" required disabled={wordCountLocked} min={0} max={4294967295} step={1} value={Number.isNaN(values.word_count) ? '' : values.word_count} onChange={(e) => setValues({ ...values, word_count: e.target.valueAsNumber })} className={inputClass} />{wordCountLocked && <p className="mt-2 text-xs text-slate-500">セグメントの原文から自動計算します。</p>}{fieldError('word_count')}</div>
        <div><label htmlFor="deadline">納期</label><input {...attributes('deadline')} type="date" value={values.deadline ?? ''} onChange={(e) => setValues({ ...values, deadline: e.target.value || null })} className={inputClass} />{fieldError('deadline')}</div>
        <div><label htmlFor="status">ステータス（必須）</label><select {...attributes('status')} value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value as ScriptInput['status'] })} className={inputClass}>{Object.entries(scriptStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{fieldError('status')}</div>
      </fieldset>
      {!editing && <p className="mt-6 text-sm text-slate-500">現在の案件の単価・通貨を引き継ぎます。作成後の案件単価変更はこのスクリプトには反映されません。</p>}
      <div className="mt-8 flex gap-4"><button disabled={busy} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm text-white disabled:opacity-50">{busy ? '保存中…' : '保存する'}</button>{!busy && <Link to={cancelTo} className="self-center text-sm text-slate-600">キャンセル</Link>}</div>
    </form>}
  </section>
}
