import { Parser } from '@dbml/core'
import type { ParseResult, StickyNoteInfo } from '../types'

export function parseDbml(source: string): ParseResult {
  try {
    const database = Parser.parse(source, 'dbml')
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

    const tables = exported.schemas.flatMap((schema) => {
      const schemaName = schema.name || 'public'
      return schema.tables.map((table) => {
        const tableId = `${schemaName}.${table.name}`
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

    return { tables, refs, enums, stickyNotes, errors: [] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { tables: [], refs: [], enums: [], stickyNotes: [], errors: [message] }
  }
}
