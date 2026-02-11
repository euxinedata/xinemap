import { describe, it, expect } from 'vitest'
import { generateDV4dbt } from './exportDV4dbt'
import type { ParseResult, SourceConfig, TableInfo, DV2Metadata } from '../types'

function col(name: string, opts: Partial<{ pk: boolean; fk: boolean }> = {}) {
  return {
    name,
    type: 'VARCHAR',
    isPrimaryKey: opts.pk ?? false,
    isForeignKey: opts.fk ?? false,
    isNotNull: false,
    isUnique: false,
  }
}

function makeResult(
  tables: TableInfo[],
  metadata: Map<string, DV2Metadata>,
): ParseResult {
  return {
    tables,
    refs: [],
    enums: [],
    stickyNotes: [],
    errors: [],
    projectMeta: null,
    dv2Metadata: metadata,
  }
}

describe('generateDV4dbt', () => {
  const hub: TableInfo = {
    id: 'hub1',
    schema: '',
    name: 'customer_h',
    columns: [
      col('hk_customer', { pk: true }),
      col('customer_id'),
      col('customer_name'),
      col('load_date'),
      col('record_source'),
    ],
  }

  const sat: TableInfo = {
    id: 'sat1',
    schema: '',
    name: 'sat_customer_details',
    columns: [
      col('hk_customer', { fk: true }),
      col('hash_diff'),
      col('first_name'),
      col('last_name'),
      col('load_date'),
      col('record_source'),
    ],
  }

  const hub2: TableInfo = {
    id: 'hub2',
    schema: '',
    name: 'order_h',
    columns: [
      col('hk_order', { pk: true }),
      col('order_id'),
      col('load_date'),
      col('record_source'),
    ],
  }

  const link: TableInfo = {
    id: 'link1',
    schema: '',
    name: 'lnk_customer_order',
    columns: [
      col('hk_customer_order', { pk: true }),
      col('hk_customer'),
      col('hk_order'),
      col('load_date'),
      col('record_source'),
    ],
  }

  const metadata = new Map<string, DV2Metadata>([
    ['hub1', { entityType: 'hub', parentHubs: [], linkedHubs: [] }],
    ['sat1', { entityType: 'satellite', parentHubs: ['hub1'], linkedHubs: [] }],
    ['hub2', { entityType: 'hub', parentHubs: [], linkedHubs: [] }],
    ['link1', { entityType: 'link', parentHubs: [], linkedHubs: ['hub1', 'hub2'] }],
  ])

  const sourceConfig: SourceConfig = {
    hub1: {
      sourceName: 'raw',
      tableName: 'customer',
      ldtsColumn: 'load_datetime',
      rsrcValue: '!CRM/Customers',
    },
  }

  it('returns empty when no source config', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, {})
    expect(files).toEqual([])
  })

  it('generates staging, hub, and satellite for configured hub', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)

    const paths = files.map((f) => f.path)
    expect(paths).toContain('staging/stage_customer.sql')
    expect(paths).toContain('hubs/customer_h.sql')
    expect(paths).toContain('satellites/sat_customer_details.sql')
  })

  it('staging model contains correct source metadata', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)
    const staging = files.find((f) => f.path === 'staging/stage_customer.sql')!

    expect(staging.content).toContain("source_name: 'raw'")
    expect(staging.content).toContain("table_name: 'customer'")
    expect(staging.content).toContain("ldts: 'load_datetime'")
    expect(staging.content).toContain("rsrc: '!CRM/Customers'")
    expect(staging.content).toContain('datavault4dbt.stage')
  })

  it('staging model contains hashed_columns for hub hashkey', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)
    const staging = files.find((f) => f.path === 'staging/stage_customer.sql')!

    expect(staging.content).toContain('hk_customer:')
    expect(staging.content).toContain('- customer_id')
    expect(staging.content).toContain('- customer_name')
  })

  it('staging model contains hashdiff for satellite', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)
    const staging = files.find((f) => f.path === 'staging/stage_customer.sql')!

    expect(staging.content).toContain('hd_sat_customer_details:')
    expect(staging.content).toContain('is_hashdiff: true')
    expect(staging.content).toContain('- first_name')
    expect(staging.content).toContain('- last_name')
  })

  it('hub model has correct hashkey and business keys', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)
    const hubFile = files.find((f) => f.path === 'hubs/customer_h.sql')!

    expect(hubFile.content).toContain("hashkey: 'hk_customer'")
    expect(hubFile.content).toContain('- customer_id')
    expect(hubFile.content).toContain('- customer_name')
    expect(hubFile.content).toContain('source_models: stage_customer')
    expect(hubFile.content).toContain('datavault4dbt.hub')
  })

  it('satellite model has correct parent hashkey and payload', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)
    const satFile = files.find((f) => f.path === 'satellites/sat_customer_details.sql')!

    expect(satFile.content).toContain("parent_hashkey: 'hk_customer'")
    expect(satFile.content).toContain("src_hashdiff: 'hd_sat_customer_details'")
    expect(satFile.content).toContain('- first_name')
    expect(satFile.content).toContain('- last_name')
    expect(satFile.content).toContain("source_model: 'stage_customer'")
    expect(satFile.content).toContain('datavault4dbt.sat_v0')
  })

  it('link model derives staging from configured hub', () => {
    const result = makeResult([hub, hub2, link, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)
    const linkFile = files.find((f) => f.path === 'links/lnk_customer_order.sql')!

    expect(linkFile.content).toContain("link_hashkey: 'hk_customer_order'")
    expect(linkFile.content).toContain("- 'hk_customer'")
    expect(linkFile.content).toContain("- 'hk_order'")
    expect(linkFile.content).toContain('source_models: stage_customer')
    expect(linkFile.content).toContain('datavault4dbt.link')
  })

  it('link with own source config generates its own staging', () => {
    const configWithLink: SourceConfig = {
      ...sourceConfig,
      link1: {
        sourceName: 'raw',
        tableName: 'customer_order',
        ldtsColumn: 'load_datetime',
        rsrcValue: '!CRM/Orders',
      },
    }
    const result = makeResult([hub, hub2, link, sat], metadata)
    const files = generateDV4dbt(result, configWithLink)

    const paths = files.map((f) => f.path)
    expect(paths).toContain('staging/stage_customer_order.sql')
    expect(paths).toContain('links/lnk_customer_order.sql')

    const linkStaging = files.find((f) => f.path === 'staging/stage_customer_order.sql')!
    expect(linkStaging.content).toContain("rsrc: '!CRM/Orders'")
  })

  it('skips unconfigured hubs', () => {
    const result = makeResult([hub, hub2, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)

    const paths = files.map((f) => f.path)
    expect(paths).not.toContain('hubs/order_h.sql')
  })

  it('skips link when no linked hub has config', () => {
    const noHubConfig: SourceConfig = {}
    const result = makeResult([hub, hub2, link], metadata)
    const files = generateDV4dbt(result, noHubConfig)

    expect(files).toEqual([])
  })

  it('all models use incremental materialization except staging', () => {
    const result = makeResult([hub, sat], metadata)
    const files = generateDV4dbt(result, sourceConfig)

    const staging = files.find((f) => f.path.startsWith('staging/'))!
    expect(staging.content).toContain("materialized='view'")

    const nonStaging = files.filter((f) => !f.path.startsWith('staging/'))
    for (const f of nonStaging) {
      expect(f.content).toContain("materialized='incremental'")
    }
  })
})
