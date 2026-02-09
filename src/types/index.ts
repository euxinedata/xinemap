export interface ColumnInfo {
  name: string
  type: string
  isPrimaryKey: boolean
  isForeignKey: boolean
  isNotNull: boolean
  isUnique: boolean
  defaultValue?: string
  note?: string
}

export interface TableInfo {
  id: string
  schema: string
  name: string
  columns: ColumnInfo[]
  headerColor?: string
  note?: string
  group?: string
}

export interface RefInfo {
  id: string
  fromTable: string
  fromColumns: string[]
  toTable: string
  toColumns: string[]
  type: '1-1' | '1-n' | 'n-1' | 'n-n'
  color?: string
}

export interface EnumInfo {
  id: string
  schema: string
  name: string
  values: { name: string; note?: string }[]
}

export interface ParseResult {
  tables: TableInfo[]
  refs: RefInfo[]
  enums: EnumInfo[]
  errors: string[]
}

export interface SavedProject {
  id: string
  name: string
  dbml: string
  updatedAt: number
}
