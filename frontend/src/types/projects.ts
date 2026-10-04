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
  usd_jpy_rate: string | null
  status: ProjectStatus
}
export interface Project extends ProjectInput {
  id: number
  user_id: number
  created_at: string
  updated_at: string
  api_usage_cost?: {
    totals: { currency: string; total_cost: string; jpy_cost?: string | null }[]
    unknown_count: number
  }
}
export interface ProjectList {
  data: Project[]
  meta: { current_page: number; last_page: number; total: number }
}
export function displayRate(project: Pick<ProjectInput, 'rate' | 'currency' | 'rate_type'>): string {
  return `${project.rate.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')} ${project.currency} / ${rateTypes[project.rate_type]}`
}

export function displayApiUsageCost(project: Project): string {
  const usage = project.api_usage_cost
  if (!usage) return '—'
  const lines = usage.totals.map(({ currency, total_cost, jpy_cost }) => {
    const [integer, decimal = ''] = total_cost.split('.')
    const amount = `${integer}.${decimal.replace(/0+$/, '').padEnd(2, '0')}`
    return `${currency} ${amount}${jpy_cost != null ? `（${jpy_cost}円）` : ''}`
  })
  if (usage.unknown_count > 0) lines.push(`料金不明: ${usage.unknown_count}件（合計に含まれていません）`)
  return lines.join('\n')
}
