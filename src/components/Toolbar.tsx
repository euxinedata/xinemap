import { useEffect, useRef, useState } from 'react'
import { ExportDialog } from './ExportDialog'
import { FileDialog } from './FileDialog'
import { HistoryDialog } from './HistoryDialog'
import { SourceConfigDialog } from './SourceConfigDialog'
import { useProjectStore } from '../store/useProjectStore'
import { useEditorStore } from '../store/useEditorStore'
import { useThemeStore } from '../store/useThemeStore'
import { importer } from '@dbml/core'

const btnClass = 'text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] px-3 py-1'

export function Toolbar() {
  const [exportOpen, setExportOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const newProject = useProjectStore((s) => s.newProject)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const parseResult = useEditorStore((s) => s.parseResult)
  const dbml = useEditorStore((s) => s.dbml)
  const lastSavedDbml = useEditorStore((s) => s.lastSavedDbml)
  const isDirty = dbml !== lastSavedDbml && lastSavedDbml !== ''
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = () => fileRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      if (file.name.endsWith('.sql')) {
        try {
          const dbmlText = importer.import(text, 'postgres')
          useEditorStore.getState().setDbml(dbmlText)
        } catch {
          useEditorStore.getState().setDbml(text)
        }
      } else {
        useEditorStore.getState().setDbml(text)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Ctrl+S to quick-save current project
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        const state = useProjectStore.getState()
        if (state.currentProjectId) {
          const project = state.projects.find((p) => p.id === state.currentProjectId)
          if (project) state.saveCurrentProject(project.name)
        } else {
          const name = window.prompt('Project name')
          if (name?.trim()) state.saveCurrentProject(name.trim())
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isDark = useThemeStore((s) => s.isDark)
  const toggleTheme = useThemeStore((s) => s.toggle)

  return (
    <div className="h-10 bg-[var(--c-bg-1)] border-b border-[var(--c-border)] flex items-center px-4 shrink-0">
      <span className="text-sm font-semibold text-[var(--c-text-2)] tracking-wide">DGLML</span>
      <div className="ml-6 flex items-center gap-1">
        <button onClick={newProject} className={btnClass}>New</button>
        <button onClick={() => setFileOpen(true)} className={btnClass}>Projects</button>
        <button
          onClick={() => {
            const state = useProjectStore.getState()
            if (state.currentProjectId) {
              const project = state.projects.find((p) => p.id === state.currentProjectId)
              if (project) state.saveCurrentProject(project.name)
            } else {
              const name = window.prompt('Project name')
              if (name?.trim()) state.saveCurrentProject(name.trim())
            }
          }}
          className={isDirty ? 'text-sm text-amber-400 hover:text-amber-300 px-3 py-1' : btnClass}
        >
          Save{isDirty ? ' *' : ''}
        </button>
        <button onClick={handleImport} className={btnClass}>Import</button>
        {parseResult && parseResult.dv2Metadata.size > 0 && (
          <button onClick={() => setSourcesOpen(true)} className={btnClass}>Sources</button>
        )}
        <button onClick={() => setExportOpen(true)} className={btnClass}>Export</button>
        {currentProjectId && (
          <button onClick={() => setHistoryOpen(true)} className={btnClass}>History</button>
        )}
        <input ref={fileRef} type="file" accept=".dbml,.sql" className="hidden" onChange={handleFileChange} />
      </div>
      <button onClick={toggleTheme} className={btnClass}>{isDark ? 'Light' : 'Dark'}</button>
      <span className="ml-auto text-xs text-[var(--c-text-4)]">
        {parseResult?.projectMeta?.name
          ?? (currentProjectId
            ? useProjectStore.getState().projects.find((p) => p.id === currentProjectId)?.name
            : undefined)}
      </span>
      <FileDialog isOpen={fileOpen} onClose={() => setFileOpen(false)} />
      <HistoryDialog isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
      <SourceConfigDialog isOpen={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      <ExportDialog isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
