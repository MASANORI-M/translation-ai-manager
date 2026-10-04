import { useState } from 'react'
import { ApiError } from '../../api/client'
import { aiApi, type AiGeneration, type AiHistory, type AiModels } from '../../api/ai/aiApi'
import type { Segment } from '../../api/segments/segmentApi'
import { GenerationGlossary } from './GenerationGlossary'
import { GenerationSegmentContext } from './GenerationSegmentContext'

export function AiTranslationTools({ segment, projectId, scriptId, models, busy, setBusy, translation, onGenerated, onSelected }: {
  segment: Segment; projectId: string; scriptId: string; models: AiModels | null; busy: boolean
  setBusy: (busy: boolean) => void; translation: string
  onGenerated: (result: Segment, conflict: boolean) => void; onSelected: (result: Segment) => void
}) {
  const [chosenModel, setChosenModel] = useState('')
  const model = models?.models.some((item) => item.id === chosenModel) ? chosenModel : models?.default_model ?? ''
  const [generating, setGenerating] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<AiHistory | null>(null)
  const [latest, setLatest] = useState<AiGeneration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  function showError(problem: unknown) {
    setError(problem instanceof ApiError && Object.keys(problem.errors).length ? Object.values(problem.errors).flat().join(' ') : problem instanceof Error ? problem.message : 'AI操作に失敗しました。')
  }
  async function loadHistory(page = 1) {
    setHistoryLoading(true); setError(null)
    try { setHistory(await aiApi.history(projectId, scriptId, segment.id, page)) }
    catch (problem) { showError(problem) }
    finally { setHistoryLoading(false) }
  }
  async function generate() {
    if (busy || !model) return
    setBusy(true); setGenerating(true); setError(null); setMessage(null)
    try {
      const result = await aiApi.generate(projectId, scriptId, segment.id, model, segment.version)
      const conflict = !result.applied || result.segment.version !== segment.version + 1
      onGenerated(result.segment, conflict); setLatest(result.generation)
      setMessage(conflict ? '生成中に別の操作でSegmentが変更されました。候補は履歴に保存されています。再読み込みして確認してください。' : 'AI候補を生成しました。最終訳は変更していません。')
      if (historyOpen) await loadHistory()
    } catch (problem) { showError(problem) }
    finally { setBusy(false); setGenerating(false) }
  }
  async function select(id: number, output: string) {
    if (busy) return
    if (translation.trim() && translation !== output && !window.confirm('現在の最終訳をこのAI候補で置き換えて保存しますか？')) return
    setBusy(true); setSelecting(true); setError(null); setMessage(null)
    try {
      onSelected(await aiApi.select(projectId, scriptId, segment.id, id, segment.version))
      setLatest((current) => current ? { ...current, selected: current.id === id } : null)
      setHistory((current) => current ? { ...current, data: current.data.map((generation) => ({ ...generation, selected: generation.id === id })) } : null)
      setMessage('最終訳として採用しました。確認後に「完了にする」を押してください。')
      if (historyOpen) await loadHistory(history?.meta.current_page)
    } catch (problem) { showError(problem) }
    finally { setBusy(false); setSelecting(false) }
  }
  const outdated = segment.ai_source_version !== segment.source_version
  const candidate = segment.ai_generation ?? (latest?.id === segment.ai_generation_id ? latest : null)
  return <div className="mb-6 border-b border-slate-200 pb-5">
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-40 flex-1 text-xs font-semibold text-slate-600" htmlFor={`model-${segment.id}`}>AIモデル<select id={`model-${segment.id}`} value={model} disabled={busy || !models?.models.length} onChange={(event) => setChosenModel(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-normal">{!models && <option value="">読み込み中…</option>}{models && !models.models.length && <option value="">利用可能なモデルなし</option>}{models?.models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button disabled={busy || !model} onClick={() => void generate()} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm text-white disabled:opacity-50">{generating ? '生成中…' : 'AI翻訳'}</button>
      <button disabled={historyLoading || busy} aria-expanded={historyOpen} onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) void loadHistory() }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50">履歴</button>
    </div>
    {segment.ai_translation && <div className="mt-4 rounded-lg bg-indigo-50 p-4"><h3 className="text-xs font-semibold text-indigo-800">AI翻訳候補</h3><p className="mt-2 whitespace-pre-wrap break-words leading-8">{segment.ai_translation}</p>{outdated && <p className="mt-2 text-xs text-amber-800">原文・演出変更前の候補です。再生成してください。</p>}{candidate && <><p className="mt-2 text-xs text-slate-600">Generation #{candidate.id} · {candidate.model_name} · {new Date(candidate.created_at).toLocaleString('ja-JP')}{candidate.selected && <span className="ml-2 text-emerald-700">採用元</span>}</p><p className="mt-1 text-xs text-slate-600">{candidate.total_tokens.toLocaleString()} tokens · {candidate.total_cost === null ? '料金不明' : `$${candidate.total_cost} USD`}</p></>}<button disabled={busy || outdated || !segment.ai_generation_id} onClick={() => void select(segment.ai_generation_id!, segment.ai_translation!)} className="mt-3 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm text-indigo-800 disabled:opacity-50">{selecting ? '採用中…' : 'この翻訳を使う'}</button></div>}
    {historyOpen && <div className="mt-4 space-y-3" aria-label="AI生成履歴">{historyLoading && <p role="status" className="text-sm">履歴を読み込み中…</p>}{history && !history.data.length && <p className="text-sm text-slate-500">生成履歴はまだありません。</p>}{history?.data.map((generation) => <article key={generation.id} className="rounded-lg border border-slate-200 p-3"><p className="text-sm font-semibold">Generation #{generation.id} · {generation.model_name}{generation.selected && <span className="ml-2 text-emerald-700">採用元</span>}</p><p className="mt-1 text-xs text-slate-500">{new Date(generation.created_at).toLocaleString('ja-JP')}</p><p className="mt-1 text-xs text-slate-500">Source version {generation.source_version_snapshot} / 現在 {segment.source_version}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{generation.output}</p><p className="mt-2 text-xs text-slate-600">入力 {generation.input_tokens.toLocaleString()} / 出力 {generation.output_tokens.toLocaleString()} / 合計 {generation.total_tokens.toLocaleString()} tokens</p><p className="mt-1 text-xs text-slate-600">キャッシュ読取 {generation.cached_input_tokens ?? '不明'} / 書込 {generation.cache_write_tokens ?? '不明'} · {generation.total_cost === null ? '料金不明' : `$${generation.total_cost} USD`}</p><GenerationGlossary generation={generation} /><GenerationSegmentContext generation={generation} /><details className="mt-2 text-xs text-slate-500"><summary>生成時の指示</summary><p className="mt-2 whitespace-pre-wrap break-words">{generation.instruction}</p></details>{generation.source_version_snapshot !== segment.source_version ? <p className="mt-2 text-xs text-amber-800">原文・演出変更前の候補</p> : <button disabled={busy || (generation.selected && translation === generation.output && segment.final_translation === generation.output)} onClick={() => void select(generation.id, generation.output)} className="mt-2 text-sm text-indigo-700 disabled:opacity-50">この候補を採用</button>}</article>)}{history && history.meta.last_page > 1 && <div className="flex items-center gap-3 text-xs"><button disabled={historyLoading || busy || history.meta.current_page <= 1} onClick={() => void loadHistory(history.meta.current_page - 1)} className="disabled:opacity-40">前へ</button><span>{history.meta.current_page} / {history.meta.last_page}</span><button disabled={historyLoading || busy || history.meta.current_page >= history.meta.last_page} onClick={() => void loadHistory(history.meta.current_page + 1)} className="disabled:opacity-40">次へ</button></div>}</div>}
    {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>
}
