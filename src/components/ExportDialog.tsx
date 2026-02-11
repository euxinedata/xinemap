import { useState } from 'react'
import { exportSql } from '../parser/exportSql'
import type { SqlDialect } from '../parser/exportSql'
import { exportDiagramPng } from '../export/exportPng'
import { exportSnowflakeDDL } from '../export/exportSnowflake'
import { useEditorStore } from '../store/useEditorStore'
import { useDiagramStore } from '../store/useDiagramStore'

const DIALECTS: { label: string; value: SqlDialect }[] = [
  { label: 'Snowflake', value: 'snowflake' },
  { label: 'PostgreSQL', value: 'postgres' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'MSSQL', value: 'mssql' },
  { label: 'Oracle', value: 'oracle' },
]

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const [tab, setTab] = useState<'sql' | 'png' | 'dbml'>('sql')
  const [dialect, setDialect] = useState<SqlDialect>('snowflake')
  const [ddl, setDdl] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const dbml = useEditorStore((s) => s.dbml)
  const nodes = useDiagramStore((s) => s.nodes)

  if (!isOpen) return null

  function handleGenerate() {
    setError('')
    setDdl('')
    try {
      if (dialect === 'snowflake') {
        const result = useEditorStore.getState().parseResult
        if (!result) {
          setError('No parsed model available')
          return
        }
        setDdl(exportSnowflakeDDL(result))
      } else {
        setDdl(exportSql(dbml, dialect))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(ddl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  async function handleExportPng() {
    const el = document.querySelector<HTMLElement>('.react-flow')
    if (!el || nodes.length === 0) return
    try {
      await exportDiagramPng(el, nodes)
    } catch (e) {
      console.error('PNG export failed:', e)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-h-[80vh] bg-gray-800 border border-gray-700 rounded-lg shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-200">Export</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setTab('sql')}
            className={`px-4 py-2 text-xs font-medium ${
              tab === 'sql'
                ? 'text-gray-200 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            SQL DDL
          </button>
          <button
            onClick={() => setTab('png')}
            className={`px-4 py-2 text-xs font-medium ${
              tab === 'png'
                ? 'text-gray-200 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            PNG
          </button>
          <button
            onClick={() => setTab('dbml')}
            className={`px-4 py-2 text-xs font-medium ${
              tab === 'dbml'
                ? 'text-gray-200 border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            DBML
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 min-h-0 overflow-auto">
          {tab === 'sql' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <select
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value as SqlDialect)}
                  className="bg-gray-900 border border-gray-600 text-gray-300 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  {DIALECTS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleGenerate}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded"
                >
                  Generate
                </button>
                {ddl && (
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1.5"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}
              {ddl && (
                <textarea
                  readOnly
                  value={ddl}
                  className="bg-gray-900 border border-gray-700 text-gray-300 text-xs font-mono rounded p-3 h-64 resize-none focus:outline-none"
                />
              )}
            </div>
          )}

          {tab === 'png' && (
            <div>
              <button
                onClick={handleExportPng}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded"
              >
                Export PNG
              </button>
            </div>
          )}

          {tab === 'dbml' && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const blob = new Blob([dbml], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'model.dbml'
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded self-start"
              >
                Download .dbml
              </button>
              <textarea
                readOnly
                value={dbml}
                className="bg-gray-900 border border-gray-700 text-gray-300 text-xs font-mono rounded p-3 h-64 resize-none focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
