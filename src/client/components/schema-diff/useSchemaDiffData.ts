import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { diffSchemas } from '../../lib/schema-diff'
import type { Connection, SchemaData, SchemaSnapshot, SchemaSnapshotSummary } from '../../../types'
import { readRouteError, schemaStats, sourceMeta } from './helpers'

export type CompareMode = 'connection' | 'snapshot'
export type DriftFocus = 'all' | 'current-only' | 'target-only' | 'changed-columns'

interface UseSchemaDiffDataProps {
  activeConnection: string
  currentSchema: SchemaData
  connections: Connection[]
  compareMode: CompareMode
  compareConnection: string
  selectedSnapshotId: string
  snapshotName: string
  filterQuery: string
  hideEmptyBuckets: boolean
  driftFocus: DriftFocus
  setCompareConnection: (value: string) => void
  setSelectedSnapshotId: (value: string) => void
  setCompareMode: (value: CompareMode) => void
  setSnapshotName: (value: string) => void
  setSnapshotError: (value: string) => void
}

export function useSchemaDiffData({
  activeConnection,
  currentSchema,
  connections,
  compareMode,
  compareConnection,
  selectedSnapshotId,
  snapshotName,
  filterQuery,
  hideEmptyBuckets,
  driftFocus,
  setCompareConnection,
  setSelectedSnapshotId,
  setCompareMode,
  setSnapshotName,
  setSnapshotError,
}: UseSchemaDiffDataProps) {
  const qc = useQueryClient()

  const compareConnectionOptions = useMemo(() => {
    const isDemoMode = activeConnection.startsWith('__demo')
    const demoOptions = isDemoMode
      ? [
          { value: '__demo__', ...sourceMeta('__demo__') },
          { value: '__demo2__', ...sourceMeta('__demo2__') },
        ].filter(option => option.value !== activeConnection)
      : []

    const liveOptions = isDemoMode
      ? []
      : connections
          .filter(connection => connection.name !== activeConnection)
          .map(connection => ({
            value: connection.name,
            ...sourceMeta(connection.name),
          }))

    return [...demoOptions, ...liveOptions]
  }, [connections, activeConnection])

  useEffect(() => {
    if (compareConnectionOptions.length === 0) {
      setCompareConnection('')
      return
    }

    if (!compareConnectionOptions.some(option => option.value === compareConnection)) {
      setCompareConnection(compareConnectionOptions[0].value)
    }
  }, [compareConnection, compareConnectionOptions, setCompareConnection])

  const snapshotsQuery = useQuery({
    queryKey: ['snapshots', activeConnection],
    queryFn: async () => {
      const res = await api.api.snapshots.get({ query: { connection: activeConnection } })
      if (res.error) throw res.error
      return (res.data as SchemaSnapshotSummary[]) ?? []
    },
  })

  const snapshots = snapshotsQuery.data ?? []

  useEffect(() => {
    if (snapshots.length === 0) {
      setSelectedSnapshotId('')
      return
    }

    if (!snapshots.some(snapshot => snapshot.id === selectedSnapshotId)) {
      setSelectedSnapshotId(snapshots[0].id)
    }
  }, [selectedSnapshotId, setSelectedSnapshotId, snapshots])

  const comparisonSchemaQuery = useQuery({
    queryKey: ['schema-diff-source', compareMode, compareConnection, selectedSnapshotId],
    enabled: compareMode === 'connection' ? !!compareConnection : !!selectedSnapshotId,
    queryFn: async () => {
      if (compareMode === 'connection') {
        if (compareConnection === '__demo__') {
          const res = await api.api.schema.demo.get()
          if (res.error) throw res.error
          return (res.data as SchemaData) ?? { tables: [], foreignKeys: [] }
        }

        if (compareConnection === '__demo2__') {
          const res = await api.api.schema.demo2.get()
          if (res.error) throw res.error
          return (res.data as SchemaData) ?? { tables: [], foreignKeys: [] }
        }

        const res = await api.api.schema.get({ query: { connection: compareConnection } })
        if (res.error) throw res.error
        return (res.data as SchemaData) ?? { tables: [], foreignKeys: [] }
      }

      const res = await api.api.snapshots({ id: selectedSnapshotId }).get()
      if (res.error) throw res.error
      return ((res.data as SchemaSnapshot | null)?.schema) ?? { tables: [], foreignKeys: [] }
    },
  })

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await api.api.snapshots.post({
        connectionName: activeConnection,
        name: snapshotName,
        schema: currentSchema,
      })
      if (res.error) throw res.error
      return res.data as SchemaSnapshot
    },
    onSuccess: snapshot => {
      setSnapshotError('')
      qc.invalidateQueries({ queryKey: ['snapshots', activeConnection] })
      qc.setQueryData(['schema-diff-source', 'snapshot', '', snapshot.id], snapshot.schema)
      setSelectedSnapshotId(snapshot.id)
      setCompareMode('snapshot')
      setSnapshotName('')
    },
    onError: error => setSnapshotError(readRouteError(error, 'Failed to capture snapshot')),
  })

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await api.api.snapshots({ id: snapshotId }).delete()
      if (res.error) throw res.error
      return snapshotId
    },
    onSuccess: snapshotId => {
      setSnapshotError('')
      qc.invalidateQueries({ queryKey: ['snapshots', activeConnection] })
      if (selectedSnapshotId === snapshotId) setSelectedSnapshotId('')
    },
    onError: error => setSnapshotError(readRouteError(error, 'Failed to delete snapshot')),
  })

  const diff = useMemo(() => {
    if (!comparisonSchemaQuery.data) return null
    return diffSchemas(currentSchema, comparisonSchemaQuery.data)
  }, [comparisonSchemaQuery.data, currentSchema])

  const currentMeta = sourceMeta(activeConnection)
  const comparisonMeta = compareMode === 'connection'
    ? sourceMeta(compareConnection)
    : {
        label: snapshots.find(snapshot => snapshot.id === selectedSnapshotId)?.name ?? 'Snapshot',
        eyebrow: 'Saved baseline',
        description: 'Compare against a captured schema baseline for this connection.',
      }

  const currentStats = schemaStats(currentSchema)
  const comparisonStats = comparisonSchemaQuery.data ? schemaStats(comparisonSchemaQuery.data) : null
  const normalizedFilter = filterQuery.trim().toLowerCase()

  const filteredDiff = useMemo(() => {
    if (!diff || !normalizedFilter) return diff

    return {
      currentOnlyTables: diff.currentOnlyTables.filter(item => item.toLowerCase().includes(normalizedFilter)),
      comparisonOnlyTables: diff.comparisonOnlyTables.filter(item => item.toLowerCase().includes(normalizedFilter)),
      currentOnlyColumns: diff.currentOnlyColumns.filter(item => `${item.tableId}.${item.columnName}`.toLowerCase().includes(normalizedFilter)),
      comparisonOnlyColumns: diff.comparisonOnlyColumns.filter(item => `${item.tableId}.${item.columnName}`.toLowerCase().includes(normalizedFilter)),
      changedColumns: diff.changedColumns.filter(item => `${item.tableId}.${item.columnName} ${item.changes.join(' ')}`.toLowerCase().includes(normalizedFilter)),
      currentOnlyForeignKeys: diff.currentOnlyForeignKeys.filter(item => item.toLowerCase().includes(normalizedFilter)),
      comparisonOnlyForeignKeys: diff.comparisonOnlyForeignKeys.filter(item => item.toLowerCase().includes(normalizedFilter)),
    }
  }, [diff, normalizedFilter])

  const activeDiff = filteredDiff ?? diff
  const tableDrift = activeDiff ? activeDiff.currentOnlyTables.length + activeDiff.comparisonOnlyTables.length : 0
  const columnDrift = activeDiff ? activeDiff.currentOnlyColumns.length + activeDiff.comparisonOnlyColumns.length + activeDiff.changedColumns.length : 0
  const foreignKeyDrift = activeDiff ? activeDiff.currentOnlyForeignKeys.length + activeDiff.comparisonOnlyForeignKeys.length : 0

  const showCurrentOnly = driftFocus === 'all' || driftFocus === 'current-only'
  const showTargetOnly = driftFocus === 'all' || driftFocus === 'target-only'
  const showChangedColumns = driftFocus === 'all' || driftFocus === 'changed-columns'

  const tableSummaryRows = [
    showCurrentOnly ? { label: 'Only in current', value: activeDiff?.currentOnlyTables.length ?? 0 } : null,
    showTargetOnly ? { label: 'Only in target', value: activeDiff?.comparisonOnlyTables.length ?? 0 } : null,
  ].filter((row): row is { label: string; value: number } => row !== null)

  const columnSummaryRows = [
    showCurrentOnly ? { label: 'Only in current', value: activeDiff?.currentOnlyColumns.length ?? 0 } : null,
    showTargetOnly ? { label: 'Only in target', value: activeDiff?.comparisonOnlyColumns.length ?? 0 } : null,
    showChangedColumns ? { label: 'Changed', value: activeDiff?.changedColumns.length ?? 0 } : null,
  ].filter((row): row is { label: string; value: number } => row !== null)

  const foreignKeySummaryRows = [
    showCurrentOnly ? { label: 'Only in current', value: activeDiff?.currentOnlyForeignKeys.length ?? 0 } : null,
    showTargetOnly ? { label: 'Only in target', value: activeDiff?.comparisonOnlyForeignKeys.length ?? 0 } : null,
  ].filter((row): row is { label: string; value: number } => row !== null)

  const visibleSummaryBuckets = [
    { key: 'tables', title: 'Tables', accent: 'var(--sel)', rows: tableSummaryRows },
    { key: 'columns', title: 'Columns', accent: 'var(--accent)', rows: columnSummaryRows },
    { key: 'foreign-keys', title: 'Foreign keys', accent: '#22C2C8', rows: foreignKeySummaryRows },
  ].filter(bucket => bucket.rows.length > 0 && (!hideEmptyBuckets || bucket.rows.some(row => row.value > 0)))

  const detailSections = [
    {
      key: 'table-drift',
      title: 'Table drift',
      tone: tableDrift ? 'active' : 'muted',
      cards: [
        showCurrentOnly ? {
          key: 'table-current',
          title: 'Only in current',
          subtitle: 'Tables present in the active schema only.',
          items: activeDiff?.currentOnlyTables ?? [],
          accent: 'rgba(245,158,11,0.9)',
        } : null,
        showTargetOnly ? {
          key: 'table-target',
          title: 'Only in target',
          subtitle: 'Tables that exist only in the comparison source.',
          items: activeDiff?.comparisonOnlyTables ?? [],
          accent: 'rgba(34,194,200,0.9)',
        } : null,
      ].filter(Boolean),
    },
    {
      key: 'column-drift',
      title: 'Column drift',
      tone: columnDrift ? 'active' : 'muted',
      cards: [
        showCurrentOnly ? {
          key: 'column-current',
          title: 'Only in current',
          subtitle: 'New or extra columns on the active source.',
          items: (activeDiff?.currentOnlyColumns ?? []).map(item => `${item.tableId}.${item.columnName}`),
          accent: 'rgba(74,123,245,0.9)',
        } : null,
        showTargetOnly ? {
          key: 'column-target',
          title: 'Only in target',
          subtitle: 'Columns missing from the active source.',
          items: (activeDiff?.comparisonOnlyColumns ?? []).map(item => `${item.tableId}.${item.columnName}`),
          accent: 'rgba(168,85,247,0.9)',
        } : null,
      ].filter(Boolean),
    },
    {
      key: 'foreign-key-drift',
      title: 'Foreign key drift',
      tone: foreignKeyDrift ? 'active' : 'muted',
      cards: [
        showCurrentOnly ? {
          key: 'fk-current',
          title: 'Only in current',
          subtitle: 'Relationships added on the active source.',
          items: activeDiff?.currentOnlyForeignKeys ?? [],
          accent: 'rgba(34,197,94,0.9)',
        } : null,
        showTargetOnly ? {
          key: 'fk-target',
          title: 'Only in target',
          subtitle: 'Relationships present only in the comparison source.',
          items: activeDiff?.comparisonOnlyForeignKeys ?? [],
          accent: 'rgba(239,68,68,0.9)',
        } : null,
      ].filter(Boolean),
    },
  ].map(section => ({
    ...section,
    cards: hideEmptyBuckets ? section.cards.filter(card => card.items.length > 0) : section.cards,
  })).filter(section => section.cards.length > 0)

  const visibleChangedColumns = showChangedColumns ? (activeDiff?.changedColumns ?? []) : []

  return {
    compareConnectionOptions,
    snapshots,
    comparisonSchemaQuery,
    createSnapshotMutation,
    deleteSnapshotMutation,
    currentMeta,
    comparisonMeta,
    currentStats,
    comparisonStats,
    diff,
    activeDiff,
    tableDrift,
    columnDrift,
    foreignKeyDrift,
    visibleSummaryBuckets,
    detailSections,
    showChangedColumns,
    visibleChangedColumns,
  }
}
