import type { ParseResult, SourceConfig, GeneratedFile, TableInfo, ColumnInfo } from '../types'

const SYSTEM_COLUMNS = new Set(['load_date', 'record_source', 'hash_diff'])

function isSysCol(col: ColumnInfo): boolean {
  if (col.isInjected) return true
  if (col.dv2Role === 'hk') return true
  return SYSTEM_COLUMNS.has(col.name) || col.name.startsWith('hk_')
}

function getHashKey(table: TableInfo): string | null {
  const byRole = table.columns.find((c) => c.dv2Role === 'hk' && c.isPrimaryKey)
  if (byRole) return byRole.name
  const byName = table.columns.find((c) => c.isPrimaryKey && c.name.startsWith('hk_'))
  return byName?.name ?? null
}

function getBusinessKeys(table: TableInfo): string[] {
  const byRole = table.columns.filter((c) => c.dv2Role === 'bk')
  if (byRole.length > 0) return byRole.map((c) => c.name)
  return table.columns.filter((c) => !isSysCol(c)).map((c) => c.name)
}

function getPayloadColumns(table: TableInfo): string[] {
  return table.columns.filter((c) => !isSysCol(c)).map((c) => c.name)
}

function getParentHashKey(table: TableInfo): string | null {
  // By role: any hk-annotated column (satellites typically have one)
  const byRole = table.columns.find((c) => c.dv2Role === 'hk')
  if (byRole) return byRole.name
  // Fallback: non-PK hk_ column, or PK hk_ if no non-PK exists
  const nonPk = table.columns.find((c) => c.name.startsWith('hk_') && !c.isPrimaryKey)
  if (nonPk) return nonPk.name
  const pk = table.columns.find((c) => c.name.startsWith('hk_') && c.isPrimaryKey)
  return pk?.name ?? null
}

function getForeignHashKeys(table: TableInfo): string[] {
  const pk = getHashKey(table)
  // By role: all hk-annotated columns except the PK
  const byRole = table.columns.filter((c) => c.dv2Role === 'hk' && c.name !== pk)
  if (byRole.length > 0) return byRole.map((c) => c.name)
  // Fallback: hk_ prefix columns except the PK
  return table.columns
    .filter((c) => c.name.startsWith('hk_') && c.name !== pk)
    .map((c) => c.name)
}

function generateStaging(
  hub: TableInfo,
  satellites: TableInfo[],
  sourceName: string,
  tableName: string,
  ldtsColumn: string,
  rsrcValue: string,
): string {
  const hashKey = getHashKey(hub)
  const businessKeys = getBusinessKeys(hub)

  const lines: string[] = []
  lines.push(`{{ config(materialized='view') }}`)
  lines.push('')
  lines.push(`{%- set yaml_metadata -%}`)
  lines.push(`source_model:`)
  lines.push(`    source_name: '${sourceName}'`)
  lines.push(`    table_name: '${tableName}'`)
  lines.push(`ldts: '${ldtsColumn}'`)
  lines.push(`rsrc: '${rsrcValue}'`)
  lines.push(`hashed_columns:`)

  // Hub hashkey
  if (hashKey) {
    lines.push(`    ${hashKey}:`)
    for (const bk of businessKeys) {
      lines.push(`        - ${bk}`)
    }
  }

  // Satellite hashdiffs
  for (const sat of satellites) {
    const payload = getPayloadColumns(sat)
    if (payload.length === 0) continue
    const hdName = `hd_${sat.name.toLowerCase()}`
    lines.push(`    ${hdName}:`)
    lines.push(`        is_hashdiff: true`)
    lines.push(`        columns:`)
    for (const col of payload) {
      lines.push(`            - ${col}`)
    }
  }

  lines.push(`{%- endset -%}`)
  lines.push('')
  lines.push(`{{ datavault4dbt.stage(yaml_metadata=yaml_metadata) }}`)

  return lines.join('\n')
}

function generateHub(
  hub: TableInfo,
  stagingModelName: string,
): string {
  const hashKey = getHashKey(hub)
  const businessKeys = getBusinessKeys(hub)

  const lines: string[] = []
  lines.push(`{{ config(materialized='incremental') }}`)
  lines.push('')
  lines.push(`{%- set yaml_metadata -%}`)
  lines.push(`hashkey: '${hashKey}'`)
  lines.push(`business_keys:`)
  for (const bk of businessKeys) {
    lines.push(`    - ${bk}`)
  }
  lines.push(`source_models: ${stagingModelName}`)
  lines.push(`{%- endset -%}`)
  lines.push('')
  lines.push(`{{ datavault4dbt.hub(yaml_metadata=yaml_metadata) }}`)

  return lines.join('\n')
}

function generateSatV0(
  sat: TableInfo,
  stagingModelName: string,
): string {
  const parentHk = getParentHashKey(sat)
  const hdName = `hd_${sat.name.toLowerCase()}`
  const payload = getPayloadColumns(sat)

  const lines: string[] = []
  lines.push(`{{ config(materialized='incremental') }}`)
  lines.push('')
  lines.push(`{%- set yaml_metadata -%}`)
  lines.push(`parent_hashkey: '${parentHk}'`)
  lines.push(`src_hashdiff: '${hdName}'`)
  lines.push(`src_payload:`)
  for (const col of payload) {
    lines.push(`    - ${col}`)
  }
  lines.push(`source_model: '${stagingModelName}'`)
  lines.push(`{%- endset -%}`)
  lines.push('')
  lines.push(`{{ datavault4dbt.sat_v0(yaml_metadata=yaml_metadata) }}`)

  return lines.join('\n')
}

function generateLink(
  link: TableInfo,
  stagingModelName: string,
): string {
  const linkHk = getHashKey(link)
  const foreignHks = getForeignHashKeys(link)

  const lines: string[] = []
  lines.push(`{{ config(materialized='incremental') }}`)
  lines.push('')
  lines.push(`{%- set yaml_metadata -%}`)
  lines.push(`link_hashkey: '${linkHk}'`)
  lines.push(`foreign_hashkeys:`)
  for (const fk of foreignHks) {
    lines.push(`    - '${fk}'`)
  }
  lines.push(`source_models: ${stagingModelName}`)
  lines.push(`{%- endset -%}`)
  lines.push('')
  lines.push(`{{ datavault4dbt.link(yaml_metadata=yaml_metadata) }}`)

  return lines.join('\n')
}

export function generateDV4dbt(
  result: ParseResult,
  sourceConfig: SourceConfig,
): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const metaById = result.dv2Metadata

  // Classify entities
  const hubs: TableInfo[] = []
  const satellites: TableInfo[] = []
  const links: TableInfo[] = []

  for (const table of result.tables) {
    const meta = metaById.get(table.id)
    if (!meta) continue
    if (meta.entityType === 'hub') hubs.push(table)
    else if (meta.entityType === 'satellite') satellites.push(table)
    else if (meta.entityType === 'link') links.push(table)
  }

  // Build hub → satellites map
  const hubSatellites = new Map<string, TableInfo[]>()
  for (const hub of hubs) {
    hubSatellites.set(hub.id, [])
  }
  for (const sat of satellites) {
    const meta = metaById.get(sat.id)!
    for (const parentId of meta.parentHubs) {
      const parentMeta = metaById.get(parentId)
      if (parentMeta?.entityType === 'hub') {
        const list = hubSatellites.get(parentId) ?? []
        list.push(sat)
        hubSatellites.set(parentId, list)
      }
    }
  }

  // Generate files for each configured hub
  for (const hub of hubs) {
    const mapping = sourceConfig[hub.id]
    if (!mapping) continue

    const stagingName = `stage_${mapping.tableName}`
    const hubSats = hubSatellites.get(hub.id) ?? []

    // Staging model
    files.push({
      path: `staging/${stagingName}.sql`,
      content: generateStaging(
        hub,
        hubSats,
        mapping.sourceName,
        mapping.tableName,
        mapping.ldtsColumn,
        mapping.rsrcValue,
      ),
    })

    // Hub model
    files.push({
      path: `hubs/${hub.name.toLowerCase()}.sql`,
      content: generateHub(hub, stagingName),
    })

    // Satellite models
    for (const sat of hubSats) {
      files.push({
        path: `satellites/${sat.name.toLowerCase()}.sql`,
        content: generateSatV0(sat, stagingName),
      })
    }
  }

  // Generate link models
  for (const link of links) {
    const mapping = sourceConfig[link.id]
    let stagingName: string
    if (mapping) {
      stagingName = `stage_${mapping.tableName}`

      const linkSats = satellites.filter((sat) => {
        const meta = metaById.get(sat.id)!
        return meta.parentHubs.some((pid) => {
          const pm = metaById.get(pid)
          return pm?.entityType === 'link' && pid === link.id
        })
      })

      files.push({
        path: `staging/${stagingName}.sql`,
        content: generateStaging(
          link,
          linkSats,
          mapping.sourceName,
          mapping.tableName,
          mapping.ldtsColumn,
          mapping.rsrcValue,
        ),
      })
    } else {
      const meta = metaById.get(link.id)!
      const firstHub = meta.linkedHubs.find((hid) => sourceConfig[hid])
      if (!firstHub) continue
      const hubMapping = sourceConfig[firstHub]
      stagingName = `stage_${hubMapping.tableName}`
    }

    files.push({
      path: `links/${link.name.toLowerCase()}.sql`,
      content: generateLink(link, stagingName),
    })
  }

  return files
}
