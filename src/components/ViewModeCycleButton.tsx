import { useDiagramStore, type ViewMode } from '../store/useDiagramStore'

const ORDER: ViewMode[] = ['relational', 'conceptual', 'tabular']

const LABEL: Record<ViewMode, string> = {
  relational: 'Relational',
  conceptual: 'Conceptual',
  tabular: 'Tabular',
}

function Icon({ mode }: { mode: ViewMode }) {
  if (mode === 'relational') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="1" width="5" height="3" rx="0.5" />
        <rect x="8" y="1" width="5" height="3" rx="0.5" />
        <rect x="1" y="6" width="5" height="3" rx="0.5" />
        <rect x="8" y="10" width="5" height="3" rx="0.5" />
        <line x1="6" y1="2.5" x2="8" y2="2.5" />
        <line x1="3.5" y1="4" x2="3.5" y2="6" />
        <line x1="6" y1="7.5" x2="8" y2="12" />
      </svg>
    )
  }
  if (mode === 'conceptual') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="4" r="2.5" />
        <rect x="1" y="9" width="4" height="2.5" rx="0.5" />
        <rect x="9" y="9" width="4" height="2.5" rx="0.5" />
        <line x1="5.5" y1="6" x2="3" y2="9" />
        <line x1="8.5" y1="6" x2="11" y2="9" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="11" height="11" rx="0.5" />
      <line x1="1.5" y1="5" x2="12.5" y2="5" />
      <line x1="1.5" y1="8.5" x2="12.5" y2="8.5" />
      <line x1="5" y1="1.5" x2="5" y2="12.5" />
    </svg>
  )
}

export function ViewModeCycleButton() {
  const { viewMode, setViewMode } = useDiagramStore()
  const next = ORDER[(ORDER.indexOf(viewMode) + 1) % ORDER.length]
  return (
    <button
      onClick={() => setViewMode(next)}
      title={`Switch to ${LABEL[next]}`}
      className="flex items-center gap-1.5 bg-[var(--c-bg-3)] border border-[var(--c-border-s)] text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-xs px-2 py-1 rounded"
    >
      <Icon mode={viewMode} />
      {LABEL[viewMode]}
    </button>
  )
}
