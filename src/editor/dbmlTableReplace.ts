function findTableRange(dbml: string, tableId: string): { start: number; end: number } | null {
  const parts = tableId.split('.')
  const schema = parts.length > 1 ? parts[0] : 'public'
  const tableName = parts.length > 1 ? parts[1] : parts[0]

  // Build possible name forms as they might appear in DBML
  const names: string[] = []
  if (schema !== 'public') {
    names.push(`${schema}.${tableName}`)
  }
  names.push(tableName)
  if (schema === 'public') {
    names.push(`public.${tableName}`)
  }

  // Case-insensitive search: lowercase copy for matching, original for extraction
  const lower = dbml.toLowerCase()

  for (const name of names) {
    const marker = `table ${name.toLowerCase()}`
    let idx = 0
    while (idx < lower.length) {
      const pos = lower.indexOf(marker, idx)
      if (pos === -1) break

      // Pre-boundary: must be start-of-string or whitespace before "table"
      if (pos > 0) {
        const before = dbml[pos - 1]
        if (before !== ' ' && before !== '\t' && before !== '\n' && before !== '\r') {
          idx = pos + marker.length
          continue
        }
      }

      // Post-boundary: character after name must be whitespace, '{', or '['
      const afterName = pos + marker.length
      if (afterName < dbml.length) {
        const ch = dbml[afterName]
        if (ch !== ' ' && ch !== '\t' && ch !== '\n' && ch !== '\r' && ch !== '{' && ch !== '[') {
          idx = afterName
          continue
        }
      }

      // Find the opening brace
      const braceStart = dbml.indexOf('{', afterName)
      if (braceStart === -1) { idx = afterName; continue }

      // Track depth to find closing brace
      let depth = 0
      let end = braceStart
      for (let i = braceStart; i < dbml.length; i++) {
        if (dbml[i] === '{') depth++
        if (dbml[i] === '}') {
          depth--
          if (depth === 0) {
            end = i + 1
            break
          }
        }
      }

      return { start: pos, end }
    }
  }

  return null
}

export function extractTableBlock(dbml: string, tableId: string): string {
  const range = findTableRange(dbml, tableId)
  if (!range) return ''
  return dbml.slice(range.start, range.end)
}

export function replaceTableInDbml(dbml: string, tableId: string, newBlock: string): string {
  const range = findTableRange(dbml, tableId)
  if (!range) return dbml
  return dbml.slice(0, range.start) + newBlock + dbml.slice(range.end)
}
