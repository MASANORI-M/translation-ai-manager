import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../api/client'
import { AuthProvider } from '../../contexts/auth/AuthProvider'
import { authApi } from '../../api/auth/authApi'
import { scriptApi } from '../../api/scripts/scriptApi'
import { glossaryApi, type Glossary, type GlossaryList } from '../../api/glossary/glossaryApi'
import { projectApi } from '../../api/projects/projectApi'
import type { Project } from '../../types/projects'

vi.mock('../../api/auth/authApi', () => ({ authApi: { currentUser: vi.fn(), logout: vi.fn() } }))
vi.mock('../../api/projects/projectApi', () => ({ projectApi: { get: vi.fn() } }))
vi.mock('../../api/glossary/glossaryApi', () => ({ glossaryApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
vi.mock('../../api/scripts/scriptApi', async (original) => ({ ...await original<typeof import('../../api/scripts/scriptApi')>(), scriptApi: { list: vi.fn() } }))

const project: Project = { id: 1, user_id: 1, name: 'Video Project', client_name: null, description: null, translation_style: null, translation_rules: null, rate_type: 'fixed', rate: '0', currency: 'USD', usd_jpy_rate: null, status: 'active', created_at: '', updated_at: '' }
const term: Glossary = { id: 2, project_id: 1, source_term: 'Totem of Undying', target_term: '不死のトーテム', note: 'Minecraftのアイテム', created_at: '', updated_at: '' }
function list(data: Glossary[] = [term]): GlossaryList { return { data, meta: { current_page: 1, last_page: 1, total: data.length } } }
function open(path = '/projects/1/glossary') { return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(authApi.currentUser).mockResolvedValue({ id: 1, email: 'translator@example.com', created_at: '', updated_at: '' })
  vi.mocked(projectApi.get).mockResolvedValue(project)
  vi.mocked(glossaryApi.list).mockResolvedValue(list())
  vi.mocked(scriptApi.list).mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

describe('Project Glossary', () => {
  it('opens glossary management from project details and displays source target and note', async () => {
    const browser = userEvent.setup()
    open('/projects/1')
    await browser.click(await screen.findByRole('link', { name: 'Glossaryを管理' }))
    expect(await screen.findByRole('heading', { name: 'Project Glossary' })).toBeInTheDocument()
    expect(await screen.findByText('不死のトーテム')).toBeInTheDocument()
    expect(screen.getByText('Minecraftのアイテム')).toBeInTheDocument()
    expect(glossaryApi.list).toHaveBeenCalledWith('1', 1)
  })

  it('adds a name-preservation mapping and refreshes the list', async () => {
    const browser = userEvent.setup()
    const saved = { ...term, source_term: 'BABY BLOOP', target_term: 'BABY BLOOP', note: null }
    vi.mocked(glossaryApi.list).mockResolvedValueOnce(list([])).mockResolvedValue(list([saved]))
    vi.mocked(glossaryApi.create).mockResolvedValue(saved)
    open()
    await screen.findByText('用語はまだ登録されていません。')
    await browser.type(screen.getByLabelText('Source Term（必須）'), ' BABY BLOOP ')
    await browser.type(screen.getByLabelText('Target Term（必須）'), 'BABY BLOOP')
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByRole('button', { name: 'BABY BLOOPを編集' })).toBeInTheDocument()
    expect(glossaryApi.create).toHaveBeenCalledWith('1', { source_term: 'BABY BLOOP', target_term: 'BABY BLOOP', note: null })
    expect(screen.getByLabelText('Source Term（必須）')).toHaveValue('')
  })

  it('edits a term and cancels another edit without saving', async () => {
    const browser = userEvent.setup()
    vi.mocked(glossaryApi.update).mockResolvedValue({ ...term, target_term: '新しい訳' })
    open()
    await browser.click(await screen.findByRole('button', { name: 'Totem of Undyingを編集' }))
    expect(screen.getByLabelText('Note')).toHaveValue('Minecraftのアイテム')
    await browser.clear(screen.getByLabelText('Target Term（必須）'))
    await browser.type(screen.getByLabelText('Target Term（必須）'), '新しい訳')
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    await waitFor(() => expect(glossaryApi.update).toHaveBeenCalledWith('1', 2, { source_term: 'Totem of Undying', target_term: '新しい訳', note: 'Minecraftのアイテム' }))
    await browser.click(await screen.findByRole('button', { name: 'Totem of Undyingを編集' }))
    await browser.click(screen.getByRole('button', { name: '編集をキャンセル' }))
    expect(screen.getByLabelText('Source Term（必須）')).toHaveValue('')
    expect(glossaryApi.update).toHaveBeenCalledTimes(1)
  })

  it('preserves input and displays a duplicate-source validation error', async () => {
    const browser = userEvent.setup()
    vi.mocked(glossaryApi.create).mockRejectedValue(new ApiError(422, '入力内容を確認してください。', { source_term: ['同じSource Termが登録されています。'] }))
    open()
    await screen.findByText('不死のトーテム')
    await browser.type(screen.getByLabelText('Source Term（必須）'), 'Totem of Undying')
    await browser.type(screen.getByLabelText('Target Term（必須）'), '別の訳')
    await browser.click(screen.getByRole('button', { name: '保存する' }))
    expect(await screen.findByText('同じSource Termが登録されています。')).toBeInTheDocument()
    expect(screen.getByLabelText('Source Term（必須）')).toHaveValue('Totem of Undying')
    expect(screen.getByLabelText('Source Term（必須）')).toHaveAttribute('aria-invalid', 'true')
  })

  it('requires confirmation for deletion and supports cancellation', async () => {
    const browser = userEvent.setup()
    vi.mocked(glossaryApi.delete).mockResolvedValue(undefined)
    open()
    await browser.click(await screen.findByRole('button', { name: 'Totem of Undyingを削除' }))
    const confirmation = screen.getByRole('dialog', { name: 'Glossaryを削除しますか？' })
    await browser.click(within(confirmation).getByRole('button', { name: 'キャンセル' }))
    expect(glossaryApi.delete).not.toHaveBeenCalled()
    await browser.click(screen.getByRole('button', { name: 'Totem of Undyingを削除' }))
    vi.mocked(glossaryApi.list).mockResolvedValue(list([]))
    await browser.click(within(confirmation).getByRole('button', { name: '削除する' }))
    expect(await screen.findByText('用語はまだ登録されていません。')).toBeInTheDocument()
    expect(glossaryApi.delete).toHaveBeenCalledWith('1', 2)
  })

  it('keeps a failed deletion visible and leaves the term in the list', async () => {
    const browser = userEvent.setup()
    vi.mocked(glossaryApi.delete).mockRejectedValue(new ApiError(0, '接続できません。'))
    open()
    await browser.click(await screen.findByRole('button', { name: 'Totem of Undyingを削除' }))
    await browser.click(screen.getByRole('button', { name: '削除する' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('接続できません。')
    expect(screen.getByText('不死のトーテム')).toBeInTheDocument()
  })

  it('loads the next page and moves back after deleting its last term', async () => {
    const browser = userEvent.setup()
    vi.mocked(glossaryApi.list).mockResolvedValueOnce({ ...list(), meta: { current_page: 1, last_page: 2, total: 21 } })
      .mockResolvedValueOnce({ ...list(), meta: { current_page: 2, last_page: 2, total: 21 } }).mockResolvedValue(list())
    vi.mocked(glossaryApi.delete).mockResolvedValue(undefined)
    open()
    await screen.findByText('不死のトーテム')
    await browser.click(screen.getByRole('button', { name: '次へ' }))
    await screen.findByText('21件 / 2ページ')
    await browser.click(screen.getByRole('button', { name: 'Totem of Undyingを削除' }))
    await browser.click(screen.getByRole('button', { name: '削除する' }))
    await waitFor(() => expect(glossaryApi.list).toHaveBeenLastCalledWith('1', 1))
  })

  it('protects the glossary route for guests', async () => {
    vi.mocked(authApi.currentUser).mockResolvedValue(null)
    open()
    expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument()
    expect(glossaryApi.list).not.toHaveBeenCalled()
  })

  it('hides the list and form if project authorization fails', async () => {
    vi.mocked(projectApi.get).mockRejectedValue(new ApiError(403, 'この操作は現在許可されていません。'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('この操作は現在許可されていません。')
    expect(screen.queryByText('不死のトーテム')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存する' })).not.toBeInTheDocument()
  })
})
