import { Link } from 'react-router-dom'

export function DashboardPage() {
  return <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-widest text-sky-700">Workspace</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight">Welcome</h1>
    <p className="mt-3 text-slate-600">翻訳案件の条件やルールを管理できます。</p>
    <Link to="/projects" className="mt-6 inline-block rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800">案件一覧へ</Link>
  </section>
}
