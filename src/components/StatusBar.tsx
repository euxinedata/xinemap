import { useEditorStore } from '../store/useEditorStore'

export function StatusBar() {
  const parseErrors = useEditorStore((s) => s.parseErrors)
  const parseResult = useEditorStore((s) => s.parseResult)
  const validationResult = useEditorStore((s) => s.validationResult)

  const stats = validationResult?.stats
  const issues = validationResult?.issues ?? []
  const hasErrors = issues.some((i) => i.severity === 'error')
  const hasWarnings = issues.some((i) => i.severity === 'warning')

  const dotColor = hasErrors ? 'bg-red-400' : hasWarnings ? 'bg-amber-400' : 'bg-green-500'

  const dbType = parseResult?.projectMeta?.databaseType

  return (
    <div className="h-6 bg-[var(--c-bg-1)] border-t border-[var(--c-border)] flex items-center px-4 shrink-0 text-xs">
      {parseErrors.length > 0 ? (
        <span className="text-red-400 truncate">{parseErrors[0]}</span>
      ) : parseResult ? (
        <span className="text-[var(--c-text-4)]">
          {parseResult.tables.length} tables, {parseResult.refs.length} refs, {parseResult.enums.length} enums
        </span>
      ) : (
        <span className="text-[var(--c-text-4)]">Ready</span>
      )}
      {stats && (
        <span className="ml-auto flex items-center gap-2 text-[11px] text-[var(--c-text-4)]">
          {dbType && <span>{dbType}</span>}
          {dbType && <span className="text-[var(--c-text-5)]">|</span>}
          <span>{stats.hubCount}H / {stats.linkCount}L / {stats.satelliteCount}S</span>
          <span className="text-[var(--c-text-5)]">|</span>
          <span>{stats.totalColumns} cols</span>
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        </span>
      )}
    </div>
  )
}
