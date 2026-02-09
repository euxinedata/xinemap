import { useEditorStore } from '../store/useEditorStore'

export function StatusBar() {
  const parseErrors = useEditorStore((s) => s.parseErrors)
  const parseResult = useEditorStore((s) => s.parseResult)

  return (
    <div className="h-6 bg-gray-900 border-t border-gray-700 flex items-center px-4 shrink-0 text-xs">
      {parseErrors.length > 0 ? (
        <span className="text-red-400 truncate">{parseErrors[0]}</span>
      ) : parseResult ? (
        <span className="text-gray-500">
          {parseResult.tables.length} tables, {parseResult.refs.length} refs, {parseResult.enums.length} enums
        </span>
      ) : (
        <span className="text-gray-600">Ready</span>
      )}
    </div>
  )
}
