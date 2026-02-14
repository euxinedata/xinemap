import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { ConfirmDialog } from './InlineDialog'

interface FileDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function FileDialog({ isOpen, onClose }: FileDialogProps) {
  const {
    projects,
    loadProjectList,
    openProject,
    deleteProject,
  } = useProjectStore()

  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadProjectList()
    }
  }, [isOpen, loadProjectList])

  if (!isOpen) return null

  const handleOpen = async (id: string) => {
    await openProject(id)
    onClose()
  }

  const handleDeleteConfirm = async () => {
    if (!deleteId) return
    await deleteProject(deleteId)
    setDeleteId(null)
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

  const deleteProject_ = projects.find((p) => p.id === deleteId)

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
                          onClick={() => setDeleteId(p.id)}
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
      </div>
      {deleteId && (
        <ConfirmDialog
          message={`Delete project "${deleteProject_?.name}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
