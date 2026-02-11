export type ScaffoldType = 'hub' | 'satellite' | 'link'

export function generateScaffold(
  type: ScaffoldType,
  name: string,
  parentHub?: string,
  hubs?: string[],
): string {
  switch (type) {
    case 'hub': {
      const hk = `hk_${name.toLowerCase()}`
      return [
        `Table ${name} {`,
        `  ${hk} binary [pk, note: 'hash key']`,
        `  load_date timestamp [not null]`,
        `  record_source varchar [not null]`,
        `  // TODO: add business key columns`,
        `}`,
      ].join('\n')
    }
    case 'satellite': {
      const hk = `hk_${(parentHub ?? name).toLowerCase()}`
      const lines = [
        `Table ${name} {`,
        `  ${hk} binary [pk]`,
        `  load_date timestamp [pk]`,
        `  hash_diff binary [not null]`,
        `  // TODO: add descriptive attributes`,
        `}`,
      ]
      if (parentHub) {
        lines.push('')
        lines.push(`Ref: ${name}.${hk} > ${parentHub}.${hk}`)
      }
      return lines.join('\n')
    }
    case 'link': {
      const hubList = hubs ?? []
      const hk = `hk_${name.toLowerCase()}`
      const lines = [
        `Table ${name} {`,
        `  ${hk} binary [pk, note: 'hash key']`,
      ]
      for (const hub of hubList) {
        lines.push(`  hk_${hub.toLowerCase()} binary [not null]`)
      }
      lines.push(`  load_date timestamp [not null]`)
      lines.push(`  record_source varchar [not null]`)
      lines.push(`}`)
      for (const hub of hubList) {
        const hubHk = `hk_${hub.toLowerCase()}`
        lines.push('')
        lines.push(`Ref: ${name}.${hubHk} > ${hub}.${hubHk}`)
      }
      return lines.join('\n')
    }
  }
}
