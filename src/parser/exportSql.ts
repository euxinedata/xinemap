import { exporter } from '@dbml/core'

export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'oracle'

export function exportSql(dbmlSource: string, dialect: SqlDialect): string {
  return exporter.export(dbmlSource, dialect)
}
