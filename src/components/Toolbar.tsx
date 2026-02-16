import { useEffect, useRef, useState } from 'react'
import { ExportDialog } from './ExportDialog'
import { FileDialog } from './FileDialog'
import { HistoryDialog } from './HistoryDialog'
import { SourceConfigDialog } from './SourceConfigDialog'
import { PromptDialog } from './InlineDialog'
import { useProjectStore } from '../store/useProjectStore'
import { useEditorStore } from '../store/useEditorStore'
import { useThemeStore } from '../store/useThemeStore'
import { importer } from '@dbml/core'

const btnClass = 'flex items-center gap-1.5 text-sm text-[var(--c-text-3)] hover:text-[var(--c-text-1)] px-3 py-1'

export function Toolbar() {
  const [exportOpen, setExportOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [savePromptOpen, setSavePromptOpen] = useState(false)
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

  const saveOrPrompt = () => {
    const state = useProjectStore.getState()
    if (state.currentProjectId) {
      const project = state.projects.find((p) => p.id === state.currentProjectId)
      if (project) state.saveCurrentProject(project.name)
    } else {
      setSavePromptOpen(true)
    }
  }

  // Ctrl+S to quick-save current project
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveOrPrompt()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isDark = useThemeStore((s) => s.isDark)
  const toggleTheme = useThemeStore((s) => s.toggle)

  return (
    <div className="h-10 bg-[var(--c-bg-1)] border-b border-[var(--c-border)] flex items-center px-4 shrink-0">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" fill="none" className="h-[32px] w-auto">
        <g stroke="currentColor" strokeWidth="20" fill="none" transform="matrix(0.11560548,0,0,0.11560548,-4.6450238,-13.850197)">
          <path d="M 146.7,249.2 410.1,134.1 714.6,241.3 981.1,137.2 1058.4,654.6 714.6,788.7 399.1,668.8 64.7,799.7 Z" />
          <path d="m 714.9,784.8 -1.5,-547.5" />
          <path d="m 399.6,669.9 9.3,-537.9" />
        </g>
        <text x="53.28" y="7.38" transform="skewY(18)" fontFamily="Arial" fontSize="20.8" letterSpacing="0.16" fill="currentColor" stroke="currentColor" strokeWidth="1.3">N</text>
        <text x="53.24" y="46.36" transform="skewY(18)" fontFamily="Arial" fontSize="20.25" letterSpacing="0.16" fill="currentColor" stroke="currentColor" strokeWidth="1.27">S</text>
        <g transform="matrix(0.1000048,0.02048157,0,0.0630358,4.4171456,-1.1954626)" stroke="currentColor" fill="none" strokeWidth="25.19">
          <path d="m 562.29,324.11 45.77,126.37 -47.87,126.75 -43.25,-127.49 z" />
          <path d="m 551.35,360.18 1.46,166.4 -35.27,-78.48 z" fill="currentColor" />
        </g>
      </svg>
      <span className="text-sm font-semibold text-[var(--c-accent)] tracking-wide ml-2" style={{ fontFamily: "'Geist Mono', monospace" }}>XineMap</span>
      <div className="ml-6 flex items-center gap-1">
        <button onClick={newProject} className={btnClass}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1h5l3 3v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" /><polyline points="8 1 8 4 11 4" /></svg>
          New
        </button>
        <button onClick={() => setFileOpen(true)} className={btnClass}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 4.5V11a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1H7L5.5 3h-3a1 1 0 0 0-1 1z" /></svg>
          Projects
        </button>
        <button
          onClick={saveOrPrompt}
          className={isDirty ? 'flex items-center gap-1.5 text-sm text-[var(--c-accent)] hover:text-[var(--c-accent)] px-3 py-1 brightness-110' : btnClass}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 13H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h6l3 3v8a1 1 0 0 1-1 1z" /><path d="M9 13V8H5v5" /><path d="M5 1v3h3" /></svg>
          Save{isDirty ? ' *' : ''}
        </button>
        <button onClick={handleImport} className={btnClass}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1v7" /><polyline points="4 5 7 8 10 5" /><path d="M2 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" /></svg>
          Import
        </button>
        {parseResult && parseResult.dv2Metadata.size > 0 && (
          <button onClick={() => setSourcesOpen(true)} className={btnClass}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="7" cy="3" rx="5" ry="2" /><path d="M2 3v8c0 1.1 2.2 2 5 2s5-.9 5-2V3" /><path d="M2 7c0 1.1 2.2 2 5 2s5-.9 5-2" /></svg>
            Sources
          </button>
        )}
        <button onClick={() => setExportOpen(true)} className={btnClass}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M7 8V1" /><polyline points="10 4 7 1 4 4" /><path d="M2 10v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2" /></svg>
          Export
        </button>
        {currentProjectId && (
          <button onClick={() => setHistoryOpen(true)} className={btnClass}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="5.5" /><polyline points="7 4 7 7 9.5 8.5" /></svg>
            History
          </button>
        )}
        <input ref={fileRef} type="file" accept=".dbml,.sql" className="hidden" onChange={handleFileChange} />
      </div>
      <button onClick={toggleTheme} className={btnClass}>
        {isDark
          ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="3" /><line x1="7" y1="0.5" x2="7" y2="2" /><line x1="7" y1="12" x2="7" y2="13.5" /><line x1="0.5" y1="7" x2="2" y2="7" /><line x1="12" y1="7" x2="13.5" y2="7" /><line x1="2.4" y1="2.4" x2="3.5" y2="3.5" /><line x1="10.5" y1="10.5" x2="11.6" y2="11.6" /><line x1="2.4" y1="11.6" x2="3.5" y2="10.5" /><line x1="10.5" y1="3.5" x2="11.6" y2="2.4" /></svg>
          : <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8.5A5.5 5.5 0 1 1 5.5 2c0 4 3 6.5 6.5 6.5z" /></svg>
        }
        {isDark ? 'Light' : 'Dark'}
      </button>
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
      {savePromptOpen && (
        <PromptDialog
          message="Project name"
          placeholder="Enter project name"
          submitLabel="Save"
          onSubmit={(name) => {
            useProjectStore.getState().saveCurrentProject(name)
            setSavePromptOpen(false)
          }}
          onCancel={() => setSavePromptOpen(false)}
        />
      )}
    </div>
  )
}
