import { useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useEditorStore } from '../store/useEditorStore'
import { useThemeStore } from '../store/useThemeStore'
import { registerDbmlLanguage, DBML_LANGUAGE_ID } from './dbmlLanguage'

export function EditorPanel() {
  const dbml = useEditorStore((s) => s.dbml)
  const setDbml = useEditorStore((s) => s.setDbml)
  const parseErrors = useEditorStore((s) => s.parseErrors)
  const isDark = useThemeStore((s) => s.isDark)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    useEditorStore.getState().setScrollToLine((line: number) => {
      editor.revealLineInCenter(line)
      editor.focus()
    })
  }

  // Update error markers when parse errors change
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    if (parseErrors.length === 0) {
      monaco.editor.setModelMarkers(model, 'dbml', [])
      return
    }

    // Try to extract line number from error message
    const markers: Monaco.editor.IMarkerData[] = parseErrors.map((err) => {
      const lineMatch = err.match(/line\s+(\d+)/i)
      const line = lineMatch ? parseInt(lineMatch[1], 10) : 1
      return {
        severity: monaco.MarkerSeverity.Error,
        message: err,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: model.getLineMaxColumn(line),
      }
    })
    monaco.editor.setModelMarkers(model, 'dbml', markers)
  }, [parseErrors])

  return (
    <Editor
      height="100%"
      language={DBML_LANGUAGE_ID}
      theme={isDark ? 'vs-dark' : 'light'}
      value={dbml}
      onChange={(value) => setDbml(value ?? '')}
      beforeMount={(monaco) => registerDbmlLanguage(monaco)}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        quickSuggestions: false,
        acceptSuggestionOnCommitCharacter: false,
        suggestOnTriggerCharacters: false,
        wordBasedSuggestions: 'off',
      }}
    />
  )
}
