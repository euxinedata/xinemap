import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'

interface FileDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function FileDialog({ isOpen, onClose }: FileDialogProps) {
  const {
    currentProjectId,
    projects,
    loadProjectList,
    saveCurrentProject,
    openProject,
    deleteProject,
  } = useProjectStore()

  const [saveName, setSaveName] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadProjectList()
      setSaveName('')
    }
  }, [isOpen, loadProjectList])

  if (!isOpen) return null

  const currentProject = projects.find((p) => p.id === currentProjectId)

  const handleSave = async () => {
    const name = saveName.trim()
    if (!name) return
    await saveCurrentProject(name)
    onClose()
  }

  const handleUpdate = async () => {
    if (!currentProject) return
    await saveCurrentProject(currentProject.name)
    onClose()
  }

  const handleOpen = async (id: string) => {
    await openProject(id)
    onClose()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this project?')) return
    await deleteProject(id)
  }

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded border border-[var(--c-border)] bg-[var(--c-bg-3)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--c-text-1)]">Projects</h2>
          <button
            onClick={onClose}
            className="text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-sm"
          >
            Close
          </button>
        </div>

        {/* Project list */}
          <div className="max-h-64 overflow-y-auto px-4 py-2">
            {projects.length === 0 ? (
              <p className="py-4 text-center text-sm text-[var(--c-text-4)]">
                No saved projects
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--c-text-4)]">
                    <th className="pb-1 font-medium">Name</th>
                    <th className="pb-1 font-medium">Modified</th>
                    <th className="pb-1 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-[var(--c-border)]/50 text-[var(--c-text-2)]"
                    >
                      <td className="py-1.5">{p.name}</td>
                      <td className="py-1.5 text-[var(--c-text-3)]">
                        {formatDate(p.updatedAt)}
                      </td>
                      <td className="py-1.5 text-right space-x-2">
                        <button
                          onClick={() => handleOpen(p.id)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        {/* Save section */}
        <div className="border-t border-[var(--c-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Project name"
              className="flex-1 rounded border border-[var(--c-border-s)] bg-[var(--c-bg-hover)] px-2 py-1 text-sm text-[var(--c-text-1)] placeholder-[var(--c-text-4)] outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Save As
            </button>
            {currentProject && (
              <button
                onClick={handleUpdate}
                className="rounded bg-[var(--c-border-s)] px-3 py-1 text-sm text-[var(--c-text-1)] hover:bg-[var(--c-text-4)]"
              >
                Update
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
