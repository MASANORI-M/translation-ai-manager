import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../lib/api'
import { AuthProvider } from '../auth/AuthProvider'
import { authApi } from '../auth/authApi'
import { projectApi } from './projectApi'
import { scriptApi } from '../scripts/scriptApi'
import type { Project } from './types'

vi.mock('../scripts/scriptApi', async (original) => ({ ...await original<typeof import('../scripts/scriptApi')>(), scriptApi: { list: vi.fn() } }))
vi.mock('../auth/authApi', () => ({ authApi: { currentUser: vi.fn(), logout: vi.fn() } }))
vi.mock('./projectApi', () => ({ projectApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
const project: Project = { id: 1, user_id: 1, name: 'Sample Project', client_name: 'Client', description: 'Description', translation_style: '自然な日本語', translation_rules: '固有名詞を保持', rate_type: 'per_100_words', rate: '2.123456', currency: 'USD', status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01' }
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
  it.each(['/projects', '/projects/new', '/projects/1', '/projects/1/edit'])('protects %s for guests', async (path) => {
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
    expect(screen.getByRole('navigation')).toHaveTextContent('DashboardProjects')
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
    expect(projectApi.create).toHaveBeenCalledWith({ name: 'Sample Project', client_name: null, description: null, translation_style: null, translation_rules: null, rate_type: 'per_100_words', rate: '2.123456', currency: 'USD', status: 'active' })
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
    expect(projectApi.update).toHaveBeenCalledWith('1', { name: 'Updated Project', client_name: 'Client', description: 'Description', translation_style: '自然な日本語', translation_rules: '固有名詞を保持', rate_type: 'per_100_words', rate: '2.123456', currency: 'USD', status: 'paused' })
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
