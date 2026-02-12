export type DV2ColumnRole = 'hk' | 'bk' | 'mak' | 'dk'

export interface ColumnInfo {
  name: string
  type: string
  isPrimaryKey: boolean
  isForeignKey: boolean
  isNotNull: boolean
  isUnique: boolean
  defaultValue?: string
  note?: string
  dv2Role?: DV2ColumnRole
  isInjected?: boolean
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

export interface StickyNoteInfo {
  id: string
  name: string
  content: string
  headerColor?: string
}

// --- DV2.0 Entity Classification ---

export type DV2EntityType = 'hub' | 'satellite' | 'link' | 'reference'

export interface DV2Metadata {
  entityType: DV2EntityType
  parentHubs: string[]
  linkedHubs: string[]
}

// --- Validation ---

export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  severity: ValidationSeverity
  rule: string
  message: string
  tableId?: string
  columnName?: string
}

export interface ModelStats {
  hubCount: number
  satelliteCount: number
  linkCount: number
  otherCount: number
  totalColumns: number
  orphanHubs: string[]
  orphanSatellites: string[]
  hubToSatRatio: number
}

export interface ValidationResult {
  issues: ValidationIssue[]
  stats: ModelStats
}

// --- Project Metadata ---

export interface ProjectMeta {
  name?: string
  databaseType?: string
  note?: string
}

// --- Search ---

export interface SearchMatch {
  type: 'table' | 'column' | 'note'
  tableId: string
  columnName?: string
  matchText: string
}

// --- Parse Result ---

export interface ParseResult {
  tables: TableInfo[]
  refs: RefInfo[]
  enums: EnumInfo[]
  stickyNotes: StickyNoteInfo[]
  errors: string[]
  projectMeta: ProjectMeta | null
  dv2Metadata: Map<string, DV2Metadata>
}

export interface SavedProject {
  id: string
  name: string
  dbml: string
  updatedAt: number
}

// --- Version History ---

export interface CommitInfo {
  oid: string
  message: string
  timestamp: number
}

// --- Source Configuration (DataVault4dbt) ---

export interface SourceMapping {
  sourceName: string
  tableName: string
  ldtsColumn: string
  rsrcValue: string
  columnMapping?: Record<string, string>
}

export type SourceConfig = Record<string, SourceMapping>

export interface DbtProjectInfo {
  found: boolean
  projectName?: string
  modelPaths?: string[]
  projectDir?: string
}

export interface GeneratedFile {
  path: string
  content: string
}
