import { Parser } from '@dbml/core'
import type { ParseResult, StickyNoteInfo, DV2Metadata, DV2EntityType, DV2ColumnRole, ProjectMeta } from '../types'

function parseDV2Role(note: string | undefined): DV2ColumnRole | undefined {
  if (!note) return undefined
  if (note.includes('**hk**')) return 'hk'
  if (note.includes('**bk**')) return 'bk'
  if (note.includes('**mak**')) return 'mak'
  if (note.includes('**driving key**')) return 'dk'
  return undefined
}

function entityTypeFromPartials(partials: any[]): DV2EntityType | null {
  for (const p of partials) {
    const name = (p.name ?? '').toLowerCase()
    if (name === 'hub') return 'hub'
    if (name === 'satellite') return 'satellite'
    if (name === 'link') return 'link'
    if (name.startsWith('reference')) return 'reference'
  }
  return null
}

function entityTypeFromGroup(group: string): DV2EntityType {
  const g = group.toLowerCase()
  if (g.startsWith('hub')) return 'hub'
  if (g.startsWith('sat')) return 'satellite'
  if (g.startsWith('link')) return 'link'
  return 'reference'
}

export function parseDbml(source: string): ParseResult {
  try {
    const database = Parser.parse(source, 'dbmlv2')
    const exported = database.export()

    // Build table→group mapping from TableGroups
    const groupMap = new Map<string, string>()
    for (const schema of exported.schemas) {
      const schemaName = schema.name || 'public'
      for (const tg of (schema as any).tableGroups ?? []) {
        for (const t of tg.tables ?? []) {
          const tSchema = t.schemaName || schemaName
          groupMap.set(`${tSchema}.${t.tableName}`, tg.name)
        }
      }
    }

    // Store entity type hints from partials (keyed by tableId)
    const entityHintMap = new Map<string, DV2EntityType>()

    const tables = exported.schemas.flatMap((schema) => {
      const schemaName = schema.name || 'public'
      return schema.tables.map((table) => {
        const tableId = `${schemaName}.${table.name}`

        // Extract entity type from TablePartial injections
        const partials = (table as any).partials ?? []
        const hint = entityTypeFromPartials(partials)
        if (hint) entityHintMap.set(tableId, hint)

        return {
          id: tableId,
          schema: schemaName,
          name: table.name,
          columns: table.fields.map((field) => ({
            name: field.name,
            type: field.type?.type_name ?? String(field.type ?? ''),
            isPrimaryKey: field.pk,
            isForeignKey: false,
            isNotNull: field.not_null,
            isUnique: field.unique,
            defaultValue: field.dbdefault != null ? String(field.dbdefault) : undefined,
            note: field.note || undefined,
            dv2Role: parseDV2Role(field.note),
            isInjected: !!(field as any).injectedPartialId,
          })),
          headerColor: table.headerColor || undefined,
          note: table.note || undefined,
          group: groupMap.get(tableId),
        }
      })
    })

    const refs = exported.schemas.flatMap((schema) => {
      const schemaName = schema.name || 'public'
      return schema.refs.map((ref, idx) => {
        const from = ref.endpoints[0]
        const to = ref.endpoints[1]
        const fromRelation = from.relation
        const toRelation = to.relation

        let type: '1-1' | '1-n' | 'n-1' | 'n-n'
        if (fromRelation === '*' && toRelation === '*') type = 'n-n'
        else if (fromRelation === '*') type = 'n-1'
        else if (toRelation === '*') type = '1-n'
        else type = '1-1'

        const fromSchema = from.schemaName || schemaName
        const toSchema = to.schemaName || schemaName

        return {
          id: `ref-${schemaName}-${idx}`,
          fromTable: `${fromSchema}.${from.tableName}`,
          fromColumns: from.fieldNames,
          toTable: `${toSchema}.${to.tableName}`,
          toColumns: to.fieldNames,
          type,
        }
      })
    })

    const enums = exported.schemas.flatMap((schema) => {
      const schemaName = schema.name || 'public'
      return schema.enums.map((e) => ({
        id: `${schemaName}.${e.name}`,
        schema: schemaName,
        name: e.name,
        values: e.values.map((v) => ({
          name: v.name,
          note: v.note || undefined,
        })),
      }))
    })

    // Mark FK columns from refs
    const fkSet = new Set<string>()
    for (const ref of refs) {
      for (const col of ref.fromColumns) fkSet.add(`${ref.fromTable}.${col}`)
      for (const col of ref.toColumns) fkSet.add(`${ref.toTable}.${col}`)
    }
    for (const table of tables) {
      for (const col of table.columns) {
        if (fkSet.has(`${table.id}.${col.name}`)) col.isForeignKey = true
      }
    }

    // Extract sticky notes
    const stickyNotes: StickyNoteInfo[] = ((exported as any).notes ?? []).map((n: any, idx: number) => ({
      id: `note-${idx}`,
      name: n.name || '',
      content: n.content || '',
      headerColor: n.headerColor || undefined,
    }))

    // Build DV2 metadata — two-pass approach
    // Pass 1: classify all tables (partials take priority over groups)
    const dv2Metadata = new Map<string, DV2Metadata>()
    for (const table of tables) {
      const hint = entityHintMap.get(table.id)
      const group = table.group ?? ''
      const entityType = hint ?? entityTypeFromGroup(group)
      dv2Metadata.set(table.id, { entityType, parentHubs: [], linkedHubs: [] })
    }

    // Pass 2: resolve relationships using classified types
    for (const table of tables) {
      const m = dv2Metadata.get(table.id)!
      if (m.entityType === 'satellite') {
        for (const ref of refs) {
          if (ref.fromTable === table.id) {
            const targetMeta = dv2Metadata.get(ref.toTable)
            if (targetMeta && (targetMeta.entityType === 'hub' || targetMeta.entityType === 'link')) {
              m.parentHubs.push(ref.toTable)
            }
          }
        }
      } else if (m.entityType === 'link') {
        for (const ref of refs) {
          if (ref.fromTable === table.id) {
            const targetMeta = dv2Metadata.get(ref.toTable)
            if (targetMeta && targetMeta.entityType === 'hub') {
              m.linkedHubs.push(ref.toTable)
            }
          }
        }
      }
    }

    // Extract project metadata
    const proj = (exported as any).project
    const projectMeta: ProjectMeta | null = proj ? {
      name: proj.name || undefined,
      databaseType: proj.database_type || undefined,
      note: proj.note || undefined,
    } : null

    return { tables, refs, enums, stickyNotes, errors: [], projectMeta, dv2Metadata }
  } catch (err) {
    const diags = (err as any)?.diags
    const message = Array.isArray(diags) && diags.length > 0
      ? diags.map((d: any) => d.message).join('; ')
      : (err as any)?.message ?? String(err)
    return { tables: [], refs: [], enums: [], stickyNotes: [], errors: [message], projectMeta: null, dv2Metadata: new Map() }
  }
}
