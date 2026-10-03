import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, type ValidationErrors } from '../../lib/api'
import { projectApi } from '../projects/projectApi'
import { scriptApi } from '../scripts/scriptApi'
import { segmentApi, segmentStatuses, type Segment, type SegmentInput } from './segmentApi'

const empty: SegmentInput = { sequence: 1, timecode_start: null, timecode_end: null, emotion: null, source_text: '', final_translation: null, memo: null, status: 'pending' }
const inputClass = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-sky-600'
export function SegmentFormPage({ editing = false }: { editing?: boolean }) {
  const { projectId = '', scriptId = '', segmentId = '' } = useParams()
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  const [values, setValues] = useState<SegmentInput>(empty)
  const [segment, setSegment] = useState<Segment | null>(null)
  const [title, setTitle] = useState('')
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [busy, setBusy] = useState(false)
  const cancelTo = `/projects/${projectId}/scripts/${scriptId}`
  useEffect(() => {
    let active = true
    Promise.all([projectApi.get(projectId), scriptApi.get(projectId, scriptId), editing ? segmentApi.get(projectId, scriptId, segmentId) : Promise.resolve(null)]).then(([, script, current]) => {
      if (!active) return
      setTitle(script.title)
      if (current) { setSegment(current); setValues({ sequence: current.sequence, timecode_start: current.timecode_start, timecode_end: current.timecode_end, emotion: current.emotion, source_text: current.source_text, final_translation: current.final_translation, memo: current.memo, status: current.status }) }
      else setValues({ ...empty, sequence: script.progress.total + 1 })
      setReady(true)
    }).catch((problem: unknown) => { if (active) setLoadError(problem instanceof Error ? problem.message : 'セグメントを取得できませんでした。') })
    return () => { active = false }
  }, [projectId, scriptId, segmentId, editing])
  function change<K extends keyof SegmentInput>(field: K, value: SegmentInput[K]) { setValues((before) => ({ ...before, [field]: value })) }
  function feedback(field: keyof SegmentInput) { return errors[field] && <p className="mt-1 text-sm text-red-700">{errors[field].join(' ')}</p> }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(null); setErrors({})
    try {
      const input = { ...values, source_text: values.source_text.trim(), emotion: values.emotion?.trim() || null, final_translation: values.final_translation?.trim() || null, memo: values.memo?.trim() || null, timecode_start: values.timecode_start?.trim() || null, timecode_end: values.timecode_end?.trim() || null }
      await (editing && segment ? segmentApi.update(projectId, scriptId, segmentId, { ...input, version: segment.version }) : segmentApi.create(projectId, scriptId, input))
      navigate(cancelTo, { replace: true })
    } catch (problem) { setError(problem instanceof Error ? problem.message : '保存できませんでした。'); if (problem instanceof ApiError) setErrors(problem.errors) }
    finally { setBusy(false) }
  }
  async function remove() {
    if (busy) return
    setBusy(true); setError(null)
    try { await segmentApi.delete(projectId, scriptId, segmentId); navigate(cancelTo, { replace: true }) }
    catch (problem) { setError(problem instanceof Error ? problem.message : '削除できませんでした。') }
    finally { setBusy(false) }
  }
  return <section className="mx-auto max-w-4xl"><Link to={cancelTo} className="text-sm text-sky-700">← スクリプト詳細</Link><h1 className="mt-4 text-3xl font-semibold">{editing ? 'セグメントを編集' : 'セグメントを追加'}</h1><p className="mt-2 text-slate-500">{title}</p>
    {loadError ? <p role="alert" className="mt-6 text-red-700">{loadError}</p> : !ready ? <p role="status">読み込み中…</p> : <form onSubmit={save} className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <fieldset disabled={busy} className="space-y-6"><div className="grid gap-6 sm:grid-cols-3">
        <div><label htmlFor="sequence" className="text-sm font-medium">表示順（必須）</label><input id="sequence" type="number" min="1" required value={Number.isNaN(values.sequence) ? '' : values.sequence} onChange={(e) => change('sequence', e.target.valueAsNumber)} className={inputClass} />{feedback('sequence')}</div>
        {(['timecode_start', 'timecode_end'] as const).map((field) => <div key={field}><label htmlFor={field} className="text-sm font-medium">{field === 'timecode_start' ? '開始タイムコード' : '終了タイムコード'}</label><input id={field} value={values[field] ?? ''} onChange={(e) => change(field, e.target.value || null)} placeholder="00:26:58" className={inputClass} />{feedback(field)}</div>)}
      </div>
      <div><label htmlFor="emotion" className="text-sm font-medium">感情・演出指示</label><textarea id="emotion" value={values.emotion ?? ''} onChange={(e) => change('emotion', e.target.value || null)} rows={2} className={inputClass} />{feedback('emotion')}</div>
      <div><label htmlFor="source_text" className="text-sm font-medium">英語原文（必須）</label><textarea id="source_text" required value={values.source_text} onChange={(e) => change('source_text', e.target.value)} rows={9} className={`${inputClass} leading-7`} />{feedback('source_text')}</div>
      {editing && <><div><label htmlFor="final_translation" className="text-sm font-medium">日本語訳</label><textarea id="final_translation" value={values.final_translation ?? ''} onChange={(e) => change('final_translation', e.target.value || null)} rows={7} className={`${inputClass} leading-7`} />{feedback('final_translation')}</div><div><label htmlFor="memo" className="text-sm font-medium">メモ</label><textarea id="memo" value={values.memo ?? ''} onChange={(e) => change('memo', e.target.value || null)} rows={3} className={inputClass} />{feedback('memo')}</div><div><label htmlFor="segment_status" className="text-sm font-medium">ステータス</label><select id="segment_status" value={values.status} onChange={(e) => change('status', e.target.value as SegmentInput['status'])} className={inputClass}>{Object.entries(segmentStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{feedback('status')}</div></>}
      </fieldset>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-6"><button disabled={busy} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm text-white disabled:opacity-50">{busy ? '保存中…' : '保存する'}</button><Link to={cancelTo} className="self-center text-sm text-slate-600">キャンセル</Link>{editing && <button type="button" onClick={() => dialog.current?.showModal()} className="ml-auto rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700">削除</button>}</div>
    </form>}
    <dialog ref={dialog} aria-labelledby="delete-segment-title" className="m-auto w-[calc(100%-3rem)] max-w-md rounded-2xl p-6 shadow-xl backdrop:bg-slate-900/40"><h2 id="delete-segment-title" className="text-lg font-semibold">セグメントを削除しますか？</h2><p className="mt-3 text-sm text-slate-600">削除後、画面から元に戻すことはできません。</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => dialog.current?.close()} disabled={busy} className="rounded-lg border px-4 py-2 text-sm">キャンセル</button><button onClick={() => void remove()} disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm text-white">削除する</button></div></dialog>
  </section>
}
