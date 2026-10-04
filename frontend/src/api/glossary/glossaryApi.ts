import { apiRequest, initializeCsrf } from '../client'

export interface GlossaryInput { source_term: string; target_term: string; note: string | null }
export interface Glossary extends GlossaryInput { id: number; project_id: number; created_at: string; updated_at: string }
export type GlossarySnapshot = Pick<Glossary, 'id' | 'source_term' | 'target_term' | 'note'>
export interface GlossaryList { data: Glossary[]; meta: { current_page: number; last_page: number; total: number } }
const path = (project: string) => `/projects/${encodeURIComponent(project)}/glossaries`
async function mutate<T>(url: string, method: string, body?: GlossaryInput): Promise<T> {
  await initializeCsrf()
  return apiRequest<T>(url, { method, body })
}
export const glossaryApi = {
  list: (project: string, page = 1) => apiRequest<GlossaryList>(`${path(project)}?page=${page}`),
  create: async (project: string, body: GlossaryInput) => (await mutate<{ data: Glossary }>(path(project), 'POST', body)).data,
  update: async (project: string, id: number, body: GlossaryInput) => (await mutate<{ data: Glossary }>(`${path(project)}/${id}`, 'PUT', body)).data,
  delete: (project: string, id: number) => mutate<void>(`${path(project)}/${id}`, 'DELETE'),
}
