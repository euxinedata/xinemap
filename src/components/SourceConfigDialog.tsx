import { useState, useEffect } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { useSourceConfigStore } from '../store/useSourceConfigStore'
import type { SourceMapping } from '../types'

interface SourceConfigDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SourceConfigDialog({ isOpen, onClose }: SourceConfigDialogProps) {
  const parseResult = useEditorStore((s) => s.parseResult)
  const sourceConfig = useSourceConfigStore((s) => s.sourceConfig)
  const setMapping = useSourceConfigStore((s) => s.setMapping)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<SourceMapping>({
    sourceName: 'raw',
    tableName: '',
    ldtsColumn: 'load_datetime',
    rsrcValue: '',
  })

  // Build entity list: hubs and links only
  const entities = (parseResult?.tables ?? []).filter((t) => {
    const meta = parseResult?.dv2Metadata.get(t.id)
    return meta?.entityType === 'hub' || meta?.entityType === 'link'
  })

  // When selection changes, load existing mapping or defaults
  useEffect(() => {
    if (!selectedId) return
    setSaved(false)
    const existing = sourceConfig[selectedId]
    const table = entities.find((e) => e.id === selectedId)
    if (existing) {
      setForm({ ...existing })
    } else {
      setForm({
        sourceName: 'raw',
        tableName: table?.name.toLowerCase() ?? '',
        ldtsColumn: 'load_datetime',
        rsrcValue: '',
      })
    }
  }, [selectedId])

  // Auto-select first entity when dialog opens
  useEffect(() => {
    if (isOpen && entities.length > 0 && !selectedId) {
      setSelectedId(entities[0].id)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    if (!selectedId) return
    setMapping(selectedId, { ...form })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-h-[80vh] bg-[var(--c-bg-3)] border border-[var(--c-border)] rounded-lg shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
          <h2 className="text-sm font-semibold text-[var(--c-text-1)]">Source Configuration</h2>
          <button
            onClick={onClose}
            className="text-[var(--c-text-4)] hover:text-[var(--c-text-2)] text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left column: entity list */}
          <div className="w-48 border-r border-[var(--c-border)] overflow-y-auto py-1">
            {entities.map((entity) => {
              const meta = parseResult?.dv2Metadata.get(entity.id)
              const isConfigured = !!sourceConfig[entity.id]
              const isSelected = selectedId === entity.id
              return (
                <button
                  key={entity.id}
                  onClick={() => setSelectedId(entity.id)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                    isSelected
                      ? 'bg-[var(--c-bg-hover)] text-[var(--c-text-1)]'
                      : 'text-[var(--c-text-3)] hover:text-[var(--c-text-1)] hover:bg-[var(--c-bg-hover)]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isConfigured ? 'bg-green-500' : 'bg-[var(--c-text-4)]'
                    }`}
                  />
                  <span className="truncate">{entity.name}</span>
                  <span className="ml-auto text-[10px] text-[var(--c-text-4)]">
                    {meta?.entityType}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Right column: form */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedId ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--c-text-3)]">Source Name</span>
                  <input
                    type="text"
                    value={form.sourceName}
                    onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
                    className="bg-[var(--c-bg-1)] border border-[var(--c-border-s)] text-[var(--c-text-2)] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--c-text-3)]">Table Name</span>
                  <input
                    type="text"
                    value={form.tableName}
                    onChange={(e) => setForm({ ...form, tableName: e.target.value })}
                    className="bg-[var(--c-bg-1)] border border-[var(--c-border-s)] text-[var(--c-text-2)] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--c-text-3)]">Load Datetime Column</span>
                  <input
                    type="text"
                    value={form.ldtsColumn}
                    onChange={(e) => setForm({ ...form, ldtsColumn: e.target.value })}
                    className="bg-[var(--c-bg-1)] border border-[var(--c-border-s)] text-[var(--c-text-2)] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--c-text-3)]">Record Source Value</span>
                  <input
                    type="text"
                    value={form.rsrcValue}
                    onChange={(e) => setForm({ ...form, rsrcValue: e.target.value })}
                    placeholder="!System/Entity"
                    className="bg-[var(--c-bg-1)] border border-[var(--c-border-s)] text-[var(--c-text-2)] text-xs rounded px-2 py-1.5 placeholder-[var(--c-text-4)] focus:outline-none focus:border-blue-500"
                  />
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={handleSave}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded"
                  >
                    Save
                  </button>
                  {saved && (
                    <span className="text-xs text-green-400">Saved</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--c-text-4)]">Select an entity to configure</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
