import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../api/client'
import { AuthProvider } from '../../contexts/auth/AuthProvider'
import { authApi } from '../../api/auth/authApi'
import { projectApi } from '../../api/projects/projectApi'
import { scriptApi } from '../../api/scripts/scriptApi'
import type { Project } from '../../types/projects'

vi.mock('../../api/scripts/scriptApi', async (original) => ({ ...await original<typeof import('../../api/scripts/scriptApi')>(), scriptApi: { list: vi.fn() } }))
vi.mock('../../api/auth/authApi', () => ({ authApi: { currentUser: vi.fn(), logout: vi.fn() } }))
vi.mock('../../api/projects/projectApi', () => ({ projectApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
const project: Project = { id: 1, user_id: 1, name: 'Sample Project', client_name: 'Client', description: 'Description', translation_style: '自然な日本語', translation_rules: '固有名詞を保持', rate_type: 'per_100_words', rate: '2.123456', currency: 'USD', usd_jpy_rate: null, status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' }
function Location() { return <span data-testid="location">{useLocation().pathname}</span> }
function open(path: string) { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /><Location /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(scriptApi.list).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
  vi.mocked(authApi.currentUser).mockResolvedValue({ id: 1, email: 'translator@example.com', created_at: '', updated_at: '' })
  vi.mocked(projectApi.get).mockResolvedValue(project)
  vi.mocked(projectApi.list).mockResolvedValue({ data: [project], meta: { current_page: 1, last_page: 1, total: 1 } })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

describe('Project management', () => {
  it.each(['/projects/1/edit', '/projects/edit/1'])('saves an edited exchange rate at %s and shows the new yen amount', async (path) => {
    const browser = userEvent.setup()
    const saved = { ...project, usd_jpy_rate: '160.250000', api_usage_cost: { totals: [{ currency: 'USD', total_cost: '1.0000000000', jpy_cost: '160.25' }], unknown_count: 0 } }
    vi.mocked(projectApi.get).mockResolvedValueOnce({ ...project, usd_jpy_rate: '157.630000' }).mockResolvedValue(saved)
    vi.mocked(projectApi.update).mockResolvedValue(saved)
    open(path)
    const input = await screen.findByLabelText('為替レート（1 USDあたりの円）')
    expect(input).toHaveValue('157.630000')
    await browser.clear(input)
    await browser.type(input, '160.25')
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByText('USD 1.00（160.25円）')).toBeInTheDocument()
    expect(projectApi.update).toHaveBeenCalledWith('1', expect.objectContaining({ usd_jpy_rate: '160.25' }))
  })

  it('shows the USD total with its yen conversion', async () => {
    vi.mocked(projectApi.get).mockResolvedValue({ ...project, usd_jpy_rate: '157.630000', api_usage_cost: { totals: [{ currency: 'USD', total_cost: '1.0000000000', jpy_cost: '157.63' }], unknown_count: 0 } })
    open('/projects/1')
    expect(await screen.findByText('USD 1.00（157.63円）')).toBeInTheDocument()
  })

  it('can clear the exchange rate to return to displaying USD only', async () => {
    const browser = userEvent.setup()
    vi.mocked(projectApi.get).mockResolvedValueOnce({ ...project, usd_jpy_rate: '157.630000' }).mockResolvedValue({ ...project, api_usage_cost: { totals: [{ currency: 'USD', total_cost: '1.0000000000', jpy_cost: null }], unknown_count: 0 } })
    vi.mocked(projectApi.update).mockResolvedValue(project)
    open('/projects/1/edit')
    await browser.clear(await screen.findByLabelText('為替レート（1 USDあたりの円）'))
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByText('USD 1.00')).toBeInTheDocument()
    expect(projectApi.update).toHaveBeenCalledWith('1', expect.objectContaining({ usd_jpy_rate: null }))
  })

  it('shows API usage without rounding small charges to zero or using the project contract currency', async () => {
    vi.mocked(projectApi.get).mockResolvedValue({ ...project, currency: 'JPY', api_usage_cost: { totals: [{ currency: 'USD', total_cost: '0.0000416000' }], unknown_count: 0 } })
    open('/projects/1')
    await screen.findByText('API利用料')
    expect(screen.getByText('USD 0.0000416')).toBeInTheDocument()
  })

  it('shows zero when there is no usage', async () => {
    vi.mocked(projectApi.get).mockResolvedValue({ ...project, api_usage_cost: { totals: [{ currency: 'USD', total_cost: '0.0000000000' }], unknown_count: 0 } })
    open('/projects/1')
    expect(await screen.findByText('USD 0.00')).toBeInTheDocument()
  })

  it('makes missing charges visible alongside the known total', async () => {
    vi.mocked(projectApi.get).mockResolvedValue({ ...project, api_usage_cost: { totals: [{ currency: 'USD', total_cost: '0.0000416000' }], unknown_count: 2 } })
    open('/projects/1')
    expect(await screen.findByText(/料金不明: 2件（合計に含まれていません）/)).toHaveTextContent('USD 0.0000416')
  })

  it.each(['/projects', '/projects/new', '/projects/1', '/projects/1/edit', '/projects/edit/1'])('protects %s for guests', async (path) => {
    vi.mocked(authApi.currentUser).mockResolvedValue(null)
    open(path)
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
    expect(projectApi.list).not.toHaveBeenCalled()
    expect(projectApi.get).not.toHaveBeenCalled()
  })

  it('shows the list, navigation and archived filter, then opens details', async () => {
    const browser = userEvent.setup()
    open('/projects')
    await screen.findByRole('link', { name: 'Sample Project' })
    expect(screen.getByRole('navigation')).toHaveTextContent('ダッシュボードPROJECTS')
    expect(screen.getByText('2.123456 USD / 100語あたり')).toBeInTheDocument()
    await browser.click(screen.getByLabelText('アーカイブを含める'))
    await waitFor(() => expect(projectApi.list).toHaveBeenLastCalledWith(1, true))
    await browser.click(await screen.findByRole('link', { name: 'Sample Project' }))
    expect(await screen.findByRole('heading', { name: 'Sample Project' })).toBeInTheDocument()
    expect(screen.getByText('固有名詞を保持')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/1')
  })

  it('creates a project with exact decimal input and displays the saved detail', async () => {
    const browser = userEvent.setup()
    vi.mocked(projectApi.create).mockResolvedValue(project)
    open('/projects/new')
    await browser.type(await screen.findByLabelText('案件名（必須）'), 'Sample Project')
    await browser.clear(screen.getByLabelText('単価（必須）'))
    await browser.type(screen.getByLabelText('単価（必須）'), '2.123456')
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByRole('heading', { name: 'Sample Project' })).toBeInTheDocument()
    expect(projectApi.create).toHaveBeenCalledWith({ name: 'Sample Project', client_name: null, description: null, translation_style: null, translation_rules: null, rate_type: 'per_100_words', rate: '2.123456', currency: 'USD', usd_jpy_rate: null, status: 'active' })
  })

  it('edits allowed fields without sending ownership or metadata', async () => {
    const browser = userEvent.setup()
    vi.mocked(projectApi.update).mockResolvedValue(project)
    open('/projects/1/edit')
    const input = await screen.findByLabelText('案件名（必須）')
    await browser.clear(input)
    await browser.type(input, 'Updated Project')
    await browser.selectOptions(screen.getByLabelText('ステータス（必須）'), 'paused')
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() => expect(projectApi.update).toHaveBeenCalled())
    expect(projectApi.update).toHaveBeenCalledWith('1', { name: 'Updated Project', client_name: 'Client', description: 'Description', translation_style: '自然な日本語', translation_rules: '固有名詞を保持', rate_type: 'per_100_words', rate: '2.123456', currency: 'USD', usd_jpy_rate: null, status: 'paused' })
    expect(await screen.findByRole('heading', { name: 'Sample Project' })).toBeInTheDocument()
  })

  it('preserves entered fields and shows server validation errors', async () => {
    const browser = userEvent.setup()
    vi.mocked(projectApi.create).mockRejectedValue(new ApiError(422, '入力内容を確認してください。', { currency: ['通貨は英字3文字です。'] }))
    open('/projects/new')
    await browser.type(await screen.findByLabelText('案件名（必須）'), 'Keep this name')
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByText('通貨は英字3文字です。')).toBeInTheDocument()
    expect(screen.getByLabelText('案件名（必須）')).toHaveValue('Keep this name')
    expect(screen.getByLabelText('通貨（必須）')).toHaveAttribute('aria-invalid', 'true')
  })

  it('requires confirmation before deleting and permits cancellation', async () => {
    const browser = userEvent.setup()
    vi.mocked(projectApi.delete).mockResolvedValue(undefined)
    open('/projects/1')
    await screen.findByRole('heading', { name: 'Sample Project' })
    await browser.click(screen.getByRole('button', { name: '削除' }))
    const confirmation = screen.getByRole('dialog', { name: '案件を削除しますか？' })
    expect(projectApi.delete).not.toHaveBeenCalled()
    await browser.click(within(confirmation).getByRole('button', { name: 'キャンセル' }))
    expect(projectApi.delete).not.toHaveBeenCalled()
    await browser.click(screen.getByRole('button', { name: '削除' }))
    await browser.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/projects'))
    expect(projectApi.delete).toHaveBeenCalledWith('1')
  })

  it('keeps delete failure visible and does not leave the detail', async () => {
    const browser = userEvent.setup()
    vi.mocked(projectApi.delete).mockRejectedValue(new ApiError(0, '接続できません。'))
    open('/projects/1')
    await screen.findByRole('heading', { name: 'Sample Project' })
    await browser.click(screen.getByRole('button', { name: '削除' }))
    await browser.click(screen.getByRole('button', { name: '削除する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('接続できません。')
    expect(screen.getByTestId('location')).toHaveTextContent('/projects/1')
  })

  it('shows authorization errors without showing project data', async () => {
    vi.mocked(projectApi.get).mockRejectedValue(new ApiError(403, 'この操作は現在許可されていません。'))
    open('/projects/2')
    expect(await screen.findByRole('alert')).toHaveTextContent('この操作は現在許可されていません。')
    expect(screen.queryByRole('heading', { name: 'Sample Project' })).not.toBeInTheDocument()
  })
})
