import type {
  AppConfig,
  Column,
  Connection,
  ContextFormat,
  DbType,
  ForeignKey,
  Group,
  LayoutType,
  SchemaData,
  SchemaTable,
  TablePosition,
  WorkspaceState,
} from '../../types'

const DEFAULT_CONNECTION_TYPE: DbType = 'sqlserver'
export const DEFAULT_WORKSPACE_STATE: WorkspaceState = {
  selectedTables: [],
  hiddenGroups: [],
  hiddenTables: [],
  format: 'condensed',
  layoutType: 'dagre',
  compactNodes: false,
  tablePositions: {},
}

export function normalizeDbType(value: unknown): DbType {
  return value === 'postgres' || value === 'sqlite' || value === 'sqlserver'
    ? value
    : DEFAULT_CONNECTION_TYPE
}

export function normalizeLayoutType(value: unknown): LayoutType {
  return value === 'force' || value === 'elk' || value === 'dagre'
    ? value
    : DEFAULT_WORKSPACE_STATE.layoutType
}

export function normalizeFormat(value: unknown): ContextFormat {
  return value === 'ddl' || value === 'condensed'
    ? value
    : DEFAULT_WORKSPACE_STATE.format
}

export function uniqueStrings(values: unknown): string[] {
  if (!Array.isArray(values)) return []

  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .filter((value, index, array) => array.indexOf(value) === index)
}

export function normalizeConnection(input: Partial<Connection> & Pick<Connection, 'name' | 'connectionString'>): Connection {
  return {
    name: input.name,
    connectionString: input.connectionString,
    type: normalizeDbType(input.type),
    excludedSchemas: uniqueStrings(input.excludedSchemas),
    includedTables: uniqueStrings(input.includedTables),
    hideAllInitially: input.hideAllInitially ?? false,
  }
}

export function normalizeGroup(input: Partial<Group> & Pick<Group, 'id' | 'name' | 'color'>): Group {
  return {
    id: input.id,
    name: input.name,
    color: input.color,
    tables: uniqueStrings(input.tables),
  }
}

export function normalizeAppConfig(config: Partial<AppConfig>): AppConfig {
  const connections = Array.isArray(config.connections)
    ? config.connections
      .filter((connection): connection is Partial<Connection> & Pick<Connection, 'name' | 'connectionString'> =>
        !!connection &&
        typeof connection.name === 'string' &&
        typeof connection.connectionString === 'string'
      )
      .map(normalizeConnection)
    : []

  const groups = Array.isArray(config.groups)
    ? config.groups
      .filter((group): group is Partial<Group> & Pick<Group, 'id' | 'name' | 'color'> =>
        !!group &&
        typeof group.id === 'string' &&
        typeof group.name === 'string' &&
        typeof group.color === 'string'
      )
      .map(normalizeGroup)
    : []

  return { connections, groups }
}

export function normalizeTablePositions(value: unknown): Record<string, TablePosition> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries = Object.entries(value).flatMap(([tableId, position]) => {
    if (!position || typeof position !== 'object' || Array.isArray(position)) return []

    const x = (position as { x?: unknown }).x
    const y = (position as { y?: unknown }).y

    if (typeof x !== 'number' || typeof y !== 'number') return []
    return [[tableId, { x, y } satisfies TablePosition]]
  })

  return Object.fromEntries(entries)
}

export function normalizeWorkspaceState(state: Partial<WorkspaceState>): WorkspaceState {
  return {
    selectedTables: uniqueStrings(state.selectedTables),
    hiddenGroups: uniqueStrings(state.hiddenGroups),
    hiddenTables: uniqueStrings(state.hiddenTables),
    format: normalizeFormat(state.format),
    layoutType: normalizeLayoutType(state.layoutType),
    compactNodes: state.compactNodes ?? false,
    tablePositions: normalizeTablePositions(state.tablePositions),
  }
}

export function normalizeColumn(input: Partial<Column> & Pick<Column, 'name' | 'dataType'>): Column {
  return {
    name: input.name,
    dataType: input.dataType,
    maxLength: typeof input.maxLength === 'number' ? input.maxLength : null,
    numericPrecision: typeof input.numericPrecision === 'number' ? input.numericPrecision : null,
    numericScale: typeof input.numericScale === 'number' ? input.numericScale : null,
    isNullable: input.isNullable ?? false,
    isPK: input.isPK ?? false,
    isFK: input.isFK ?? false,
    referencesTable: typeof input.referencesTable === 'string' ? input.referencesTable : null,
    referencesColumn: typeof input.referencesColumn === 'string' ? input.referencesColumn : null,
  }
}

export function normalizeSchemaTable(input: Partial<SchemaTable> & Pick<SchemaTable, 'schema' | 'name'>): SchemaTable {
  const columns = Array.isArray(input.columns)
    ? input.columns
      .filter((column): column is Partial<Column> & Pick<Column, 'name' | 'dataType'> =>
        !!column &&
        typeof column.name === 'string' &&
        typeof column.dataType === 'string'
      )
      .map(normalizeColumn)
    : []

  return {
    schema: input.schema,
    name: input.name,
    columns,
  }
}

export function normalizeForeignKey(input: Partial<ForeignKey> & Pick<ForeignKey, 'parentTable' | 'parentColumn' | 'referencedTable' | 'referencedColumn'>): ForeignKey {
  return {
    parentTable: input.parentTable,
    parentColumn: input.parentColumn,
    referencedTable: input.referencedTable,
    referencedColumn: input.referencedColumn,
  }
}

export function normalizeSchemaData(input: Partial<SchemaData>): SchemaData {
  const tables = Array.isArray(input.tables)
    ? input.tables
      .filter((table): table is Partial<SchemaTable> & Pick<SchemaTable, 'schema' | 'name'> =>
        !!table &&
        typeof table.schema === 'string' &&
        typeof table.name === 'string'
      )
      .map(normalizeSchemaTable)
    : []

  const foreignKeys = Array.isArray(input.foreignKeys)
    ? input.foreignKeys
      .filter((fk): fk is Partial<ForeignKey> & Pick<ForeignKey, 'parentTable' | 'parentColumn' | 'referencedTable' | 'referencedColumn'> =>
        !!fk &&
        typeof fk.parentTable === 'string' &&
        typeof fk.parentColumn === 'string' &&
        typeof fk.referencedTable === 'string' &&
        typeof fk.referencedColumn === 'string'
      )
      .map(normalizeForeignKey)
    : []

  return { tables, foreignKeys }
}

export function parseStoredList(json: string): string[] {
  try {
    return uniqueStrings(JSON.parse(json) as unknown)
  } catch {
    return []
  }
}

export function parseWorkspaceState(json: string): WorkspaceState {
  try {
    return normalizeWorkspaceState(JSON.parse(json) as Partial<WorkspaceState>)
  } catch {
    return { ...DEFAULT_WORKSPACE_STATE, tablePositions: {} }
  }
}

export function parseSchemaData(json: string): SchemaData {
  try {
    return normalizeSchemaData(JSON.parse(json) as Partial<SchemaData>)
  } catch {
    return { tables: [], foreignKeys: [] }
  }
}
