import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../lib/api'
import { AuthProvider } from '../auth/AuthProvider'
import { authApi } from '../auth/authApi'
import { projectApi } from '../projects/projectApi'
import type { Project } from '../projects/types'
import { scriptApi, type Script } from '../scripts/scriptApi'
import { segmentApi, type Segment } from './segmentApi'

vi.mock('../auth/authApi', () => ({ authApi: { currentUser: vi.fn(), logout: vi.fn() } }))
vi.mock('../projects/projectApi', () => ({ projectApi: { get: vi.fn() } }))
vi.mock('../scripts/scriptApi', async (original) => ({ ...await original<typeof import('../scripts/scriptApi')>(), scriptApi: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('./segmentApi', async (original) => ({ ...await original<typeof import('./segmentApi')>(), segmentApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
const project: Project = { id: 1, user_id: 1, name: 'Video Project', client_name: null, description: null, translation_style: null, translation_rules: null, rate_type: 'per_100_words', rate: '1.800000', currency: 'USD', status: 'active', created_at: '', updated_at: '' }
const script: Script = { id: 2, project_id: 1, title: 'Video #001', word_count: 12, deadline: '2026-10-10', status: 'in_progress', started_at: null, completed_at: null, rate_type: 'per_100_words', rate: '1.800000', currency: 'USD', estimated_payment: '0.22', progress: { completed: 0, total: 2 } }
const first: Segment = { id: 3, script_id: 2, sequence: 1, timecode_start: '00:26:58', timecode_end: '00:27:06', emotion: 'Excited', source_text: 'Hello world!', ai_translation: null, final_translation: null, memo: null, status: 'pending', source_version: 1, final_source_version: null, version: 1, created_at: '', updated_at: '' }
const second: Segment = { ...first, id: 4, sequence: 2, source_text: 'Goodbye world!' }
function Location() { return <span data-testid="location">{useLocation().pathname}</span> }
function open(path: string) { render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /><Location /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  vi.mocked(authApi.currentUser).mockResolvedValue({ id: 1, email: 'test@example.com', created_at: '', updated_at: '' })
  vi.mocked(projectApi.get).mockResolvedValue(project)
  vi.mocked(scriptApi.get).mockResolvedValue(script)
  vi.mocked(segmentApi.get).mockResolvedValue(first)
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [first, second], meta: { current_page: 1, last_page: 1, total: 2 } })
  vi.mocked(segmentApi.update).mockImplementation(async (_project, _script, _segment, values) => ({ ...first, ...values, version: values.version + 1, final_source_version: values.final_translation ? 1 : null }))
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
it.each(['/projects/1/scripts/2/editor', '/projects/1/scripts/2/segments/new', '/projects/1/scripts/2/segments/3/edit'])('protects %s for guests', async (path) => {
  vi.mocked(authApi.currentUser).mockResolvedValue(null); open(path)
  expect(await screen.findByRole('heading', { name: 'ログイン' })).toBeInTheDocument(); expect(segmentApi.list).not.toHaveBeenCalled()
})
it('shows multiple ordered segments, metadata, progress and translation panes', async () => {
  open('/projects/1/scripts/2/editor')
  expect(await screen.findByRole('heading', { name: 'Video #001' })).toBeInTheDocument()
  expect(screen.getByText('Video Project')).toBeInTheDocument()
  expect(screen.getByText('0 / 2件 · 0%')).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: 'セグメント 1' })).getByText('00:26:58 → 00:27:06')).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: 'セグメント 1' })).getByText('Hello world!')).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: 'セグメント 2' })).getByText('Goodbye world!')).toBeInTheDocument()
})
it('saves one translation without changing the other segment', async () => {
  const user = userEvent.setup(); open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('日本語訳'), 'こんにちは')
  expect(within(card).getByText('未保存の変更')).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: '保存' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ final_translation: 'こんにちは', status: 'editing', version: 1 })))
  expect(await within(card).findByText('保存しました。')).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: 'セグメント 2' })).getByLabelText('日本語訳')).toHaveValue('')
})
it('completes and reopens a segment, updating progress', async () => {
  const user = userEvent.setup(); vi.mocked(scriptApi.get).mockResolvedValueOnce(script).mockResolvedValue({ ...script, progress: { completed: 1, total: 2 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '完了にする' }))
  expect(await within(card).findByRole('alert')).toHaveTextContent('完了には最終訳が必要です。')
  await user.type(within(card).getByLabelText('日本語訳'), 'こんにちは')
  await user.click(within(card).getByRole('button', { name: '完了にする' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ status: 'completed' })))
  expect(await screen.findByText('1 / 2件 · 50%')).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: '再開' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenLastCalledWith('1', '2', '3', expect.objectContaining({ status: 'editing', version: 2 })))
})
it('keeps draft text visible after a save error', async () => {
  const user = userEvent.setup(); vi.mocked(segmentApi.update).mockRejectedValue(new ApiError(422, '入力内容を確認してください。', { version: ['競合しました。'] }))
  open('/projects/1/scripts/2/editor'); const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('日本語訳'), '未保存の訳')
  await user.click(within(card).getByRole('button', { name: '保存' }))
  expect(await within(card).findByRole('alert')).toHaveTextContent('競合しました。')
  expect(within(card).getByLabelText('日本語訳')).toHaveValue('未保存の訳')
})
it('creates a segment with source fields only', async () => {
  const user = userEvent.setup(); vi.mocked(segmentApi.create).mockResolvedValue(first)
  open('/projects/1/scripts/2/segments/new')
  await user.type(await screen.findByLabelText('英語原文（必須）'), 'Hello world!')
  await user.type(screen.getByLabelText('開始タイムコード'), '00:26:58')
  await user.type(screen.getByLabelText('終了タイムコード'), '00:27:06')
  await user.click(screen.getByRole('button', { name: '保存する' }))
  await waitFor(() => expect(segmentApi.create).toHaveBeenCalledWith('1', '2', expect.objectContaining({ sequence: 3, source_text: 'Hello world!', timecode_start: '00:26:58', timecode_end: '00:27:06' })))
  expect(await screen.findByTestId('location')).toHaveTextContent('/projects/1/scripts/2')
})
it('edits source with version', async () => {
  const user = userEvent.setup(); vi.mocked(segmentApi.update).mockResolvedValue(first); vi.mocked(segmentApi.delete).mockResolvedValue(undefined)
  open('/projects/1/scripts/2/segments/3/edit')
  await user.clear(await screen.findByLabelText('英語原文（必須）')); await user.type(screen.getByLabelText('英語原文（必須）'), 'Updated source')
  await user.click(screen.getByRole('button', { name: '保存する' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ source_text: 'Updated source', version: 1 })))
})

it('requires confirmation before deleting a segment', async () => {
  const user = userEvent.setup(); vi.mocked(segmentApi.delete).mockResolvedValue(undefined)
  open('/projects/1/scripts/2/segments/3/edit')
  await screen.findByLabelText('英語原文（必須）')
  await user.click(screen.getByRole('button', { name: '削除' }))
  expect(segmentApi.delete).not.toHaveBeenCalled()
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'キャンセル' }))
  expect(segmentApi.delete).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '削除' }))
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '削除する' }))
  await waitFor(() => expect(segmentApi.delete).toHaveBeenCalledWith('1', '2', '3'))
})
it('warns before leaving with an unsaved translation', async () => {
  const user = userEvent.setup(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('日本語訳'), '未保存')
  await user.click(screen.getByRole('link', { name: '← スクリプト詳細' }))
  expect(confirm).toHaveBeenCalled()
  expect(screen.getByTestId('location')).toHaveTextContent('/projects/1/scripts/2/editor')
})
