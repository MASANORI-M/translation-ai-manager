import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../../App'
import { ApiError } from '../../api/client'
import { AuthProvider } from '../../contexts/auth/AuthProvider'
import { authApi } from '../../api/auth/authApi'
import { projectApi } from '../../api/projects/projectApi'
import type { Project } from '../../types/projects'
import { scriptApi, type Script } from '../../api/scripts/scriptApi'
import { aiApi, type AiGeneration } from '../../api/ai/aiApi'
import { segmentApi, type Segment } from '../../api/segments/segmentApi'

vi.mock('../../api/ai/aiApi', () => ({ aiApi: { models: vi.fn(), generate: vi.fn(), history: vi.fn(), select: vi.fn() } }))
vi.mock('../../api/auth/authApi', () => ({ authApi: { currentUser: vi.fn(), logout: vi.fn() } }))
vi.mock('../../api/projects/projectApi', () => ({ projectApi: { get: vi.fn() } }))
vi.mock('../../api/scripts/scriptApi', async (original) => ({ ...await original<typeof import('../../api/scripts/scriptApi')>(), scriptApi: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('../../api/segments/segmentApi', async (original) => ({ ...await original<typeof import('../../api/segments/segmentApi')>(), segmentApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
const project: Project = { id: 1, user_id: 1, name: 'Video Project', client_name: null, description: null, translation_style: null, translation_rules: null, rate_type: 'per_100_words', rate: '1.800000', currency: 'USD', usd_jpy_rate: null, status: 'active', created_at: '', updated_at: '' }
const script: Script = { id: 2, project_id: 1, title: 'Video #001', word_count: 12, deadline: '2026-10-10', status: 'in_progress', started_at: null, completed_at: null, rate_type: 'per_100_words', rate: '1.800000', currency: 'USD', estimated_payment: '0.22', progress: { completed: 0, total: 2 } }
const first: Segment = { id: 3, script_id: 2, sequence: 1, timecode_start: '00:26:58', timecode_end: '00:27:06', emotion: 'Excited', source_text: 'Hello world!', ai_translation: null, ai_generation_id: null, ai_source_version: null, final_translation: null, memo: null, status: 'pending', source_version: 1, final_source_version: null, version: 1, created_at: '', updated_at: '' }
const second: Segment = { ...first, id: 4, sequence: 2, source_text: 'Goodbye world!' }
function Location() { return <span data-testid="location">{useLocation().pathname}</span> }
function open(path: string) { render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /><Location /></AuthProvider></MemoryRouter>) }
beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  vi.mocked(aiApi.models).mockResolvedValue({ models: [{ id: 'test-model', name: 'Test Model' }], default_model: 'test-model' })
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
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), 'こんにちは')
  expect(within(card).getByText('未保存の変更')).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: '保存' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ final_translation: 'こんにちは', status: 'editing', version: 1 })))
  expect(await within(card).findByText('保存しました。')).toBeInTheDocument()
  expect(within(screen.getByRole('article', { name: 'セグメント 2' })).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('')
})
it('completes and reopens a segment, updating progress', async () => {
  const user = userEvent.setup(); vi.mocked(scriptApi.get).mockResolvedValueOnce(script).mockResolvedValue({ ...script, progress: { completed: 1, total: 2 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '完了にする' }))
  expect(await within(card).findByRole('alert')).toHaveTextContent('完了には最終訳が必要です。')
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), 'こんにちは')
  await user.click(within(card).getByRole('button', { name: '完了にする' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ status: 'completed' })))
  expect(await screen.findByText('1 / 2件 · 50%')).toBeInTheDocument()
  await user.click(within(card).getByRole('button', { name: '再開' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenLastCalledWith('1', '2', '3', expect.objectContaining({ status: 'editing', version: 2 })))
})
it('keeps draft text visible after a save error', async () => {
  const user = userEvent.setup(); vi.mocked(segmentApi.update).mockRejectedValue(new ApiError(422, '入力内容を確認してください。', { version: ['競合しました。'] }))
  open('/projects/1/scripts/2/editor'); const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), '未保存の訳')
  await user.click(within(card).getByRole('button', { name: '保存' }))
  expect(await within(card).findByRole('alert')).toHaveTextContent('競合しました。')
  expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('未保存の訳')
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
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), '未保存')
  await user.click(screen.getByRole('link', { name: '← スクリプト詳細' }))
  expect(confirm).toHaveBeenCalled()
  expect(screen.getByTestId('location')).toHaveTextContent('/projects/1/scripts/2/editor')
})

const generation: AiGeneration = { id: 7, segment_id: 3, model: 'test-model', model_name: 'Test Model', resolved_model: 'test-model', instruction: 'Localize into Japanese.', output: 'AIの候補です。', source_text_snapshot: 'Original generated English.', source_version_snapshot: 1, glossary_snapshot: [{ id: 5, source_term: 'Totem of Undying', target_term: '不死のトーテム', note: '生成時の用語' }], input_tokens: 100, output_tokens: 20, total_tokens: 120, cached_input_tokens: 0, cache_write_tokens: 0, input_cost: '0.00001', output_cost: '0.00002', total_cost: '0.00003', cost_status: 'calculated', selected: false, created_at: '2026-10-04T00:00:00Z' }

it('generates an AI candidate without replacing unsaved final translation or memo', async () => {
  const user = userEvent.setup()
  vi.mocked(aiApi.generate).mockResolvedValue({ translation: generation.output, generation, segment: { ...first, ai_translation: generation.output, ai_generation_id: generation.id, ai_source_version: 1, version: 2 }, applied: true })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), '未保存の人間の訳')
  await user.type(within(card).getByLabelText('メモ'), '未保存のメモ')
  await user.click(within(card).getByRole('button', { name: 'AI翻訳' }))
  expect(await within(card).findByText(generation.output)).toBeInTheDocument()
  expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('未保存の人間の訳')
  expect(within(card).getByLabelText('メモ')).toHaveValue('未保存のメモ')
  expect(aiApi.generate).toHaveBeenCalledWith('1', '2', 3, 'test-model', 1)
  expect(segmentApi.update).not.toHaveBeenCalled()
  await user.click(within(card).getByRole('button', { name: '保存' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ version: 2, final_translation: '未保存の人間の訳', memo: '未保存のメモ', status: 'editing' })))
})

it('prevents duplicate generation and saves while generating', async () => {
  const user = userEvent.setup()
  let resolve!: (result: Awaited<ReturnType<typeof aiApi.generate>>) => void
  vi.mocked(aiApi.generate).mockReturnValue(new Promise((done) => { resolve = done }))
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: 'AI翻訳' }))
  expect(within(card).getByRole('button', { name: '生成中…' })).toBeDisabled()
  expect(within(card).getByRole('button', { name: '保存' })).toBeDisabled()
  await user.click(within(card).getByRole('button', { name: '生成中…' }))
  expect(aiApi.generate).toHaveBeenCalledTimes(1)
  resolve({ translation: generation.output, generation, segment: { ...first, ai_translation: generation.output, ai_generation_id: 7, ai_source_version: 1, version: 2 }, applied: true })
  await waitFor(() => expect(within(card).getByRole('button', { name: 'AI翻訳' })).toBeEnabled())
})

it('shows a safe AI error and keeps the final draft after failure', async () => {
  const user = userEvent.setup()
  vi.mocked(aiApi.generate).mockRejectedValue(new ApiError(422, '入力内容を確認してください。', { ai_translation: ['AIの利用上限に達しました。'] }))
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), '人間の訳')
  await user.click(within(card).getByRole('button', { name: 'AI翻訳' }))
  expect(await within(card).findByRole('alert')).toHaveTextContent('AIの利用上限に達しました。')
  expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('人間の訳')
  expect(within(card).getByRole('button', { name: 'AI翻訳' })).toBeEnabled()
  expect(segmentApi.update).not.toHaveBeenCalled()
})

it('adopts the AI candidate explicitly without completing and keeps unsaved memo', async () => {
  const user = userEvent.setup()
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [{ ...first, ai_translation: generation.output, ai_generation_id: 7, ai_source_version: 1 }], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.select).mockResolvedValue({ ...first, ai_translation: generation.output, ai_generation_id: 7, ai_source_version: 1, final_translation: generation.output, final_source_version: 1, status: 'editing', version: 2 })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('メモ'), '作業中のメモ')
  await user.click(within(card).getByRole('button', { name: 'この翻訳を使う' }))
  await waitFor(() => expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue(generation.output))
  expect(within(card).getByLabelText('メモ')).toHaveValue('作業中のメモ')
  expect(within(card).getByRole('button', { name: '完了にする' })).toBeInTheDocument()
  expect(aiApi.select).toHaveBeenCalledWith('1', '2', 3, 7, 1)
  expect(segmentApi.update).not.toHaveBeenCalled()
})

it('loads history on demand and allows adoption of a past candidate', async () => {
  const user = userEvent.setup()
  vi.mocked(aiApi.history).mockResolvedValue({ data: [generation], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.select).mockResolvedValue({ ...first, final_translation: generation.output, final_source_version: 1, status: 'editing', version: 2 })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  expect(aiApi.history).not.toHaveBeenCalled()
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  expect(await within(card).findByText('Generation #7 · Test Model')).toBeInTheDocument()
  expect(within(card).getByText(/0.00003 USD/)).toBeInTheDocument()
  await user.click(within(card).getByText('使用したGlossary'))
  expect(within(card).getByText('Totem of Undying → 不死のトーテム')).toBeVisible()
  expect(within(card).getByText('Note: 生成時の用語')).toBeVisible()
  await user.click(within(card).getByRole('button', { name: 'この候補を採用' }))
  await waitFor(() => expect(aiApi.select).toHaveBeenCalledWith('1', '2', 3, 7, 1))
})

it.each([
  { snapshot: null, message: 'この履歴には用語集の記録がありません。' },
  { snapshot: [], message: '一致する用語はありませんでした。' },
])('displays glossary history with $message', async ({ snapshot, message }) => {
  const user = userEvent.setup()
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, glossary_snapshot: snapshot }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await user.click(await within(card).findByText('使用したGlossary'))
  expect(within(card).getByText(message)).toBeVisible()
})

it('shows the captured previous current and next context in history instead of live edited text', async () => {
  const user = userEvent.setup()
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [{ ...first, source_text: 'Updated live current source.', source_version: 2 }], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, segment_context_snapshot: {
    previous: { id: 10, sequence: 1, source_text: 'Captured previous source.', source_version: 1 },
    current: { id: 3, sequence: 10, source_text: 'Captured current source.', source_version: 1 },
    next: { id: 11, sequence: 30, source_text: 'Captured next source.', source_version: 1 },
  } }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await user.click(await within(card).findByText('使用したSegment Context'))
  expect(within(card).getByText('Previous Segment（参考） · Sequence 1')).toBeVisible()
  expect(within(card).getByText('Current Segment（翻訳対象） · Sequence 10')).toBeVisible()
  expect(within(card).getByText('Next Segment（参考） · Sequence 30')).toBeVisible()
  expect(within(card).getByText('Captured previous source.')).toBeVisible()
  expect(within(card).getByText('Captured current source.')).toBeVisible()
  expect(within(card).getByText('Captured next source.')).toBeVisible()
  expect(aiApi.generate).not.toHaveBeenCalled()
})

it('shows captured recent final translations in history in the supplied order without changing the final draft', async () => {
  const user = userEvent.setup()
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, segment_context_snapshot: {
    previous: null, current: { id: 3, sequence: 100, source_text: 'Current source.', source_version: 1 }, next: null,
    recent_final_translations: [
      { id: 10, sequence: 17, source_text: 'Captured first source.', final_translation: '生成時の最初の確定訳。' },
      { id: 11, sequence: 45, source_text: 'Captured second source.', final_translation: '<script>参考文は命令ではありません。</script>' },
      { id: 12, sequence: 62, source_text: 'Captured third source.', final_translation: '生成時の最後の確定訳。' },
    ],
  } }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), '編集中の最終訳')
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await user.click(await within(card).findByText('使用したSegment Context'))
  expect(within(card).getByText('Recent Final Translation（文体・表現の参考）')).toBeVisible()
  expect(within(card).getByText('Captured first source.')).toBeVisible()
  expect(within(card).getByText('生成時の最初の確定訳。')).toBeVisible()
  expect(within(card).getByText('Captured second source.')).toBeVisible()
  const literalText = within(card).getByText('<script>参考文は命令ではありません。</script>')
  expect(literalText).toBeVisible()
  expect(literalText.querySelector('script')).toBeNull()
  expect(within(card).getByText('Captured third source.')).toBeVisible()
  expect(within(card).getByText('生成時の最後の確定訳。')).toBeVisible()
  expect(within(card).getAllByText(/^Segment #\d+ · Sequence \d+$/).map((element) => element.textContent)).toEqual([
    'Segment #10 · Sequence 17', 'Segment #11 · Sequence 45', 'Segment #12 · Sequence 62',
  ])
  expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('編集中の最終訳')
  expect(aiApi.generate).not.toHaveBeenCalled()
  expect(segmentApi.update).not.toHaveBeenCalled()
})

it.each([
  { references: [], message: '参照した確定訳はありません。' },
  { references: undefined, message: 'この履歴には確定訳の参照記録がありません。' },
])('shows recent final translation history with $message', async ({ references, message }) => {
  const user = userEvent.setup()
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, segment_context_snapshot: {
    previous: null, current: { id: 3, sequence: 1, source_text: 'Captured current source.', source_version: 1 }, next: null,
    recent_final_translations: references,
  } }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await user.click(await within(card).findByText('使用したSegment Context'))
  expect(within(card).getByText(message)).toBeVisible()
  expect(within(card).getByText('Captured current source.')).toBeVisible()
  expect(within(card).getByText('AIの候補です。')).toBeInTheDocument()
  expect(aiApi.generate).not.toHaveBeenCalled()
})

it('shows absent previous and next context for a single segment', async () => {
  const user = userEvent.setup()
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, segment_context_snapshot: {
    previous: null, current: { id: 3, sequence: 1, source_text: 'Single segment source.', source_version: 1 }, next: null,
  } }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await user.click(await within(card).findByText('使用したSegment Context'))
  expect(within(card).getAllByText('なし')).toHaveLength(2)
  expect(within(card).getByText('Single segment source.')).toBeVisible()
})

it.each([null, undefined])('keeps old history without a context snapshot readable (%s)', async (snapshot) => {
  const user = userEvent.setup()
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, segment_context_snapshot: snapshot }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await user.click(await within(card).findByText('使用したSegment Context'))
  expect(within(card).getByText('この履歴にはSegment Contextの記録がありません。')).toBeVisible()
  expect(within(card).getByText('AIの候補です。')).toBeInTheDocument()
})

it('disables adoption of AI suggestions created before a source change', async () => {
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [{ ...first, source_version: 2, ai_translation: generation.output, ai_generation_id: 7, ai_source_version: 1 }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  expect(within(card).getByRole('button', { name: 'この翻訳を使う' })).toBeDisabled()
})

it('shows the saved current candidate model date selection and cost after reload without loading history', async () => {
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [{ ...first, ai_translation: generation.output, ai_generation_id: 7, ai_source_version: 1, ai_generation: { ...generation, selected: true } }], meta: { current_page: 1, last_page: 1, total: 1 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  expect(within(card).getByText(`Generation #7 · Test Model · ${new Date(generation.created_at).toLocaleString('ja-JP')}`)).toBeInTheDocument()
  expect(within(card).getByText('採用元')).toBeInTheDocument()
  expect(within(card).getByText(/120 tokens · \$0.00003 USD/)).toBeInTheDocument()
  expect(aiApi.history).not.toHaveBeenCalled()
  expect(aiApi.generate).not.toHaveBeenCalled()
})

it('supports generating twice adopting an older candidate manually saving and regenerating without losing the final draft', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const regenerated: AiGeneration = { ...generation, id: 8, output: '再生成した候補。' }
  const newest: AiGeneration = { ...generation, id: 9, output: '手動編集後の候補。' }
  const adopted: Segment = { ...first, ai_translation: regenerated.output, ai_generation_id: 8, ai_source_version: 1, ai_generation: regenerated, final_translation: generation.output, final_source_version: 1, status: 'editing', version: 4 }
  vi.mocked(aiApi.generate)
    .mockResolvedValueOnce({ translation: generation.output, generation, segment: { ...first, ai_translation: generation.output, ai_generation_id: 7, ai_source_version: 1, ai_generation: generation, version: 2 }, applied: true })
    .mockResolvedValueOnce({ translation: regenerated.output, generation: regenerated, segment: { ...first, ai_translation: regenerated.output, ai_generation_id: 8, ai_source_version: 1, ai_generation: regenerated, version: 3 }, applied: true })
    .mockResolvedValueOnce({ translation: newest.output, generation: newest, segment: { ...adopted, final_translation: '採用後の手動修正', ai_translation: newest.output, ai_generation_id: 9, ai_generation: newest, version: 6 }, applied: true })
  vi.mocked(aiApi.history)
    .mockResolvedValueOnce({ data: [regenerated, generation], meta: { current_page: 1, last_page: 1, total: 2 } })
    .mockResolvedValueOnce({ data: [regenerated, { ...generation, selected: true }], meta: { current_page: 1, last_page: 1, total: 2 } })
    .mockResolvedValueOnce({ data: [newest, regenerated, { ...generation, selected: true }], meta: { current_page: 1, last_page: 1, total: 3 } })
  vi.mocked(aiApi.select).mockResolvedValue(adopted)
  vi.mocked(segmentApi.update).mockImplementation(async (_project, _script, _segment, values) => ({ ...adopted, ...values, version: values.version + 1 }))
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  const finalText = within(card).getByLabelText('最終訳（人間が確認・編集）')
  await user.type(finalText, '人間の下書き')
  await user.click(within(card).getByRole('button', { name: 'AI翻訳' }))
  await waitFor(() => expect(within(card).getByRole('button', { name: 'AI翻訳' })).toBeEnabled())
  expect(finalText).toHaveValue('人間の下書き')
  await user.click(within(card).getByRole('button', { name: 'AI翻訳' }))
  await waitFor(() => expect(within(card).getByRole('button', { name: 'AI翻訳' })).toBeEnabled())
  expect(finalText).toHaveValue('人間の下書き')
  expect(aiApi.generate).toHaveBeenNthCalledWith(1, '1', '2', 3, 'test-model', 1)
  expect(aiApi.generate).toHaveBeenNthCalledWith(2, '1', '2', 3, 'test-model', 2)
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  const history = within(await within(card).findByLabelText('AI生成履歴'))
  const older = history.getByText('Generation #7 · Test Model').closest('article')!
  await user.click(within(older).getByRole('button', { name: 'この候補を採用' }))
  await waitFor(() => expect(finalText).toHaveValue(generation.output))
  expect(aiApi.select).toHaveBeenCalledWith('1', '2', 3, 7, 3)
  expect(within(older).getByText('採用元')).toBeInTheDocument()
  expect(history.getAllByText('採用元')).toHaveLength(1)
  await user.clear(finalText)
  await user.type(finalText, '採用後の手動修正')
  await user.click(within(card).getByRole('button', { name: '保存' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ final_translation: '採用後の手動修正', version: 4 })))
  await waitFor(() => expect(within(card).getByRole('button', { name: '保存' })).toBeEnabled())
  await user.click(within(card).getByRole('button', { name: 'AI翻訳' }))
  await waitFor(() => expect(within(card).getByRole('button', { name: 'AI翻訳' })).toBeEnabled())
  expect(aiApi.generate).toHaveBeenNthCalledWith(3, '1', '2', 3, 'test-model', 5)
  expect(finalText).toHaveValue('採用後の手動修正')
  expect(history.getByText('Generation #9 · Test Model')).toBeInTheDocument()
  expect(history.getByText('Generation #8 · Test Model')).toBeInTheDocument()
  expect(history.getByText(/Generation #7 · Test Model/)).toBeInTheDocument()
  expect(history.getAllByText('採用元')).toHaveLength(1)
})

it.each([true, false])('allows explicit readoption of selected history after manual editing with replacement confirmation (%s)', async (confirmed) => {
  const user = userEvent.setup()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(confirmed)
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [{ ...first, final_translation: '手動で修正した訳', final_source_version: 1, version: 3 }], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, selected: true }], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.select).mockResolvedValue({ ...first, final_translation: generation.output, final_source_version: 1, version: 4, status: 'editing' })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  const adopt = await within(card).findByRole('button', { name: 'この候補を採用' })
  expect(adopt).toBeEnabled()
  await user.click(adopt)
  expect(confirm).toHaveBeenCalledWith('現在の最終訳をこのAI候補で置き換えて保存しますか？')
  if (confirmed) {
    await waitFor(() => expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue(generation.output))
    expect(aiApi.select).toHaveBeenCalledWith('1', '2', 3, 7, 3)
    expect(adopt).toBeDisabled()
  } else {
    expect(aiApi.select).not.toHaveBeenCalled()
    expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('手動で修正した訳')
  }
  expect(segmentApi.update).not.toHaveBeenCalled()
  expect(aiApi.generate).not.toHaveBeenCalled()
})

it('allows readopting a selected candidate after an unsaved manual edit', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [{ ...first, final_translation: generation.output, final_source_version: 1 }], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.history).mockResolvedValue({ data: [{ ...generation, selected: true }], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.select).mockResolvedValue({ ...first, final_translation: generation.output, final_source_version: 1, version: 2, status: 'editing' })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  const adopt = await within(card).findByRole('button', { name: 'この候補を採用' })
  expect(adopt).toBeDisabled()
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), '未保存の追記')
  expect(adopt).toBeEnabled()
  await user.click(adopt)
  await waitFor(() => expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue(generation.output))
  expect(aiApi.select).toHaveBeenCalledWith('1', '2', 3, 7, 1)
})

it('keeps the draft and adoption state after a stale version adoption error', async () => {
  const user = userEvent.setup()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(aiApi.history).mockResolvedValue({ data: [generation], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.select).mockRejectedValue(new ApiError(422, '競合', { version: ['再読み込みして確認してください。'] }))
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), '保持する下書き')
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await user.click(await within(card).findByRole('button', { name: 'この候補を採用' }))
  expect(await within(card).findByRole('alert')).toHaveTextContent('再読み込みして確認してください。')
  expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('保持する下書き')
  expect(within(card).queryByText('採用元')).not.toBeInTheDocument()
  expect(segmentApi.update).not.toHaveBeenCalled()
})

it('shows saved source snapshots and versions and prevents adopting all history after source changes', async () => {
  const user = userEvent.setup()
  vi.mocked(segmentApi.list).mockResolvedValue({ data: [{ ...first, source_text: 'Revised live English.', source_version: 2 }], meta: { current_page: 1, last_page: 1, total: 1 } })
  vi.mocked(aiApi.history).mockResolvedValue({ data: [generation, { ...generation, id: 6, output: '以前の候補。' }], meta: { current_page: 1, last_page: 1, total: 2 } })
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.click(within(card).getByRole('button', { name: '履歴' }))
  await within(card).findByText('Generation #7 · Test Model')
  expect(within(card).getAllByText('Source version 1 / 現在 2')).toHaveLength(2)
  expect(within(card).getAllByText('原文・演出変更前の候補')).toHaveLength(2)
  expect(within(card).queryByRole('button', { name: 'この候補を採用' })).not.toBeInTheDocument()
  await user.click(within(card).getAllByText('使用したSegment Context')[0])
  expect(within(card).getAllByText('Original generated English.')[0]).toBeVisible()
  expect(within(card).getByText('Revised live English.')).toBeInTheDocument()
  expect(aiApi.select).not.toHaveBeenCalled()
  expect(aiApi.generate).not.toHaveBeenCalled()
})

it('does not silently accept a newer version when another editor saved during generation', async () => {
  const user = userEvent.setup()
  vi.mocked(aiApi.generate).mockResolvedValue({ translation: generation.output, generation, segment: { ...first, ai_translation: generation.output, ai_generation_id: 7, ai_source_version: 1, version: 3, final_translation: '別画面で保存された訳' }, applied: true })
  vi.mocked(segmentApi.update).mockRejectedValue(new ApiError(422, '競合', { version: ['再読み込みして確認してください。'] }))
  open('/projects/1/scripts/2/editor')
  const card = await screen.findByRole('article', { name: 'セグメント 1' })
  await user.type(within(card).getByLabelText('最終訳（人間が確認・編集）'), 'この画面の下書き')
  await user.click(within(card).getByRole('button', { name: 'AI翻訳' }))
  expect(await within(card).findByText(/生成中に別の操作でSegmentが変更/)).toBeInTheDocument()
  expect(within(card).getByLabelText('最終訳（人間が確認・編集）')).toHaveValue('この画面の下書き')
  await user.click(within(card).getByRole('button', { name: '保存' }))
  await waitFor(() => expect(segmentApi.update).toHaveBeenCalledWith('1', '2', '3', expect.objectContaining({ version: 1, final_translation: 'この画面の下書き' })))
  expect(await within(card).findByRole('alert')).toHaveTextContent('再読み込みして確認してください。')
})
