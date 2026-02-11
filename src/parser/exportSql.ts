import { exporter } from '@dbml/core'

export type SqlDialect = 'postgres' | 'mysql' | 'mssql' | 'oracle' | 'snowflake'

type CoreDialect = Exclude<SqlDialect, 'snowflake'>

export function exportSql(dbmlSource: string, dialect: CoreDialect): string {
  return exporter.export(dbmlSource, dialect)
}
