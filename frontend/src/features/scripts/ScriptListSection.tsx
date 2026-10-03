import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { payment, scriptApi, type ScriptList } from './scriptApi'
import { ScriptStatusBadge } from './ScriptStatusBadge'
export function ScriptListSection({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<ScriptList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    scriptApi.list(projectId, page).then((data) => { if (active) { setResult(data); setLoading(false) } }).catch((error: unknown) => { if (active) { setError(error instanceof Error ? error.message : 'スクリプト一覧を取得できませんでした。'); setLoading(false) } })
    return () => { active = false }
  }, [projectId, page])
  function changePage(next: number) { setLoading(true); setError(null); setPage(next) }
  return <section className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Scripts</h2><Link to={`/projects/${projectId}/scripts/new`} className="rounded-lg bg-sky-700 px-4 py-2 text-sm text-white">スクリプトを追加</Link></div>
    {error ? <p role="alert" className="text-red-700">{error}</p> : loading ? <p role="status">読み込み中…</p> : result && <>
      {result.data.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">スクリプトはまだありません。</p> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['タイトル', '語数', '納期', 'ステータス', '見込額'].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody>{result.data.map((script) => <tr key={script.id} className="border-t border-slate-100"><td className="max-w-xs break-words px-4 py-4"><Link to={`/projects/${projectId}/scripts/${script.id}`} className="font-medium text-sky-700 hover:underline">{script.title}</Link></td><td className="px-4 py-4 tabular-nums">{script.word_count.toLocaleString()}</td><td className="whitespace-nowrap px-4 py-4">{script.deadline ?? '—'}</td><td className="whitespace-nowrap px-4 py-4"><ScriptStatusBadge status={script.status} /></td><td className="whitespace-nowrap px-4 py-4 tabular-nums">{payment(script)}</td></tr>)}</tbody></table></div>}
      <div className="mt-4 flex items-center justify-end gap-4 text-sm"><span>{result.meta.total}件 / {result.meta.current_page}ページ</span><button disabled={page <= 1} onClick={() => changePage(page - 1)} className="rounded border px-3 py-2 disabled:opacity-40">前へ</button><button disabled={page >= result.meta.last_page} onClick={() => changePage(page + 1)} className="rounded border px-3 py-2 disabled:opacity-40">次へ</button></div>
    </>}
  </section>
}
