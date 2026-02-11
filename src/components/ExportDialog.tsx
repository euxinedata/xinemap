import { useState } from 'react'
import { exportSql } from '../parser/exportSql'
import type { SqlDialect } from '../parser/exportSql'
import { exportDiagramPng } from '../export/exportPng'
import { exportSnowflakeDDL } from '../export/exportSnowflake'
import { generateDV4dbt } from '../export/exportDV4dbt'
import { useEditorStore } from '../store/useEditorStore'
import { useDiagramStore } from '../store/useDiagramStore'
import { useSourceConfigStore } from '../store/useSourceConfigStore'
import type { GeneratedFile } from '../types'

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
  const [tab, setTab] = useState<'sql' | 'png' | 'dbml' | 'dbt'>('sql')
  const [dialect, setDialect] = useState<SqlDialect>('snowflake')
  const [ddl, setDdl] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // dbt tab state
  const [dbtFiles, setDbtFiles] = useState<GeneratedFile[]>([])
  const [dbtError, setDbtError] = useState('')
  const [dbtStatus, setDbtStatus] = useState('')
  const [expandedFile, setExpandedFile] = useState<string | null>(null)

  const dbml = useEditorStore((s) => s.dbml)
  const nodes = useDiagramStore((s) => s.nodes)
  const sourceConfig = useSourceConfigStore((s) => s.sourceConfig)

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
        className="w-[560px] max-h-[80vh] bg-[var(--c-bg-3)] border border-[var(--c-border)] rounded-lg shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-border)]">
          <h2 className="text-sm font-semibold text-[var(--c-text-1)]">Export</h2>
          <button
            onClick={onClose}
            className="text-[var(--c-text-4)] hover:text-[var(--c-text-2)] text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--c-border)]">
          <button
            onClick={() => setTab('sql')}
            className={`px-4 py-2 text-xs font-medium ${
              tab === 'sql'
                ? 'text-[var(--c-text-1)] border-b-2 border-blue-500'
                : 'text-[var(--c-text-4)] hover:text-[var(--c-text-2)]'
            }`}
          >
            SQL DDL
          </button>
          <button
            onClick={() => setTab('png')}
            className={`px-4 py-2 text-xs font-medium ${
              tab === 'png'
                ? 'text-[var(--c-text-1)] border-b-2 border-blue-500'
                : 'text-[var(--c-text-4)] hover:text-[var(--c-text-2)]'
            }`}
          >
            PNG
          </button>
          <button
            onClick={() => setTab('dbml')}
            className={`px-4 py-2 text-xs font-medium ${
              tab === 'dbml'
                ? 'text-[var(--c-text-1)] border-b-2 border-blue-500'
                : 'text-[var(--c-text-4)] hover:text-[var(--c-text-2)]'
            }`}
          >
            DBML
          </button>
          <button
            onClick={() => setTab('dbt')}
            className={`px-4 py-2 text-xs font-medium ${
              tab === 'dbt'
                ? 'text-[var(--c-text-1)] border-b-2 border-blue-500'
                : 'text-[var(--c-text-4)] hover:text-[var(--c-text-2)]'
            }`}
          >
            dbt
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
                  className="bg-[var(--c-bg-1)] border border-[var(--c-border-s)] text-[var(--c-text-2)] text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
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
                    className="text-xs text-[var(--c-text-3)] hover:text-[var(--c-text-1)] px-2 py-1.5"
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
                  className="bg-[var(--c-bg-1)] border border-[var(--c-border)] text-[var(--c-text-2)] text-xs font-mono rounded p-3 h-64 resize-none focus:outline-none"
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
                className="bg-[var(--c-bg-1)] border border-[var(--c-border)] text-[var(--c-text-2)] text-xs font-mono rounded p-3 h-64 resize-none focus:outline-none"
              />
            </div>
          )}

          {tab === 'dbt' && (
            <div className="flex flex-col gap-3">
              {Object.keys(sourceConfig).length === 0 ? (
                <p className="text-xs text-[var(--c-text-3)]">Configure sources first</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setDbtError('')
                        setDbtStatus('')
                        setDbtFiles([])
                        try {
                          const result = useEditorStore.getState().parseResult
                          if (!result) {
                            setDbtError('No parsed model available')
                            return
                          }
                          const files = generateDV4dbt(result, sourceConfig)
                          setDbtFiles(files)
                        } catch (e) {
                          setDbtError(e instanceof Error ? e.message : 'Generation failed')
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded"
                    >
                      Generate
                    </button>
                    {dbtFiles.length > 0 && (
                      <button
                        onClick={async () => {
                          setDbtStatus('')
                          setDbtError('')
                          try {
                            const resp = await fetch('/api/dbt/generate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ files: dbtFiles }),
                            })
                            if (!resp.ok) {
                              const body = await resp.json().catch(() => ({}))
                              setDbtError(body.detail ?? `Server error ${resp.status}`)
                              return
                            }
                            const body = await resp.json()
                            setDbtStatus(`${body.written.length} files written to ${body.modelPath}/`)
                          } catch {
                            setDbtError('No dbt project detected')
                          }
                        }}
                        className="bg-[var(--c-bg-hover)] text-[var(--c-text-2)] hover:text-[var(--c-text-1)] text-xs font-medium px-3 py-1.5 rounded border border-[var(--c-border-s)]"
                      >
                        Write to Project
                      </button>
                    )}
                  </div>
                  {dbtError && <p className="text-xs text-red-400">{dbtError}</p>}
                  {dbtStatus && <p className="text-xs text-green-400">{dbtStatus}</p>}
                  {dbtFiles.length > 0 && (
                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                      {dbtFiles.map((f) => (
                        <div key={f.path} className="border border-[var(--c-border)] rounded">
                          <button
                            onClick={() => setExpandedFile(expandedFile === f.path ? null : f.path)}
                            className="w-full text-left px-2 py-1.5 text-xs text-[var(--c-text-2)] hover:bg-[var(--c-bg-hover)] flex items-center gap-1"
                          >
                            <span className="text-[var(--c-text-4)]">{expandedFile === f.path ? '\u25BC' : '\u25B6'}</span>
                            <span className="font-mono">{f.path}</span>
                          </button>
                          {expandedFile === f.path && (
                            <pre className="bg-[var(--c-bg-1)] text-[var(--c-text-2)] text-xs font-mono p-2 border-t border-[var(--c-border)] overflow-x-auto whitespace-pre">
                              {f.content}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
