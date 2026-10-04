import { apiRequest, initializeCsrf } from '../client'
import type { RateType } from '../../types/projects'
export const scriptStatuses = { pending: '未着手', in_progress: '作業中', review: '確認中', completed: '完了' } as const
export interface ScriptInput { title: string; word_count: number; deadline: string | null; status: keyof typeof scriptStatuses }
export interface Script extends ScriptInput { id: number; project_id: number; started_at: string | null; completed_at: string | null; rate_type: RateType; rate: string; currency: string; estimated_payment: string | null; progress: { completed: number; total: number } }
export interface ScriptList { data: Script[]; meta: { current_page: number; last_page: number; total: number } }
const path = (project: string, script?: string) => `/projects/${encodeURIComponent(project)}/scripts${script ? `/${encodeURIComponent(script)}` : ''}`
async function mutate<T>(url: string, method: string, body?: ScriptInput): Promise<T> { await initializeCsrf(); return apiRequest<T>(url, { method, body }) }
export const scriptApi = {
  list: (project: string, page = 1) => apiRequest<ScriptList>(`${path(project)}?page=${page}`),
  get: async (project: string, id: string) => (await apiRequest<{ data: Script }>(path(project, id))).data,
  create: async (project: string, body: ScriptInput) => (await mutate<{ data: Script }>(path(project), 'POST', body)).data,
  update: async (project: string, id: string, body: ScriptInput) => (await mutate<{ data: Script }>(path(project, id), 'PUT', body)).data,
  delete: (project: string, id: string) => mutate<void>(path(project, id), 'DELETE'),
}
export const payment = (script: Script) => script.estimated_payment === null ? '未確定（時間単価）' : `${script.currency} ${script.estimated_payment}`
