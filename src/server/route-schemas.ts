import { t } from 'elysia'

export const DbTypeSchema = t.Union([
  t.Literal('sqlserver'),
  t.Literal('postgres'),
  t.Literal('sqlite'),
])

export const LayoutTypeSchema = t.Union([
  t.Literal('dagre'),
  t.Literal('force'),
  t.Literal('elk'),
])

export const ContextFormatSchema = t.Union([
  t.Literal('condensed'),
  t.Literal('ddl'),
])

export const TablePositionSchema = t.Object({
  x: t.Number(),
  y: t.Number(),
})

export const WorkspaceStateSchema = t.Object({
  selectedTables: t.Array(t.String()),
  hiddenGroups: t.Array(t.String()),
  hiddenTables: t.Array(t.String()),
  format: ContextFormatSchema,
  layoutType: LayoutTypeSchema,
  compactNodes: t.Boolean(),
  tablePositions: t.Record(t.String(), TablePositionSchema),
})

export const ColumnSchema = t.Object({
  name: t.String(),
  dataType: t.String(),
  maxLength: t.Nullable(t.Number()),
  numericPrecision: t.Nullable(t.Number()),
  numericScale: t.Nullable(t.Number()),
  isNullable: t.Boolean(),
  isPK: t.Boolean(),
  isFK: t.Boolean(),
  referencesTable: t.Nullable(t.String()),
  referencesColumn: t.Nullable(t.String()),
})

export const SchemaTableSchema = t.Object({
  schema: t.String(),
  name: t.String(),
  columns: t.Array(ColumnSchema),
})

export const ForeignKeySchema = t.Object({
  parentTable: t.String(),
  parentColumn: t.String(),
  referencedTable: t.String(),
  referencedColumn: t.String(),
})

export const SchemaDataSchema = t.Object({
  tables: t.Array(SchemaTableSchema),
  foreignKeys: t.Array(ForeignKeySchema),
})
