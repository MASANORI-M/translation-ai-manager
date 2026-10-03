import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, type ValidationErrors } from '../../lib/api'
import { rateTypes, statuses, type ProjectInput } from './types'

const defaults: ProjectInput = { name: '', client_name: '', description: '', translation_style: '', translation_rules: '', rate_type: 'per_100_words', rate: '0', currency: 'USD', status: 'active' }
const inputClass = 'mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50'

export function ProjectForm({ initial, onSave, cancelTo }: { initial?: ProjectInput; onSave: (input: ProjectInput) => Promise<void>; cancelTo: string }) {
  const [values, setValues] = useState<ProjectInput>(() => initial ? {
    name: initial.name,
    client_name: initial.client_name,
    description: initial.description,
    translation_style: initial.translation_style,
    translation_rules: initial.translation_rules,
    rate_type: initial.rate_type,
    rate: initial.rate,
    currency: initial.currency,
    status: initial.status,
  } : defaults)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<ValidationErrors>({})

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null); setErrors({})
    const input = { ...values }
    for (const field of ['client_name', 'description', 'translation_style', 'translation_rules'] as const) input[field] = values[field]?.trim() ? values[field] : null
    input.name = input.name.trim()
    input.currency = input.currency.trim().toUpperCase()
    try { await onSave(input) }
    catch (error) { setError(error instanceof Error ? error.message : '保存できませんでした。'); if (error instanceof ApiError) setErrors(error.errors) }
    finally { setBusy(false) }
  }

  function feedback(field: keyof ProjectInput) {
    return errors[field] && <p id={`${field}-error`} className="mt-2 text-sm text-red-700">{errors[field].join(' ')}</p>
  }
  function attributes(field: keyof ProjectInput) {
    return { id: field, 'aria-invalid': !!errors[field], 'aria-describedby': errors[field] ? `${field}-error` : undefined }
  }
  function change(field: keyof ProjectInput, value: string) { setValues((previous) => ({ ...previous, [field]: value })) }

  return <form onSubmit={submit} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    {error && <p role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <fieldset disabled={busy} className="space-y-7">
      <legend className="mb-5 text-sm font-semibold text-slate-800">案件情報</legend>
      <div className="grid gap-6 sm:grid-cols-2">{(['name', 'client_name'] as const).map((field) => <div key={field}><label htmlFor={field} className="text-sm font-medium">{field === 'name' ? '案件名（必須）' : '顧客名'}</label><input {...attributes(field)} value={values[field] ?? ''} onChange={(event) => change(field, event.target.value)} required={field === 'name'} maxLength={255} className={inputClass} />{feedback(field)}</div>)}</div>
      {(['description', 'translation_style', 'translation_rules'] as const).map((field) => <div key={field}><label htmlFor={field} className="text-sm font-medium">{{ description: '説明', translation_style: '翻訳スタイル', translation_rules: '翻訳ルール' }[field]}</label><textarea {...attributes(field)} value={values[field] ?? ''} onChange={(event) => change(field, event.target.value)} maxLength={10000} rows={field === 'translation_rules' ? 7 : 3} className={`${inputClass} resize-y`} />{feedback(field)}</div>)}
      <div className="border-t border-slate-100 pt-6">
        <h2 className="mb-5 text-sm font-semibold">契約条件とステータス</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div><label htmlFor="rate_type" className="text-sm font-medium">単価方式（必須）</label><select {...attributes('rate_type')} value={values.rate_type} onChange={(event) => change('rate_type', event.target.value)} className={inputClass}>{Object.entries(rateTypes).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>{feedback('rate_type')}</div>
          <div><label htmlFor="rate" className="text-sm font-medium">単価（必須）</label><input {...attributes('rate')} type="text" inputMode="decimal" required pattern="[0-9]{1,12}(\.[0-9]{1,6})?" value={values.rate} onChange={(event) => change('rate', event.target.value)} className={inputClass} /><p className="mt-2 text-xs text-slate-500">0以上、整数部12桁・小数部6桁以内</p>{feedback('rate')}</div>
          <div><label htmlFor="currency" className="text-sm font-medium">通貨（必須）</label><input {...attributes('currency')} required maxLength={3} placeholder="USD / JPY" value={values.currency} onChange={(event) => change('currency', event.target.value)} className={inputClass} />{feedback('currency')}</div>
          <div><label htmlFor="status" className="text-sm font-medium">ステータス（必須）</label><select {...attributes('status')} value={values.status} onChange={(event) => change('status', event.target.value)} className={inputClass}>{Object.entries(statuses).map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>{feedback('status')}</div>
        </div>
      </div>
    </fieldset>
    <div className="mt-8 flex items-center gap-4 border-t border-slate-100 pt-6"><button type="submit" disabled={busy} className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-60">{busy ? '保存中…' : '保存する'}</button>{busy ? <span className="text-sm text-slate-400">キャンセル</span> : <Link to={cancelTo} className="text-sm text-slate-600 hover:underline">キャンセル</Link>}</div>
  </form>
}
