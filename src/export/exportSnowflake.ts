import type { ParseResult } from '../types'

export interface SnowflakeExportOptions {
  clusterByHashKeys?: boolean // default true
}

const typeMap: Record<string, string> = {
  integer: 'NUMBER(38,0)',
  int: 'NUMBER(38,0)',
  bigint: 'NUMBER(38,0)',
  smallint: 'NUMBER(38,0)',
  serial: 'NUMBER(38,0)',
  varchar: 'VARCHAR',
  char: 'VARCHAR',
  text: 'VARCHAR',
  boolean: 'BOOLEAN',
  bool: 'BOOLEAN',
  date: 'DATE',
  datetime: 'TIMESTAMP_NTZ',
  timestamp: 'TIMESTAMP_NTZ',
  time: 'TIME',
  float: 'FLOAT',
  double: 'FLOAT',
  real: 'FLOAT',
  decimal: 'NUMBER(38,6)',
  numeric: 'NUMBER(38,6)',
  binary: 'BINARY',
  varbinary: 'BINARY',
  bytea: 'BINARY',
  json: 'VARIANT',
  jsonb: 'VARIANT',
  uuid: 'VARCHAR(36)',
}

function mapType(dbmlType: string): string {
  return typeMap[dbmlType.toLowerCase()] ?? dbmlType
}

export function exportSnowflakeDDL(
  result: ParseResult,
  options?: SnowflakeExportOptions,
): string {
  const clusterByHashKeys = options?.clusterByHashKeys ?? true
  const statements: string[] = []

  // 1. Collect unique schemas
  const schemas = new Set<string>()
  for (const t of result.tables) {
    if (t.schema && t.schema !== 'public') schemas.add(t.schema)
  }
  for (const schema of schemas) {
    statements.push(`CREATE SCHEMA IF NOT EXISTS ${schema};`)
  }

  // 2. Topological sort via Kahn's algorithm
  const tableById = new Map(result.tables.map((t) => [t.id, t]))
  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>() // dependency -> dependents
  for (const t of result.tables) {
    inDeg.set(t.id, 0)
    adj.set(t.id, [])
  }
  for (const ref of result.refs) {
    // source table depends on target table (FK source references target)
    if (tableById.has(ref.fromTable) && tableById.has(ref.toTable)) {
      inDeg.set(ref.fromTable, (inDeg.get(ref.fromTable) ?? 0) + 1)
      adj.get(ref.toTable)!.push(ref.fromTable)
    }
  }
  const queue: string[] = []
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id)
  }
  const sorted: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(id)
    for (const dep of adj.get(id) ?? []) {
      const newDeg = (inDeg.get(dep) ?? 1) - 1
      inDeg.set(dep, newDeg)
      if (newDeg === 0) queue.push(dep)
    }
  }
  // Add any remaining tables (cycles) at the end
  for (const t of result.tables) {
    if (!sorted.includes(t.id)) sorted.push(t.id)
  }

  // Build ref lookup: source table id -> refs from that table
  const refsBySource = new Map<string, typeof result.refs>()
  for (const ref of result.refs) {
    const list = refsBySource.get(ref.fromTable) ?? []
    list.push(ref)
    refsBySource.set(ref.fromTable, list)
  }

  // 3. Generate DDL for each table
  for (const tableId of sorted) {
    const table = tableById.get(tableId)
    if (!table) continue
    const qualName = table.schema && table.schema !== 'public'
      ? `${table.schema}.${table.name}`
      : table.name

    const colLines: string[] = []
    const pkCols: string[] = []

    for (const col of table.columns) {
      const sfType = mapType(col.type)
      const notNull = col.isNotNull || col.isPrimaryKey ? ' NOT NULL' : ''
      colLines.push(`    ${col.name} ${sfType}${notNull}`)
      if (col.isPrimaryKey) pkCols.push(col.name)
    }

    // PK constraint
    if (pkCols.length > 0) {
      colLines.push(`    CONSTRAINT pk_${table.name} PRIMARY KEY (${pkCols.join(', ')})`)
    }

    // FK constraints
    const tableRefs = refsBySource.get(table.id) ?? []
    for (const ref of tableRefs) {
      const toTable = tableById.get(ref.toTable)
      if (!toTable) continue
      const toQualName = toTable.schema && toTable.schema !== 'public'
        ? `${toTable.schema}.${toTable.name}`
        : toTable.name
      const fkName = `fk_${table.name}_${ref.fromColumns[0]}`
      colLines.push(
        `    CONSTRAINT ${fkName} FOREIGN KEY (${ref.fromColumns.join(', ')}) REFERENCES ${toQualName} (${ref.toColumns.join(', ')})`,
      )
    }

    statements.push(`CREATE TABLE IF NOT EXISTS ${qualName} (\n${colLines.join(',\n')}\n);`)

    // Cluster by hash key columns
    if (clusterByHashKeys) {
      const hkCols = pkCols.filter((c) => c.startsWith('hk_'))
      if (hkCols.length > 0) {
        statements.push(`ALTER TABLE ${qualName} CLUSTER BY (${hkCols.join(', ')});`)
      }
    }
  }

  return statements.join('\n\n')
}
