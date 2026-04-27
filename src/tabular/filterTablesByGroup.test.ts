import { describe, it, expect } from 'vitest'
import { filterTablesByGroup, listGroups, UNGROUPED } from './filterTablesByGroup'
import type { TableInfo } from '../types'

function t(name: string, group?: string): TableInfo {
  return {
    id: `public.${name}`,
    schema: 'public',
    name,
    columns: [],
    group,
  }
}

describe('filterTablesByGroup', () => {
  const tables: TableInfo[] = [
    t('h_customer', 'raw_vault'),
    t('s_customer', 'raw_vault'),
    t('rep_sales'),
    t('dim_date', 'mart'),
  ]

  it('returns all tables when filter is null', () => {
    expect(filterTablesByGroup(tables, null)).toHaveLength(4)
  })

  it('filters by group name', () => {
    const result = filterTablesByGroup(tables, 'raw_vault')
    expect(result.map((x) => x.name)).toEqual(['h_customer', 's_customer'])
  })

  it('filters ungrouped tables via the UNGROUPED sentinel', () => {
    const result = filterTablesByGroup(tables, UNGROUPED)
    expect(result.map((x) => x.name)).toEqual(['rep_sales'])
  })

  it('returns empty when group not found', () => {
    expect(filterTablesByGroup(tables, 'nonexistent')).toEqual([])
  })
})

describe('listGroups', () => {
  const tables: TableInfo[] = [
    t('h_customer', 'raw_vault'),
    t('s_customer', 'raw_vault'),
    t('rep_sales'),
    t('dim_date', 'mart'),
  ]

  it('returns sorted unique group names plus the ungrouped marker when present', () => {
    expect(listGroups(tables)).toEqual(['mart', 'raw_vault', UNGROUPED])
  })

  it('omits the ungrouped marker when every table has a group', () => {
    const grouped = tables.filter((x) => x.group)
    expect(listGroups(grouped)).toEqual(['mart', 'raw_vault'])
  })

  it('returns an empty list when there are no tables', () => {
    expect(listGroups([])).toEqual([])
  })
})
