import { useEffect, useState } from 'react'
import { ExportDialog } from './ExportDialog'
import { FileDialog } from './FileDialog'
import { useProjectStore } from '../store/useProjectStore'

const btnClass = 'text-sm text-gray-400 hover:text-gray-200 px-3 py-1'

export function Toolbar() {
  const [exportOpen, setExportOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const newProject = useProjectStore((s) => s.newProject)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)

  // Ctrl+S to quick-save current project
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        <button onClick={() => setExportOpen(true)} className={btnClass}>Export</button>
      </div>
      {currentProjectId && (
        <span className="ml-auto text-xs text-gray-600">
          {useProjectStore.getState().projects.find((p) => p.id === currentProjectId)?.name}
        </span>
      )}
      <FileDialog isOpen={fileOpen} onClose={() => setFileOpen(false)} />
      <ExportDialog isOpen={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
