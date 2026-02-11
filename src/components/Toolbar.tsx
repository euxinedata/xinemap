import { useEffect, useRef, useState } from 'react'
import { ExportDialog } from './ExportDialog'
import { FileDialog } from './FileDialog'
import { useProjectStore } from '../store/useProjectStore'
import { useEditorStore } from '../store/useEditorStore'
import { importer } from '@dbml/core'

const btnClass = 'text-sm text-gray-400 hover:text-gray-200 px-3 py-1'

export function Toolbar() {
  const [exportOpen, setExportOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const newProject = useProjectStore((s) => s.newProject)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const parseResult = useEditorStore((s) => s.parseResult)
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
          setFileOpen(true)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="h-10 bg-gray-900 border-b border-gray-700 flex items-center px-4 shrink-0">
      <span className="text-sm font-semibold text-gray-300 tracking-wide">DGLML</span>
      <div className="ml-6 flex items-center gap-1">
        <button onClick={newProject} className={btnClass}>New</button>
        <button onClick={() => setFileOpen(true)} className={btnClass}>Projects</button>
        <button onClick={handleImport} className={btnClass}>Import</button>
        <button onClick={() => setExportOpen(true)} className={btnClass}>Export</button>
        <input ref={fileRef} type="file" accept=".dbml,.sql" className="hidden" onChange={handleFileChange} />
      </div>
      <span className="ml-auto text-xs text-gray-600">
        {parseResult?.projectMeta?.name
          ?? (currentProjectId
            ? useProjectStore.getState().projects.find((p) => p.id === currentProjectId)?.name
            : undefined)}
      </span>
      <FileDialog isOpen={fileOpen} onClose={() => setFileOpen(false)} />
      <ExportDialog isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
