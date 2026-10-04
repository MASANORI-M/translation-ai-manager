import { scriptStatuses, type Script } from '../../api/scripts/scriptApi'
const colors = { pending: 'bg-slate-100 text-slate-700', in_progress: 'bg-sky-100 text-sky-800', review: 'bg-amber-100 text-amber-800', completed: 'bg-emerald-100 text-emerald-800' }
export function ScriptStatusBadge({ status }: { status: Script['status'] }) { return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${colors[status]}`}>{scriptStatuses[status]}</span> }
