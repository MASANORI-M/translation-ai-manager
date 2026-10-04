import { apiRequest, initializeCsrf } from '../client'
import type { Segment } from '../segments/segmentApi'
import type { GlossarySnapshot } from '../glossary/glossaryApi'

export interface AiModel { id: string; name: string }
export interface AiModels { models: AiModel[]; default_model: string | null }
export interface ContextSegment { id: number; sequence: number; source_text: string; source_version: number }
export interface FinalTranslationReference { id: number; sequence: number; source_text: string; final_translation: string }
export interface SegmentContextSnapshot {
  previous: ContextSegment | null
  current: ContextSegment
  next: ContextSegment | null
  recent_final_translations?: FinalTranslationReference[]
}
export interface AiGeneration {
  id: number
  segment_id: number
  model: string
  model_name: string
  resolved_model: string | null
  instruction: string
  output: string
  source_version_snapshot: number
  source_text_snapshot: string
  glossary_snapshot?: GlossarySnapshot[] | null
  segment_context_snapshot?: SegmentContextSnapshot | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cached_input_tokens: number | null
  cache_write_tokens: number | null
  cost_status: 'calculated' | 'unknown'
  input_cost: string | null
  output_cost: string | null
  total_cost: string | null
  selected: boolean
  created_at: string
}
export interface AiHistory { data: AiGeneration[]; meta: { current_page: number; last_page: number; total: number } }
export interface AiResult { translation: string; generation: AiGeneration; segment: Segment; applied: boolean }
const path = (project: string, script: string, segment: number) => `/projects/${encodeURIComponent(project)}/scripts/${encodeURIComponent(script)}/segments/${segment}`
async function post<T>(url: string, body: unknown): Promise<T> { await initializeCsrf(); return apiRequest<T>(url, { method: 'POST', body }) }
export const aiApi = {
  models: () => apiRequest<AiModels>('/ai/models'),
  generate: (project: string, script: string, segment: number, model: string, version: number) => post<AiResult>(`${path(project, script, segment)}/ai-translate`, { model, version }),
  history: (project: string, script: string, segment: number, page = 1) => apiRequest<AiHistory>(`${path(project, script, segment)}/ai-generations?page=${page}`),
  select: async (project: string, script: string, segment: number, generation: number, version: number) => (await post<{ data: Segment }>(`${path(project, script, segment)}/ai-generations/${generation}/select`, { version })).data,
}
