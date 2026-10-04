import { statuses, type ProjectStatus } from '../../types/projects'

const colors: Record<ProjectStatus, string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  paused: 'bg-amber-50 text-amber-800 ring-amber-200',
  completed: 'bg-sky-50 text-sky-800 ring-sky-200',
  archived: 'bg-slate-100 text-slate-600 ring-slate-200',
}
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colors[status]}`}>{statuses[status]}</span>
}
