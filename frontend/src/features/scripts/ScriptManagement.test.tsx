import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../lib/api'
import { AuthProvider } from '../auth/AuthProvider'
import { authApi } from '../auth/authApi'
import { projectApi } from '../projects/projectApi'
import type { Project } from '../projects/types'
import { scriptApi, type Script } from './scriptApi'
vi.mock('../auth/authApi', () => ({ authApi: { currentUser: vi.fn(), logout: vi.fn() } }))
vi.mock('../projects/projectApi', () => ({ projectApi: { get: vi.fn() } }))
vi.mock('./scriptApi', async (original) => ({ ...await original<typeof import('./scriptApi')>(), scriptApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
const project: Project = { id: 1, user_id: 1, name: 'Video Project', client_name: null, description: null, translation_style: null, translation_rules: null, rate_type: 'per_100_words', rate: '1.800000', currency: 'USD', status: 'active', created_at: '', updated_at: '' }
const script: Script = { id: 2, project_id: 1, title: 'Video #001', word_count: 4500, deadline: '2026-10-10', status: 'pending', started_at: null, completed_at: null, rate_type: 'per_100_words', rate: '1.800000', currency: 'USD', estimated_payment: '81.00', progress: { completed: 0, total: 0 } }
function open(path: string) { render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authApi.currentUser).mockResolvedValue({ id: 1, email: 'test@example.com', created_at: '', updated_at: '' })
  vi.mocked(projectApi.get).mockResolvedValue(project)
  vi.mocked(scriptApi.get).mockResolvedValue(script)
  vi.mocked(scriptApi.list).mockResolvedValue({ data: [script], meta: { current_page: 1, last_page: 1, total: 1 } })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
it.each(['/projects/1/scripts/new', '/projects/1/scripts/2', '/projects/1/scripts/2/edit'])('protects %s for guests', async (path) => {
  vi.mocked(authApi.currentUser).mockResolvedValue(null); open(path)
  expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument(); expect(scriptApi.get).not.toHaveBeenCalled()
})
it('lists scripts inside the project and opens a detail with payment', async () => {
  const browser = userEvent.setup(); open('/projects/1')
  await browser.click(await screen.findByRole('link', { name: 'Video #001' }))
  expect(await screen.findByRole('heading', { name: 'Video #001' })).toBeInTheDocument()
  expect(screen.getByText('USD 81.00')).toBeInTheDocument(); expect(screen.getByText('4,500')).toBeInTheDocument()
  expect(scriptApi.get).toHaveBeenCalledWith('1', '2')
})
it('creates a script with only editable fields', async () => {
  const browser = userEvent.setup(); vi.mocked(scriptApi.create).mockResolvedValue(script); open('/projects/1/scripts/new')
  await browser.type(await screen.findByLabelText('タイトル（必須）'), 'Video #001')
  await browser.clear(screen.getByLabelText('原文語数（必須）')); await browser.type(screen.getByLabelText('原文語数（必須）'), '4500')
  await browser.type(screen.getByLabelText('納期'), '2026-10-10')
  await browser.click(screen.getByRole('button', { name: '保存する' }))
  expect(await screen.findByRole('heading', { name: 'Video #001' })).toBeInTheDocument()
  expect(scriptApi.create).toHaveBeenCalledWith('1', { title: 'Video #001', word_count: 4500, deadline: '2026-10-10', status: 'pending' })
})
it('edits without sending contract, IDs or dates managed by the backend', async () => {
  const browser = userEvent.setup(); vi.mocked(scriptApi.update).mockResolvedValue(script); open('/projects/1/scripts/2/edit')
  await screen.findByLabelText('タイトル（必須）'); await browser.selectOptions(screen.getByLabelText('ステータス（必須）'), 'in_progress')
  await browser.clear(screen.getByLabelText('納期')); await browser.click(screen.getByRole('button', { name: '保存する' }))
  await waitFor(() => expect(scriptApi.update).toHaveBeenCalledWith('1', '2', { title: 'Video #001', word_count: 4500, deadline: null, status: 'in_progress' }))
})
it('preserves form values and displays server field errors', async () => {
  const browser = userEvent.setup(); vi.mocked(scriptApi.create).mockRejectedValue(new ApiError(422, '入力内容を確認してください。', { title: ['タイトルを確認してください。'] })); open('/projects/1/scripts/new')
  await browser.type(await screen.findByLabelText('タイトル（必須）'), 'Keep me'); await browser.click(screen.getByRole('button', { name: '保存する' }))
  expect(await screen.findByText('タイトルを確認してください。')).toBeInTheDocument(); expect(screen.getByLabelText('タイトル（必須）')).toHaveValue('Keep me')
})
it('requires confirmation, allows cancellation and returns to the project after deletion', async () => {
  const browser = userEvent.setup(); vi.mocked(scriptApi.delete).mockResolvedValue(undefined); open('/projects/1/scripts/2')
  await screen.findByRole('heading', { name: 'Video #001' }); await browser.click(screen.getByRole('button', { name: '削除' }))
  expect(scriptApi.delete).not.toHaveBeenCalled(); await browser.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'キャンセル' })); expect(scriptApi.delete).not.toHaveBeenCalled()
  await browser.click(screen.getByRole('button', { name: '削除' })); await browser.click(screen.getByRole('button', { name: '削除する' }))
  expect(await screen.findByRole('heading', { name: 'Video Project' })).toBeInTheDocument(); expect(scriptApi.delete).toHaveBeenCalledWith('1', '2')
})
it('shows hourly payment as undetermined', async () => {
  vi.mocked(scriptApi.get).mockResolvedValue({ ...script, rate_type: 'hourly', estimated_payment: null }); open('/projects/1/scripts/2')
  expect(await screen.findByText('未確定（時間単価）')).toBeInTheDocument()
})
it('shows wrong-parent errors without script data', async () => {
  vi.mocked(scriptApi.get).mockRejectedValue(new ApiError(404, '指定されたデータが見つかりません。')); open('/projects/1/scripts/3')
  expect(await screen.findByRole('alert')).toHaveTextContent('指定されたデータが見つかりません。'); expect(screen.queryByRole('heading', { name: 'Video #001' })).not.toBeInTheDocument()
})
it('supports paginated script lists', async () => {
  const browser = userEvent.setup(); vi.mocked(scriptApi.list).mockResolvedValue({ data: [script], meta: { current_page: 1, last_page: 2, total: 21 } }); open('/projects/1')
  await screen.findByRole('link', { name: 'Video #001' }); await browser.click(screen.getByRole('button', { name: '次へ' })); await waitFor(() => expect(scriptApi.list).toHaveBeenLastCalledWith('1', 2))
})
