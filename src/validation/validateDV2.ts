import type { ParseResult, ValidationResult, ValidationIssue, ModelStats, TableInfo, ColumnInfo, DV2Metadata } from '../types'

const SYSTEM_COLUMNS = new Set(['load_date', 'record_source', 'hash_diff'])

function isSystemCol(col: ColumnInfo): boolean {
  if (col.isInjected) return true
  return SYSTEM_COLUMNS.has(col.name) || col.name.startsWith('hk_')
}

function hasHashKey(table: TableInfo): boolean {
  return table.columns.some((c) => c.dv2Role === 'hk') ||
         table.columns.some((c) => c.isPrimaryKey && c.name.startsWith('hk_'))
}

function hasBusinessKey(table: TableInfo): boolean {
  return table.columns.some((c) => c.dv2Role === 'bk') ||
         table.columns.some((c) => !isSystemCol(c))
}

function hasParentHk(table: TableInfo): boolean {
  return table.columns.some((c) => c.dv2Role === 'hk') ||
         table.columns.some((c) => c.name.startsWith('hk_'))
}

function hasInjectedColumns(table: TableInfo): boolean {
  return table.columns.some((c) => c.isInjected)
}

function hasColumn(table: TableInfo, name: string): boolean {
  return table.columns.some((c) => c.name === name)
}

export function validateDV2(result: ParseResult): ValidationResult {
  const issues: ValidationIssue[] = []
  const { tables, dv2Metadata } = result

  const meta = (id: string): DV2Metadata | undefined => dv2Metadata.get(id)
  const tableById = new Map(tables.map((t) => [t.id, t]))

  const hubs: TableInfo[] = []
  const satellites: TableInfo[] = []
  const links: TableInfo[] = []

  for (const table of tables) {
    const m = meta(table.id)
    if (!m) continue
    if (m.entityType === 'hub') hubs.push(table)
    else if (m.entityType === 'satellite') satellites.push(table)
    else if (m.entityType === 'link') links.push(table)
  }

  // Build set of hubs that have at least one satellite
  const hubsWithSatellite = new Set<string>()
  for (const sat of satellites) {
    const m = meta(sat.id)!
    for (const parentId of m.parentHubs) {
      const parentMeta = meta(parentId)
      if (parentMeta?.entityType === 'hub') hubsWithSatellite.add(parentId)
    }
  }

  // Build set of links that have at least one satellite
  const linksWithSatellite = new Set<string>()
  for (const sat of satellites) {
    const m = meta(sat.id)!
    for (const parentId of m.parentHubs) {
      const parentMeta = meta(parentId)
      if (parentMeta?.entityType === 'link') linksWithSatellite.add(parentId)
    }
  }

  // --- Structural (error) ---

  for (const hub of hubs) {
    if (!hubsWithSatellite.has(hub.id)) {
      issues.push({
        severity: 'error',
        rule: 'hub-needs-satellite',
        message: `Hub "${hub.name}" has no satellite referencing it`,
        tableId: hub.id,
      })
    }
  }

  for (const sat of satellites) {
    const m = meta(sat.id)!
    if (m.parentHubs.length === 0) {
      issues.push({
        severity: 'error',
        rule: 'satellite-needs-parent',
        message: `Satellite "${sat.name}" has no reference to a hub or link`,
        tableId: sat.id,
      })
    }
  }

  for (const link of links) {
    const m = meta(link.id)!
    const distinctHubs = new Set(m.linkedHubs)
    if (distinctHubs.size < 2) {
      issues.push({
        severity: 'error',
        rule: 'link-needs-two-hubs',
        message: `Link "${link.name}" must reference at least 2 distinct hubs (found ${distinctHubs.size})`,
        tableId: link.id,
      })
    }
  }

  // --- Structural (warning) ---

  for (const link of links) {
    if (!linksWithSatellite.has(link.id)) {
      issues.push({
        severity: 'warning',
        rule: 'link-needs-satellite',
        message: `Link "${link.name}" has no satellite`,
        tableId: link.id,
      })
    }
  }

  // --- Column (error) — Hubs ---

  for (const hub of hubs) {
    if (!hasHashKey(hub)) {
      issues.push({
        severity: 'error',
        rule: 'hub-needs-hash-key',
        message: `Hub "${hub.name}" must have a hash key (column with note **hk** or name starting with "hk_")`,
        tableId: hub.id,
      })
    }
    // System columns from partials satisfy load_date/record_source requirements
    if (!hasInjectedColumns(hub)) {
      if (!hasColumn(hub, 'load_date')) {
        issues.push({
          severity: 'error',
          rule: 'hub-needs-load-date',
          message: `Hub "${hub.name}" must have a "load_date" column`,
          tableId: hub.id,
        })
      }
      if (!hasColumn(hub, 'record_source')) {
        issues.push({
          severity: 'error',
          rule: 'hub-needs-record-source',
          message: `Hub "${hub.name}" must have a "record_source" column`,
          tableId: hub.id,
        })
      }
    }
    if (!hasBusinessKey(hub)) {
      issues.push({
        severity: 'error',
        rule: 'hub-needs-business-key',
        message: `Hub "${hub.name}" must have at least one business key column`,
        tableId: hub.id,
      })
    }
  }

  // --- Column (error) — Satellites ---

  for (const sat of satellites) {
    if (!hasInjectedColumns(sat)) {
      if (!hasColumn(sat, 'hash_diff')) {
        issues.push({
          severity: 'error',
          rule: 'sat-needs-hash-diff',
          message: `Satellite "${sat.name}" must have a "hash_diff" column`,
          tableId: sat.id,
        })
      }
      if (!hasColumn(sat, 'load_date')) {
        issues.push({
          severity: 'error',
          rule: 'sat-needs-load-date',
          message: `Satellite "${sat.name}" must have a "load_date" column`,
          tableId: sat.id,
        })
      }
    }
    if (!hasParentHk(sat)) {
      issues.push({
        severity: 'error',
        rule: 'sat-needs-parent-hk',
        message: `Satellite "${sat.name}" must have a hash key column (note **hk** or name starting with "hk_")`,
        tableId: sat.id,
      })
    }
  }

  // --- Column (error) — Links ---

  for (const link of links) {
    const m = meta(link.id)!
    if (!hasHashKey(link)) {
      issues.push({
        severity: 'error',
        rule: 'link-needs-hash-key',
        message: `Link "${link.name}" must have a hash key (column with note **hk** or name starting with "hk_")`,
        tableId: link.id,
      })
    }
    if (!hasInjectedColumns(link)) {
      if (!hasColumn(link, 'load_date')) {
        issues.push({
          severity: 'error',
          rule: 'link-needs-load-date',
          message: `Link "${link.name}" must have a "load_date" column`,
          tableId: link.id,
        })
      }
      if (!hasColumn(link, 'record_source')) {
        issues.push({
          severity: 'error',
          rule: 'link-needs-record-source',
          message: `Link "${link.name}" must have a "record_source" column`,
          tableId: link.id,
        })
      }
    }
    // link-needs-hub-hks: check that link has hash key columns for each referenced hub
    for (const hubId of m.linkedHubs) {
      const hubTable = tableById.get(hubId)
      if (!hubTable) continue
      // Find the hub's hash key (by role or by name)
      const hubHk = hubTable.columns.find((c) => c.dv2Role === 'hk') ??
                     hubTable.columns.find((c) => c.name.startsWith('hk_'))
      if (hubHk && !hasColumn(link, hubHk.name)) {
        issues.push({
          severity: 'error',
          rule: 'link-needs-hub-hks',
          message: `Link "${link.name}" is missing hash key column "${hubHk.name}" for hub "${hubTable.name}"`,
          tableId: link.id,
          columnName: hubHk.name,
        })
      }
    }
  }

  // --- Naming (warning) ---

  for (const hub of hubs) {
    const lower = hub.name.toLowerCase()
    if (lower.startsWith('sat_') || lower.startsWith('lnk_')) {
      issues.push({
        severity: 'warning',
        rule: 'naming-hub-prefix',
        message: `Hub "${hub.name}" has a misleading prefix`,
        tableId: hub.id,
      })
    }
  }

  for (const sat of satellites) {
    const lower = sat.name.toLowerCase()
    const group = sat.group?.toLowerCase() ?? ''
    if (!lower.startsWith('sat_') && !lower.startsWith('satm_') && !lower.startsWith('sate_') && !group.startsWith('sat')) {
      issues.push({
        severity: 'warning',
        rule: 'naming-sat-prefix',
        message: `Satellite "${sat.name}" name should start with "sat_" or be in a satellite group`,
        tableId: sat.id,
      })
    }
  }

  for (const link of links) {
    const lower = link.name.toLowerCase()
    const group = link.group?.toLowerCase() ?? ''
    if (!lower.startsWith('lnk_') && !lower.startsWith('link_') && !group.startsWith('link')) {
      issues.push({
        severity: 'warning',
        rule: 'naming-link-prefix',
        message: `Link "${link.name}" name should start with "lnk_" or "link_" or be in a link group`,
        tableId: link.id,
      })
    }
  }

  // --- Info ---

  for (const hub of hubs) {
    const descriptive = hub.columns.filter((c) => !isSystemCol(c))
    if (descriptive.length > 0) {
      issues.push({
        severity: 'info',
        rule: 'hub-no-descriptive-columns',
        message: `Hub "${hub.name}" has ${descriptive.length} column(s) beyond system columns: ${descriptive.map((c) => c.name).join(', ')}`,
        tableId: hub.id,
      })
    }
  }

  // --- Compute ModelStats ---

  const orphanHubs = hubs
    .filter((h) => !hubsWithSatellite.has(h.id))
    .map((h) => h.name)

  const orphanSatellites = satellites
    .filter((s) => meta(s.id)!.parentHubs.length === 0)
    .map((s) => s.name)

  const totalColumns = tables.reduce((sum, t) => sum + t.columns.length, 0)

  const stats: ModelStats = {
    hubCount: hubs.length,
    satelliteCount: satellites.length,
    linkCount: links.length,
    otherCount: tables.length - hubs.length - satellites.length - links.length,
    totalColumns,
    orphanHubs,
    orphanSatellites,
    hubToSatRatio: hubs.length > 0 ? satellites.length / hubs.length : 0,
  }

  return { issues, stats }
}
