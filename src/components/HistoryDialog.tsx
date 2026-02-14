import { useEffect, useState } from 'react'
import { useProjectStore } from '../store/useProjectStore'
import { getCommitContent } from '../persistence/gitStorage'
import { parseDbml } from '../parser/parseDbml'

interface ChangeSummary {
  added: string[]
  removed: string[]
  modified: string[]
}

interface HistoryDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function HistoryDialog({ isOpen, onClose }: HistoryDialogProps) {
  const { currentProjectId, commitHistory, loadHistory, restoreCommit } = useProjectStore()

  useEffect(() => {
    if (isOpen && currentProjectId) loadHistory()
  }, [isOpen, currentProjectId, loadHistory])

  const [hideLayout, setHideLayout] = useState(true)
  const [expandedOid, setExpandedOid] = useState<string | null>(null)
  const [changeSummary, setChangeSummary] = useState<ChangeSummary | null>(null)
  const [loading, setLoading] = useState(false)

  if (!isOpen || !currentProjectId) return null

  const filtered = hideLayout
    ? commitHistory.filter((c) => !c.message.startsWith('Update layout'))
    : commitHistory

  const handleRestore = async (oid: string) => {
    await restoreCommit(oid)
    onClose()
  }

  const handleExpand = async (oid: string) => {
    if (expandedOid === oid) {
      setExpandedOid(null)
      setChangeSummary(null)
      return
    }

    setExpandedOid(oid)
    setChangeSummary(null)
    setLoading(true)

    const idx = commitHistory.findIndex((c) => c.oid === oid)
    const prevOid = idx < commitHistory.length - 1 ? commitHistory[idx + 1].oid : null

    const [currentContent, prevContent] = await Promise.all([
      getCommitContent(currentProjectId, oid),
      prevOid ? getCommitContent(currentProjectId, prevOid) : Promise.resolve(null),
    ])

    if (!prevContent) {
      // First commit or no previous — show as initial
      const tables = currentContent ? parseDbml(currentContent).tables.map((t) => t.name) : []
      setChangeSummary({ added: tables.sort(), removed: [], modified: [] })
      setLoading(false)
      return
    }

    const curTables = new Map<string, number>()
    const prevTables = new Map<string, number>()

    if (currentContent) {
      for (const t of parseDbml(currentContent).tables) curTables.set(t.name, t.columns.length)
    }
    for (const t of parseDbml(prevContent).tables) prevTables.set(t.name, t.columns.length)

    const added: string[] = []
    const removed: string[] = []
    const modified: string[] = []

    for (const name of curTables.keys()) {
      if (!prevTables.has(name)) added.push(name)
      else if (curTables.get(name) !== prevTables.get(name)) modified.push(name)
    }
    for (const name of prevTables.keys()) {
      if (!curTables.has(name)) removed.push(name)
    }

    setChangeSummary({
      added: added.sort(),
      removed: removed.sort(),
      modified: modified.sort(),
    })
    setLoading(false)
  }

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
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
        <div className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-[var(--c-text-1)]">History</h2>
            <label className="flex items-center gap-1.5 text-xs text-[var(--c-text-3)] cursor-pointer">
              <input
                type="checkbox"
                checked={hideLayout}
                onChange={(e) => setHideLayout(e.target.checked)}
                className="accent-blue-500"
              />
              Hide layout changes
            </label>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--c-text-3)] hover:text-[var(--c-text-1)] text-sm"
          >
            Close
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto px-4 py-2">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--c-text-4)]">No history</p>
          ) : (
            <div className="flex flex-col gap-1">
              {filtered.map((c) => (
                <div key={c.oid} className="border-b border-[var(--c-border)]/50 last:border-0">
                  <div
                    className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-[var(--c-bg-hover)]/30"
                    onClick={() => handleExpand(c.oid)}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-[var(--c-text-2)] truncate">{c.message}</span>
                      <span className="text-[11px] text-[var(--c-text-4)]">
                        {relativeTime(c.timestamp)} — {c.oid.slice(0, 7)}
                      </span>
                    </div>
                    {c.oid !== commitHistory[0]?.oid && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestore(c.oid) }}
                        className="text-xs text-blue-400 hover:text-blue-300 ml-2 shrink-0"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                  {expandedOid === c.oid && (
                    <div className="pb-2 pl-2 text-[11px]">
                      {loading ? (
                        <span className="text-[var(--c-text-4)]">Loading...</span>
                      ) : changeSummary && (changeSummary.added.length + changeSummary.removed.length + changeSummary.modified.length) === 0 ? (
                        <span className="text-[var(--c-text-4)]">No table changes</span>
                      ) : changeSummary ? (
                        <div className="flex flex-col gap-0.5">
                          {changeSummary.added.map((n) => (
                            <span key={n} className="text-green-400">+ {n}</span>
                          ))}
                          {changeSummary.removed.map((n) => (
                            <span key={n} className="text-red-400">- {n}</span>
                          ))}
                          {changeSummary.modified.map((n) => (
                            <span key={n} className="text-yellow-400">~ {n}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
