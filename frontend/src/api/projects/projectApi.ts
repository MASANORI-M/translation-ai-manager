import { apiRequest, initializeCsrf } from '../client'
import type { Project, ProjectInput, ProjectList } from '../../types/projects'

async function mutate<T>(path: string, method: string, body?: ProjectInput): Promise<T> {
  await initializeCsrf()
  return apiRequest<T>(path, { method, body })
}
export const projectApi = {
  list: (page = 1, includeArchived = false) => apiRequest<ProjectList>(`/projects?page=${page}&include_archived=${includeArchived ? 1 : 0}`),
  get: async (id: string) => (await apiRequest<{ data: Project }>(`/projects/${encodeURIComponent(id)}`)).data,
  create: async (body: ProjectInput) => (await mutate<{ data: Project }>('/projects', 'POST', body)).data,
  update: async (id: string, body: ProjectInput) => (await mutate<{ data: Project }>(`/projects/${encodeURIComponent(id)}`, 'PUT', body)).data,
  delete: (id: string) => mutate<void>(`/projects/${encodeURIComponent(id)}`, 'DELETE'),
}
