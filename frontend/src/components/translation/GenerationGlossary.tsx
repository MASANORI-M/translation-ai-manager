import type { AiGeneration } from '../../api/ai/aiApi'

export function GenerationGlossary({ generation }: { generation: AiGeneration }) {
  const glossary = generation.glossary_snapshot
  return <details className="mt-2 text-xs text-slate-500"><summary>使用したGlossary</summary>
    {glossary == null ? <p className="mt-2">この履歴には用語集の記録がありません。</p> : glossary.length === 0 ? <p className="mt-2">一致する用語はありませんでした。</p> : <ul className="mt-2 space-y-2">{glossary.map((term) => <li key={term.id} className="whitespace-pre-wrap break-words"><span>{term.source_term} → {term.target_term}</span>{term.note && <p className="mt-1">Note: {term.note}</p>}</li>)}</ul>}
  </details>
}
