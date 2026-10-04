import type { AiGeneration } from '../../api/ai/aiApi'

export function GenerationSegmentContext({ generation }: { generation: AiGeneration }) {
  const context = generation.segment_context_snapshot
  return <details className="mt-2 text-xs text-slate-500"><summary>使用したSegment Context</summary>
    {context == null ? <><p className="mt-2">この履歴にはSegment Contextの記録がありません。</p><dl className="mt-2"><dt className="font-medium">Current Segment（生成時の原文）</dt><dd className="mt-1 whitespace-pre-wrap break-words">{generation.source_text_snapshot}</dd></dl></> : <><dl className="mt-2 space-y-3">{(['previous', 'current', 'next'] as const).map((role) => {
      const segment = context[role]
      return <div key={role}><dt className="font-medium">{{ previous: 'Previous Segment（参考）', current: 'Current Segment（翻訳対象）', next: 'Next Segment（参考）' }[role]}{segment && ` · Sequence ${segment.sequence}`}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{segment?.source_text ?? 'なし'}</dd></div>
    })}</dl>
      <p className="mt-3 font-medium">Recent Final Translation（文体・表現の参考）</p>
      {context.recent_final_translations == null ? <p className="mt-1">この履歴には確定訳の参照記録がありません。</p>
        : context.recent_final_translations.length === 0 ? <p className="mt-1">参照した確定訳はありません。</p>
          : <div className="mt-2 space-y-3">{context.recent_final_translations.map((reference) => <div key={reference.id}>
            <p className="font-medium">Segment #{reference.id} · Sequence {reference.sequence}</p>
            <dl className="mt-1 space-y-1">
              <div><dt>原文（参考）</dt><dd className="whitespace-pre-wrap break-words">{reference.source_text}</dd></div>
              <div><dt>確定訳（参考）</dt><dd className="whitespace-pre-wrap break-words">{reference.final_translation}</dd></div>
            </dl>
          </div>)}</div>}
    </>}
  </details>
}
