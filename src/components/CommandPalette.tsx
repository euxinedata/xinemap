import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditorStore } from '../store/useEditorStore'
import { useDiagramStore } from '../store/useDiagramStore'
import { useReactFlow } from '@xyflow/react'
import { generateScaffold, type ScaffoldType } from '../editor/scaffolding'
import type { SearchMatch } from '../types'

interface ScaffoldCommand {
  label: string
  type: ScaffoldType
  name: string
  parentHub?: string
  hubs?: string[]
}

function parseScaffoldCommand(query: string): ScaffoldCommand | null {
  const prefixMatch = query.match(/^(?:scaffold|new)\s+(.*)$/i)
  if (!prefixMatch) return null
  const rest = prefixMatch[1].trim()

  // "hub Customer"
  const hubMatch = rest.match(/^hub\s+(\w+)$/i)
  if (hubMatch) return { label: `Create Hub: ${hubMatch[1]}`, type: 'hub', name: hubMatch[1] }

  // "sat CustomerPII for Customer"
  const satMatch = rest.match(/^sat(?:ellite)?\s+(\w+)\s+for\s+(\w+)$/i)
  if (satMatch) return { label: `Create Satellite: ${satMatch[1]}`, type: 'satellite', name: satMatch[1], parentHub: satMatch[2] }

  // "link CustomerCard between Customer Card"
  const linkMatch = rest.match(/^link\s+(\w+)\s+between\s+(.+)$/i)
  if (linkMatch) {
    const hubs = linkMatch[2].trim().split(/\s+/)
    return { label: `Create Link: ${linkMatch[1]}`, type: 'link', name: linkMatch[1], hubs }
  }

  return null
}

function searchEntities(query: string): SearchMatch[] {
  const parseResult = useEditorStore.getState().parseResult
  if (!parseResult || !query) return []

  const q = query.toLowerCase()
  const results: SearchMatch[] = []

  for (const table of parseResult.tables) {
    if (table.name.toLowerCase().includes(q)) {
      results.push({ type: 'table', tableId: table.id, matchText: table.name })
    }
    for (const col of table.columns) {
      if (col.name.toLowerCase().includes(q)) {
        results.push({ type: 'column', tableId: table.id, columnName: col.name, matchText: `${table.name}.${col.name}` })
      }
    }
  }

  for (const note of parseResult.stickyNotes) {
    if (note.content.toLowerCase().includes(q) || note.name.toLowerCase().includes(q)) {
      results.push({ type: 'note', tableId: note.id, matchText: note.name || note.content.slice(0, 40) })
    }
  }

  return results
}

export function CommandPalette() {
  const searchOpen = useDiagramStore((s) => s.searchOpen)
  const setSearchOpen = useDiagramStore((s) => s.setSearchOpen)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const reactFlow = useReactFlow()

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(!useDiagramStore.getState().searchOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  // Focus input when opened
  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [searchOpen])

  const close = useCallback(() => {
    setSearchOpen(false)
    setQuery('')
  }, [setSearchOpen])

  const scaffoldCmd = parseScaffoldCommand(query)
  const searchResults = scaffoldCmd ? [] : searchEntities(query)
  const totalResults = scaffoldCmd ? 1 : searchResults.length

  const handleSelect = useCallback((index: number) => {
    if (scaffoldCmd) {
      const text = generateScaffold(scaffoldCmd.type, scaffoldCmd.name, scaffoldCmd.parentHub, scaffoldCmd.hubs)
      const current = useEditorStore.getState().dbml
      useEditorStore.getState().setDbml(current + '\n\n' + text)
      close()
      return
    }

    const match = searchResults[index]
    if (!match) return

    const nodeId = match.tableId
    reactFlow.fitView({ nodes: [{ id: nodeId }], duration: 300, padding: 0.5 })
    close()
  }, [scaffoldCmd, searchResults, reactFlow, close])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, totalResults - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(selectedIndex)
    }
  }, [close, totalResults, selectedIndex, handleSelect])

  if (!searchOpen) return null

  const typeColor = (type: string) => {
    switch (type) {
      case 'table': return 'bg-blue-400'
      case 'column': return 'bg-amber-400'
      case 'note': return 'bg-green-400'
      default: return 'bg-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-start justify-center pt-[20vh]" onClick={close}>
      <div
        className="w-[480px] bg-gray-900 border border-gray-600 rounded-lg shadow-2xl z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
          onKeyDown={handleKeyDown}
          placeholder="Search entities or scaffold new..."
          className="w-full px-4 py-3 text-sm text-gray-200 bg-transparent border-b border-gray-700 outline-none placeholder-gray-500"
        />
        <div className="max-h-[320px] overflow-y-auto">
          {scaffoldCmd && (
            <div
              className={`px-4 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                selectedIndex === 0 ? 'bg-gray-800 text-gray-200' : 'text-gray-400'
              }`}
              onClick={() => handleSelect(0)}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>{scaffoldCmd.label}</span>
            </div>
          )}
          {!scaffoldCmd && searchResults.map((match, i) => (
            <div
              key={`${match.tableId}-${match.columnName ?? ''}-${i}`}
              className={`px-4 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                i === selectedIndex ? 'bg-gray-800 text-gray-200' : 'text-gray-400'
              }`}
              onClick={() => handleSelect(i)}
            >
              <span className={`w-2 h-2 rounded-full ${typeColor(match.type)} shrink-0`} />
              <span className="truncate">{match.matchText}</span>
              <span className="ml-auto text-[10px] text-gray-600">{match.type}</span>
            </div>
          ))}
          {!scaffoldCmd && query && searchResults.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-600">No results</div>
          )}
        </div>
      </div>
    </div>
  )
}
