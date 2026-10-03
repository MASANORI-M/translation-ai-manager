import { apiRequest, initializeCsrf } from '../../lib/api'

export const segmentStatuses = { pending: '未着手', editing: '編集中', completed: '完了' } as const
export type SegmentStatus = keyof typeof segmentStatuses
export interface SegmentInput {
  sequence: number
  timecode_start: string | null
  timecode_end: string | null
  emotion: string | null
  source_text: string
  final_translation: string | null
  memo: string | null
  status: SegmentStatus
}
export interface Segment extends SegmentInput {
  id: number
  script_id: number
  ai_translation: null
  source_version: number
  final_source_version: number | null
  version: number
  created_at: string
  updated_at: string
}
export interface SegmentList { data: Segment[]; meta: { current_page: number; last_page: number; total: number } }
const path = (project: string, script: string, segment?: string) => `/projects/${encodeURIComponent(project)}/scripts/${encodeURIComponent(script)}/segments${segment ? `/${encodeURIComponent(segment)}` : ''}`
async function mutate<T>(url: string, method: string, body?: SegmentInput | (SegmentInput & { version: number })): Promise<T> { await initializeCsrf(); return apiRequest<T>(url, { method, body }) }
export const segmentApi = {
  list: (project: string, script: string, page = 1) => apiRequest<SegmentList>(`${path(project, script)}?page=${page}`),
  get: async (project: string, script: string, segment: string) => (await apiRequest<{ data: Segment }>(path(project, script, segment))).data,
  create: async (project: string, script: string, body: SegmentInput) => (await mutate<{ data: Segment }>(path(project, script), 'POST', body)).data,
  update: async (project: string, script: string, segment: string, body: SegmentInput & { version: number }) => (await mutate<{ data: Segment }>(path(project, script, segment), 'PUT', body)).data,
  delete: (project: string, script: string, segment: string) => mutate<void>(path(project, script, segment), 'DELETE'),
}
