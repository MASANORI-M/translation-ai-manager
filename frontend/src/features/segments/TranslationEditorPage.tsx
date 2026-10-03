import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { projectApi } from '../projects/projectApi'
import type { Project } from '../projects/types'
import { scriptApi, type Script } from '../scripts/scriptApi'
import { segmentApi, type Segment, type SegmentList, type SegmentStatus } from './segmentApi'

function SegmentCard({ initial, projectId, scriptId, onSaved, onDirtyChange }: { initial: Segment; projectId: string; scriptId: string; onSaved: () => void; onDirtyChange: (id: number, dirty: boolean) => void }) {
  const [segment, setSegment] = useState(initial)
  const [translation, setTranslation] = useState(initial.final_translation ?? '')
  const [memo, setMemo] = useState(initial.memo ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dirty = translation !== (segment.final_translation ?? '') || memo !== (segment.memo ?? '')
  useEffect(() => { onDirtyChange(segment.id, dirty) }, [segment.id, dirty, onDirtyChange])
  async function save(status: SegmentStatus) {
    if (busy) return
    if (status === 'completed' && !translation.trim()) { setError('完了には最終訳が必要です。'); return }
    setBusy(true); setError(null); setMessage(null)
    try {
      const updated = await segmentApi.update(projectId, scriptId, String(segment.id), {
        sequence: segment.sequence, timecode_start: segment.timecode_start, timecode_end: segment.timecode_end,
        emotion: segment.emotion, source_text: segment.source_text,
        final_translation: translation.trim() || null, memo: memo.trim() || null, status, version: segment.version,
      })
      setSegment(updated); setTranslation(updated.final_translation ?? ''); setMemo(updated.memo ?? '')
      setMessage(status === 'completed' ? '完了しました。' : '保存しました。')
      onSaved()
    } catch (problem) {
      if (problem instanceof ApiError && problem.errors.version) setError(problem.errors.version.join(' '))
      else setError(problem instanceof Error ? problem.message : '保存できませんでした。')
    } finally { setBusy(false) }
  }
  const outdated = segment.final_translation && segment.final_source_version !== segment.source_version
  return <article className={`rounded-xl border bg-white p-5 shadow-sm sm:p-7 ${segment.status === 'completed' ? 'border-emerald-300' : 'border-slate-200'}`} aria-label={`セグメント ${segment.sequence}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><div className="flex items-center gap-3"><h2 className="text-xl font-semibold tabular-nums">#{segment.sequence}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${segment.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : segment.status === 'editing' ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>{segment.status === 'completed' ? '完了' : segment.status === 'editing' ? '編集中' : '未着手'}</span></div><p className="mt-2 text-sm tabular-nums text-slate-500">{segment.timecode_start && segment.timecode_end ? `${segment.timecode_start} → ${segment.timecode_end}` : 'タイムコードなし'}</p>{segment.emotion && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{segment.emotion}</p>}</div><Link to={`/projects/${projectId}/scripts/${scriptId}/segments/${segment.id}/edit`} className="text-sm text-sky-700 hover:underline">原文・設定を編集</Link></div>
    {outdated && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">原文が変更されました。訳文を確認して保存してください。</p>}
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-lg border border-slate-200 bg-slate-50 p-5"><h3 className="text-xs font-semibold tracking-wider text-slate-500">英語原文</h3><p className="mt-4 whitespace-pre-wrap break-words text-base leading-8 text-slate-900">{segment.source_text}</p></div><div className="rounded-lg border border-slate-200 p-5"><label htmlFor={`translation-${segment.id}`} className="text-xs font-semibold tracking-wider text-slate-500">日本語訳</label><textarea id={`translation-${segment.id}`} value={translation} onChange={(event) => { setTranslation(event.target.value); setMessage(null) }} rows={10} className="mt-4 min-h-56 w-full resize-y rounded-lg border border-slate-300 p-3 text-base leading-8 focus:outline-sky-600" placeholder="日本語訳を入力" /></div></div>
    <div className="mt-5"><label htmlFor={`memo-${segment.id}`} className="text-sm font-medium text-slate-600">メモ</label><textarea id={`memo-${segment.id}`} value={memo} onChange={(event) => { setMemo(event.target.value); setMessage(null) }} rows={2} className="mt-2 w-full resize-y rounded-lg border border-slate-300 p-3 text-sm focus:outline-sky-600" /></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><button disabled={busy} onClick={() => void save(segment.status === 'completed' && !dirty ? 'completed' : translation.trim() ? 'editing' : 'pending')} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? '保存中…' : '保存'}</button>{segment.status === 'completed' ? <button disabled={busy} onClick={() => void save('editing')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">再開</button> : <button disabled={busy} onClick={() => void save('completed')} className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-800 disabled:opacity-50">完了にする</button>}{dirty && <span className="text-xs text-amber-700">未保存の変更</span>}{message && <span role="status" className="text-sm text-emerald-700">{message}</span>}{error && <span role="alert" className="text-sm text-red-700">{error}</span>}</div>
  </article>
}

export function TranslationEditorPage() {
  const { projectId = '', scriptId = '' } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [script, setScript] = useState<Script | null>(null)
  const [result, setResult] = useState<SegmentList | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  const onDirtyChange = useCallback((id: number, dirty: boolean) => {
    setDirtyIds((before) => { if (before.has(id) === dirty) return before; const next = new Set(before); if (dirty) next.add(id); else next.delete(id); return next })
  }, [])
  useEffect(() => {
    let active = true
    Promise.all([projectApi.get(projectId), scriptApi.get(projectId, scriptId), segmentApi.list(projectId, scriptId, page)]).then(([project, script, result]) => {
      if (active) { setProject(project); setScript(script); setResult(result); setLoading(false) }
    }).catch((problem: unknown) => { if (active) { setError(problem instanceof Error ? problem.message : '翻訳画面を読み込めませんでした。'); setLoading(false) } })
    return () => { active = false }
  }, [projectId, scriptId, page])
  useEffect(() => {
    if (dirtyIds.size === 0) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirtyIds])
  useEffect(() => {
    if (dirtyIds.size === 0) return
    const guardLink = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (anchor && !window.confirm('未保存の翻訳があります。移動しますか？')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('click', guardLink, true)
    return () => document.removeEventListener('click', guardLink, true)
  }, [dirtyIds])
  function move(next: number) { if (dirtyIds.size > 0 && !window.confirm('未保存の翻訳があります。ページを移動しますか？')) return; setDirtyIds(new Set()); setLoading(true); setError(null); setPage(next); window.scrollTo(0, 0) }
  function refreshScript() { void scriptApi.get(projectId, scriptId).then(setScript).catch(() => setError('進捗を更新できませんでした。再読み込みしてください。')) }
  const completed = script?.progress.completed ?? 0
  const total = script?.progress.total ?? 0
  const percent = total ? Math.round(completed / total * 100) : 0
  return <section className="mx-auto max-w-7xl"><div className="flex flex-wrap gap-5 text-sm"><Link to={`/projects/${projectId}/scripts/${scriptId}`} className="text-sky-700">← スクリプト詳細</Link><Link to={`/projects/${projectId}`} className="text-sky-700">案件詳細</Link></div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
    {!script || !project ? <p role="status" className="mt-8">読み込み中…</p> : <><header className="sticky top-0 z-10 mt-5 border-b border-slate-200 bg-slate-50/95 py-4 backdrop-blur"><p className="text-sm text-slate-500">{project.name}</p><div className="mt-1 flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">{script.title}</h1><Link to={`/projects/${projectId}/scripts/${scriptId}/segments/new`} className="rounded-lg bg-sky-700 px-4 py-2 text-sm text-white">セグメントを追加</Link></div><div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-slate-600"><span>原文語数： <strong className="tabular-nums text-slate-900">{script.word_count.toLocaleString()}</strong></span><span>納期： <strong className="text-slate-900">{script.deadline ?? '—'}</strong></span><span>進捗： <strong className="tabular-nums text-slate-900">{completed} / {total}件 · {percent}%</strong></span></div><div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="翻訳進捗" className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-600" style={{ width: `${percent}%` }} /></div></header>
      {loading ? <p role="status" className="mt-8">セグメントを読み込み中…</p> : result && <><div className="mt-7 space-y-6">{result.data.length ? result.data.map((segment) => <SegmentCard key={segment.id} initial={segment} projectId={projectId} scriptId={scriptId} onDirtyChange={onDirtyChange} onSaved={refreshScript} />) : <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">セグメントはまだありません。「セグメントを追加」から原文を登録してください。</p>}</div><div className="mt-8 flex items-center justify-end gap-4 text-sm"><span>{result.meta.current_page} / {result.meta.last_page}ページ</span><button disabled={page <= 1} onClick={() => move(page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">前へ</button><button disabled={page >= result.meta.last_page} onClick={() => move(page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">次へ</button></div></>}
    </>}
  </section>
}
