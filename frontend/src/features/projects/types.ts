export const rateTypes = {
  per_100_words: '100語あたり',
  per_word: '1語あたり',
  hourly: '時間単価',
  fixed: '固定額',
} as const

export const statuses = { active: '進行中', paused: '一時停止', completed: '完了', archived: 'アーカイブ' } as const
export type RateType = keyof typeof rateTypes
export type ProjectStatus = keyof typeof statuses
export interface ProjectInput {
  name: string
  client_name: string | null
  description: string | null
  translation_style: string | null
  translation_rules: string | null
  rate_type: RateType
  rate: string
  currency: string
  status: ProjectStatus
}
export interface Project extends ProjectInput {
  id: number
  user_id: number
  created_at: string
  updated_at: string
}
export interface ProjectList {
  data: Project[]
  meta: { current_page: number; last_page: number; total: number }
}
export function displayRate(project: Pick<ProjectInput, 'rate' | 'currency' | 'rate_type'>): string {
  return `${project.rate.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')} ${project.currency} / ${rateTypes[project.rate_type]}`
}
