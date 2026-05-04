import ReactMarkdown from 'react-markdown'
import changelogText from '../../CHANGELOG.md?raw'
import { useUiStore } from '../store/useUiStore'

export function ChangelogPage() {
  const setPage = useUiStore((s) => s.setPage)
  return (
    <div className="flex-1 min-h-0 overflow-auto bg-[var(--c-bg-2)]">
      <div className="max-w-3xl mx-auto px-8 py-8">
        <button
          onClick={() => setPage('main')}
          className="text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] mb-6"
        >
          ← Back
        </button>
        <article className="prose-changelog">
          <ReactMarkdown>{changelogText}</ReactMarkdown>
        </article>
      </div>
    </div>
  )
}
