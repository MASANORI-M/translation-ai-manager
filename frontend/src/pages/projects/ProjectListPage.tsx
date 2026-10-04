import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { projectApi } from '../../api/projects/projectApi'
import { ProjectStatusBadge } from '../../components/projects/ProjectStatusBadge'
import { displayRate, type ProjectList } from '../../types/projects'

export function ProjectListPage() {
  const [page, setPage] = useState(1)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [result, setResult] = useState<ProjectList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    projectApi.list(page, includeArchived).then((data) => { if (active) setResult(data) })
      .catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : '一覧を取得できませんでした。') })
    return () => { active = false }
  }, [page, includeArchived, attempt])

  function reload(nextPage = page) { setResult(null); setError(null); setPage(nextPage); setAttempt((value) => value + 1) }

  return <section>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">Projects</h1><p className="mt-2 text-sm text-slate-500">案件の単価・翻訳方針・ルールを管理します。</p></div>
      <Link to="/projects/new" className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800">新規案件</Link>
    </div>
    <label className="my-6 flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.target.checked); reload(1) }} />アーカイブを含める</label>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p>{error}</p><button onClick={() => reload()} className="mt-3 underline">再試行</button></div>
      : !result ? <p role="status" className="py-10 text-sm text-slate-500">読み込み中…</p>
      : result.data.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">案件はまだありません。「新規案件」から登録してください。</div>
      : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-180 text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-100/60 text-xs text-slate-500"><tr>{['案件名', '顧客名', 'ステータス', '単価・通貨', '翻訳スタイル'].map((label) => <th key={label} className="px-5 py-4 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{result.data.map((project) => <tr key={project.id} className="hover:bg-slate-50">
            <td className="max-w-60 break-words px-5 py-5"><Link to={`/projects/${project.id}`} className="font-semibold text-sky-700 hover:underline">{project.name}</Link></td>
            <td className="max-w-40 break-words px-5 py-5 text-slate-600">{project.client_name || '—'}</td>
            <td className="px-5 py-5"><ProjectStatusBadge status={project.status} /></td>
            <td className="px-5 py-5 text-slate-600">{displayRate(project)}</td>
            <td className="max-w-64 px-5 py-5 text-slate-600"><p className="line-clamp-2 whitespace-pre-wrap break-words">{project.translation_style || '—'}</p></td>
          </tr>)}</tbody>
        </table>
      </div>}
    {result && <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500"><span>全{result.meta.total}件 · {result.meta.current_page} / {result.meta.last_page}ページ</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => reload(page - 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">前へ</button><button disabled={page >= result.meta.last_page} onClick={() => reload(page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40">次へ</button></div></div>}
  </section>
}
