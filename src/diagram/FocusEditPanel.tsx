import { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useEditorStore } from '../store/useEditorStore'
import { useThemeStore } from '../store/useThemeStore'
import { registerDbmlLanguage, DBML_LANGUAGE_ID } from '../editor/dbmlLanguage'
import { extractTableBlock, replaceTableInDbml } from '../editor/dbmlTableReplace'

interface FocusEditPanelProps {
  tableId: string
  onClose: () => void
}

export function FocusEditPanel({ tableId, onClose }: FocusEditPanelProps) {
  const dbml = useEditorStore((s) => s.dbml)
  const isDark = useThemeStore((s) => s.isDark)
  const [localText, setLocalText] = useState(() => extractTableBlock(dbml, tableId))

  const handleApply = useCallback(() => {
    const currentDbml = useEditorStore.getState().dbml
    const updated = replaceTableInDbml(currentDbml, tableId, localText)
    useEditorStore.getState().setDbml(updated)
    onClose()
  }, [tableId, localText, onClose])

  return (
    <div className="w-96 border-r border-[var(--c-border-s)] bg-[var(--c-bg-1)] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--c-border-s)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--c-text-1)]">Edit Table</span>
        <div className="flex gap-1">
          <button
            onClick={handleApply}
            className="text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 cursor-pointer"
          >
            Apply
          </button>
          <button
            onClick={onClose}
            className="text-[10px] px-2 py-1 rounded text-[var(--c-text-4)] hover:text-[var(--c-text-1)] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={DBML_LANGUAGE_ID}
          theme={isDark ? 'vs-dark' : 'light'}
          value={localText}
          onChange={(value) => setLocalText(value ?? '')}
          beforeMount={(monaco) => registerDbmlLanguage(monaco)}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'off',
            folding: false,
            quickSuggestions: false,
            acceptSuggestionOnCommitCharacter: false,
            suggestOnTriggerCharacters: false,
            wordBasedSuggestions: 'off',
            editContext: false,
          }}
        />
      </div>
    </div>
  )
}
