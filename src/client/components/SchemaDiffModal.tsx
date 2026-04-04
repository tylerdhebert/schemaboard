import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Binary,
  Boxes,
  Database,
  FolderPlus,
  GitCompareArrows,
  Link2,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { diffSchemas } from '../lib/schema-diff'
import type { Connection, SchemaData, SchemaSnapshot, SchemaSnapshotSummary } from '../../types'
import styles from './SchemaDiffModal.module.css'

interface SchemaDiffModalProps {
  activeConnection: string
  currentSchema: SchemaData
  connections: Connection[]
  onClose: () => void
}

type CompareMode = 'connection' | 'snapshot'
type DriftFocus = 'all' | 'current-only' | 'target-only' | 'changed-columns'

function formatDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function readRouteError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'value' in error) {
    const value = (error as { value?: { error?: string } }).value
    if (value?.error) return value.error
  }

  if (error instanceof Error) return error.message
  return fallback
}

function countTotalChanges(diff: ReturnType<typeof diffSchemas>): number {
  return (
    diff.currentOnlyTables.length +
    diff.comparisonOnlyTables.length +
    diff.currentOnlyColumns.length +
    diff.comparisonOnlyColumns.length +
    diff.changedColumns.length +
    diff.currentOnlyForeignKeys.length +
    diff.comparisonOnlyForeignKeys.length
  )
}

function schemaStats(schema: SchemaData) {
  return {
    tables: schema.tables.length,
    columns: schema.tables.reduce((total, table) => total + table.columns.length, 0),
    foreignKeys: schema.foreignKeys.length,
  }
}

function sourceMeta(value: string | null | undefined): {
  label: string
  eyebrow: string
  description: string
} {
  if (value === '__demo__') {
    return {
      label: 'Sample Baseline',
      eyebrow: 'Reference schema',
      description: 'Stable ecommerce catalog used as the baseline canvas.',
    }
  }

  if (value === '__demo2__') {
    return {
      label: 'Sample Drift',
      eyebrow: 'Alternate schema',
      description: 'A deliberately drifted version of the sample schema for diff testing.',
    }
  }

  return {
    label: value || 'Unknown source',
    eyebrow: 'Live connection',
    description: 'Query the current schema directly from this datasource.',
  }
}

function TonePill({ children, className = '' }: { children: ReactNode, className?: string }) {
  return (
    <div className={`${styles.tonePill} ${className}`.trim()}>
      {children}
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode
  label: string
  value: number
  accent: string
}) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricHeader}>
        <div className={styles.metricIcon} style={{ color: accent }}>{icon}</div>
        <div className={`${styles.metricValue} ${value ? '' : styles.metricValueMuted}`}>
          {value}
        </div>
      </div>
      <div className={styles.metricLabel}>{label}</div>
    </div>
  )
}

function CollectionCard({
  title,
  subtitle,
  items,
  accent,
}: {
  title: string
  subtitle: string
  items: string[]
  accent: string
}) {
  return (
    <div className={styles.collectionCard}>
      <div className={styles.collectionHeader} style={{ boxShadow: `inset 3px 0 0 ${accent}` }}>
        <div className={styles.collectionTitle}>{title}</div>
        <div className={styles.collectionSubtitle}>{subtitle}</div>
      </div>
      <div className={styles.collectionItems}>
        {items.length === 0 ? (
          <div className={styles.emptyBucket}>No drift in this bucket.</div>
        ) : (
          items.map(item => (
            <div key={item} className={styles.collectionItem}>{item}</div>
          ))
        )}
      </div>
    </div>
  )
}

function SummaryBucketCard({
  title,
  accent,
  rows,
}: {
  title: string
  accent: string
  rows: Array<{ label: string, value: number }>
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <div className={styles.summaryBucket}>
      <div className={styles.summaryBucketHeader}>
        <div className={styles.summaryBucketTitle}>{title}</div>
        <div className={`${styles.summaryBucketTotal} ${total ? '' : styles.summaryBucketTotalMuted}`} style={total ? { color: accent } : undefined}>{total}</div>
      </div>
      <div className={styles.summaryRows}>
        {rows.map(row => (
          <div key={row.label} className={styles.summaryRow}>
            <div className={styles.summaryRowLabel}>{row.label}</div>
            <div className={`${styles.summaryRowValue} ${row.value ? '' : styles.summaryRowValueMuted}`}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SchemaDiffModal({
  activeConnection,
  currentSchema,
  connections,
  onClose,
}: SchemaDiffModalProps) {
  const [compareMode, setCompareMode] = useState<CompareMode>('connection')
  const [compareConnection, setCompareConnection] = useState<string>('')
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('')
  const [snapshotName, setSnapshotName] = useState('')
  const [snapshotError, setSnapshotError] = useState('')
  const [resultView, setResultView] = useState<'condensed' | 'detailed'>('condensed')
  const [filterQuery, setFilterQuery] = useState('')
  const [hideEmptyBuckets, setHideEmptyBuckets] = useState(true)
  const [driftFocus, setDriftFocus] = useState<DriftFocus>('all')
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
  }, [compareConnectionOptions, compareConnection])

  const { data: snapshots = [] } = useQuery({
    queryKey: ['snapshots', activeConnection],
    queryFn: async () => {
      const res = await api.api.snapshots.get({ query: { connection: activeConnection } })
      if (res.error) throw res.error
      return (res.data as SchemaSnapshotSummary[]) ?? []
    },
  })

  useEffect(() => {
    if (snapshots.length === 0) {
      setSelectedSnapshotId('')
      return
    }

    if (!snapshots.some(snapshot => snapshot.id === selectedSnapshotId)) {
      setSelectedSnapshotId(snapshots[0].id)
    }
  }, [snapshots, selectedSnapshotId])

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
    onSuccess: (snapshot) => {
      setSnapshotError('')
      qc.invalidateQueries({ queryKey: ['snapshots', activeConnection] })
      qc.setQueryData(['schema-diff-source', 'snapshot', '', snapshot.id], snapshot.schema)
      setSelectedSnapshotId(snapshot.id)
      setCompareMode('snapshot')
      setSnapshotName('')
    },
    onError: (error) => setSnapshotError(readRouteError(error, 'Failed to capture snapshot')),
  })

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const res = await api.api.snapshots({ id: snapshotId }).delete()
      if (res.error) throw res.error
      return snapshotId
    },
    onSuccess: (snapshotId) => {
      setSnapshotError('')
      qc.invalidateQueries({ queryKey: ['snapshots', activeConnection] })
      if (selectedSnapshotId === snapshotId) setSelectedSnapshotId('')
    },
    onError: (error) => setSnapshotError(readRouteError(error, 'Failed to delete snapshot')),
  })

  const diff = useMemo(() => {
    if (!comparisonSchemaQuery.data) return null
    return diffSchemas(currentSchema, comparisonSchemaQuery.data)
  }, [currentSchema, comparisonSchemaQuery.data])

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
  ].filter((row): row is { label: string, value: number } => row !== null)

  const columnSummaryRows = [
    showCurrentOnly ? { label: 'Only in current', value: activeDiff?.currentOnlyColumns.length ?? 0 } : null,
    showTargetOnly ? { label: 'Only in target', value: activeDiff?.comparisonOnlyColumns.length ?? 0 } : null,
    showChangedColumns ? { label: 'Changed', value: activeDiff?.changedColumns.length ?? 0 } : null,
  ].filter((row): row is { label: string, value: number } => row !== null)

  const foreignKeySummaryRows = [
    showCurrentOnly ? { label: 'Only in current', value: activeDiff?.currentOnlyForeignKeys.length ?? 0 } : null,
    showTargetOnly ? { label: 'Only in target', value: activeDiff?.comparisonOnlyForeignKeys.length ?? 0 } : null,
  ].filter((row): row is { label: string, value: number } => row !== null)

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
      ].filter((card): card is { key: string, title: string, subtitle: string, items: string[], accent: string } => card !== null),
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
      ].filter((card): card is { key: string, title: string, subtitle: string, items: string[], accent: string } => card !== null),
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
      ].filter((card): card is { key: string, title: string, subtitle: string, items: string[], accent: string } => card !== null),
    },
  ].map(section => ({
    ...section,
    cards: hideEmptyBuckets ? section.cards.filter(card => card.items.length > 0) : section.cards,
  })).filter(section => section.cards.length > 0)

  const visibleChangedColumns = showChangedColumns
    ? hideEmptyBuckets
      ? activeDiff?.changedColumns ?? []
      : activeDiff?.changedColumns ?? []
    : []

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
    >
      <div
        className={styles.modal}
        onClick={event => event.stopPropagation()}
      >
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitleWrap}>
              <div className={styles.sidebarTitle}>Schema Diff</div>
              <div className={styles.sidebarSubtitle}>
                Compare the active source against another connection or a saved snapshot.
              </div>
            </div>

            <button onClick={onClose} className={styles.iconButton}>
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>

          <div className={`${styles.sourceCard} ${styles.darkSurface}`}>
            <div className={styles.eyebrow}>Current source</div>
            <div className={styles.sourceName}>{currentMeta.label}</div>
            <div className={styles.sourceDescription}>{currentMeta.description}</div>
          </div>

          <div className={styles.section}>
            <div className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>Comparison mode</div>
            <div className={styles.gridTwo}>
              <button onClick={() => setCompareMode('connection')} className={`${styles.cardButton} ${compareMode === 'connection' ? styles.cardButtonActiveBlue : styles.cardButtonIdle}`}>
                <Database size={18} strokeWidth={2.2} color="var(--accent)" />
                <div className={styles.cardButtonTitle}>Live target</div>
                <div className={styles.cardButtonDescription}>Run the diff against another live source.</div>
              </button>
              <button onClick={() => setCompareMode('snapshot')} className={`${styles.cardButton} ${compareMode === 'snapshot' ? styles.cardButtonActiveAmber : styles.cardButtonIdle}`}>
                <FolderPlus size={18} strokeWidth={2.2} color="var(--sel)" />
                <div className={styles.cardButtonTitle}>Snapshot</div>
                <div className={styles.cardButtonDescription}>Freeze a baseline and compare against it later.</div>
              </button>
            </div>
          </div>

          {compareMode === 'connection' ? (
            <div className={`${styles.section} ${styles.stack}`}>
              <div className={styles.eyebrow}>Target source</div>
              {compareConnectionOptions.length === 0 ? (
                <div className={styles.emptyState}>
                  No other connections are available to compare yet.
                </div>
              ) : (
                compareConnectionOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setCompareConnection(option.value)}
                    className={`${styles.cardButton} ${compareConnection === option.value ? (option.value.startsWith('__demo') ? styles.cardButtonActiveAmber : styles.cardButtonActiveBlue) : styles.cardButtonIdle}`}
                  >
                    <div className={styles.targetCardContent}>
                      <div>
                        <div className={styles.eyebrow}>{option.eyebrow}</div>
                        <div className={`${styles.sourceName} ${styles.targetSourceName}`}>{option.label}</div>
                        <div className={`${styles.sourceDescription} ${styles.targetSourceDescription}`}>{option.description}</div>
                      </div>
                      <GitCompareArrows size={16} strokeWidth={2.2} color={compareConnection === option.value ? 'var(--text-1)' : 'var(--text-3)'} />
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className={`${styles.section} ${styles.stackLoose}`}>
              <div className={`${styles.snapshotCapture} ${styles.darkSurface}`}>
                <div className={`${styles.eyebrow} ${styles.sectionEyebrow}`}>Capture baseline</div>
                <div className={styles.captureRow}>
                  <input
                    value={snapshotName}
                    onChange={event => setSnapshotName(event.target.value)}
                    placeholder="Release candidate, pre-migration, staging..."
                    className={styles.textInput}
                  />
                  <button
                    onClick={() => createSnapshotMutation.mutate()}
                    disabled={!snapshotName || createSnapshotMutation.isPending}
                    className={`${styles.captureButton} ${snapshotName ? styles.captureButtonEnabled : styles.captureButtonDisabled}`}
                  >
                    {createSnapshotMutation.isPending ? 'Saving...' : 'Capture'}
                  </button>
                </div>
              </div>

              <div className={styles.stack}>
                <div className={styles.eyebrow}>Saved baselines</div>
                {snapshots.length === 0 ? (
                  <div className={styles.emptyState}>
                    No snapshots yet. Capture the current schema to create the first baseline.
                  </div>
                ) : (
                  snapshots.map(snapshot => {
                    const active = snapshot.id === selectedSnapshotId
                    return (
                      <div key={snapshot.id} className={`${styles.cardButton} ${active ? styles.cardButtonActiveAmber : styles.cardButtonIdle} ${styles.snapshotCard}`}>
                        <button onClick={() => setSelectedSnapshotId(snapshot.id)} className={styles.inlineSelectButton}>
                          <div className={`${styles.sourceName} ${styles.snapshotSourceName}`}>{snapshot.name}</div>
                          <div className={`${styles.sourceDescription} ${styles.snapshotSourceDescription}`}>{formatDate(snapshot.createdAt)}</div>
                        </button>
                        <button onClick={() => deleteSnapshotMutation.mutate(snapshot.id)} className={styles.deleteButton}>
                          <Trash2 size={14} strokeWidth={2.2} />
                          Delete
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {snapshotError && (
            <div className={styles.snapshotError}>
              {snapshotError}
            </div>
          )}
        </div>

        <div className={styles.content}>
          {comparisonSchemaQuery.isLoading ? (
            <div className={styles.loadingState}>
              <RefreshCw size={15} strokeWidth={2.2} />
              Loading comparison schema...
            </div>
          ) : comparisonSchemaQuery.isError ? (
            <div className={`${styles.errorState} ${styles.errorStateActive}`}>
              {readRouteError(comparisonSchemaQuery.error, 'Failed to load comparison schema')}
            </div>
          ) : !comparisonSchemaQuery.data || !activeDiff ? (
            <div className={styles.emptyState}>
              Pick a target source on the left to generate a comparison.
            </div>
          ) : (
            <>
              <div className={styles.summaryHero}>
                <TonePill className={styles.summaryTonePill}>
                  {compareMode === 'connection' ? 'Live Diff' : 'Snapshot Diff'}
                </TonePill>
                <div className={styles.summaryTitleRow}>
                  <div className={styles.summaryTitle}>{currentMeta.label}</div>
                  <GitCompareArrows size={18} strokeWidth={2.2} color="rgba(255,255,255,0.7)" />
                  <div className={styles.summaryTitle}>{comparisonMeta.label}</div>
                </div>
                <div className={styles.summaryText}>
                  {countTotalChanges(diff) === 0
                    ? 'These sources are structurally aligned. No table, column, or foreign-key drift was detected.'
                    : `${countTotalChanges(diff)} structural differences detected across tables, columns, and foreign keys.`}
                </div>
                <div className={styles.pillRow}>
                  <TonePill>{currentStats.tables} tables / {currentStats.columns} columns / {currentStats.foreignKeys} FKs</TonePill>
                  {comparisonStats && (
                    <TonePill>{comparisonStats.tables} tables / {comparisonStats.columns} columns / {comparisonStats.foreignKeys} FKs</TonePill>
                  )}
                </div>
              </div>

              <div className={styles.metricsGrid}>
                <MetricCard icon={<Boxes size={16} strokeWidth={2.2} />} label="Table drift" value={activeDiff.currentOnlyTables.length + activeDiff.comparisonOnlyTables.length} accent="rgba(245,158,11,0.95)" />
                <MetricCard icon={<Binary size={16} strokeWidth={2.2} />} label="Column drift" value={activeDiff.currentOnlyColumns.length + activeDiff.comparisonOnlyColumns.length + activeDiff.changedColumns.length} accent="rgba(74,123,245,0.95)" />
                <MetricCard icon={<Link2 size={16} strokeWidth={2.2} />} label="Foreign key drift" value={activeDiff.currentOnlyForeignKeys.length + activeDiff.comparisonOnlyForeignKeys.length} accent="rgba(34,194,200,0.95)" />
                <MetricCard icon={<GitCompareArrows size={16} strokeWidth={2.2} />} label={normalizedFilter ? 'Filtered deltas' : 'Total deltas'} value={countTotalChanges(activeDiff)} accent="rgba(236,72,153,0.95)" />
              </div>

              <div className={styles.toolbar}>
                <div className={styles.toolbarText}>
                  {resultView === 'condensed' ? 'Dashboard summary by drift bucket.' : 'Detailed lists grouped into current vs target pairs.'}
                </div>
                <div className={styles.toolbarControls}>
                  <input
                    value={filterQuery}
                    onChange={event => setFilterQuery(event.target.value)}
                    placeholder="Filter tables, columns, or FK ids..."
                    className={styles.searchInput}
                  />
                  <div className={styles.toggleBar}>
                    <button onClick={() => setResultView('condensed')} className={`${styles.cardButton} ${styles.toggleButton} ${resultView === 'condensed' ? styles.cardButtonActiveBlue : styles.cardButtonIdle}`}>Condensed</button>
                    <button onClick={() => setResultView('detailed')} className={`${styles.cardButton} ${styles.toggleButton} ${resultView === 'detailed' ? styles.cardButtonActiveBlue : styles.cardButtonIdle}`}>Detailed</button>
                  </div>
                </div>
              </div>

              <div className={styles.filterToolbar}>
                <button
                  onClick={() => setHideEmptyBuckets(value => !value)}
                  className={`${styles.filterChip} ${hideEmptyBuckets ? styles.filterChipActive : styles.filterChipIdle}`}
                >
                  {hideEmptyBuckets ? 'Hiding empty buckets' : 'Showing empty buckets'}
                </button>
                {([
                  ['all', 'All drift'],
                  ['current-only', 'Current only'],
                  ['target-only', 'Target only'],
                  ['changed-columns', 'Changed columns'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setDriftFocus(value)}
                    className={`${styles.filterChip} ${driftFocus === value ? styles.filterChipActive : styles.filterChipIdle}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {resultView === 'condensed' ? (
                <div className={styles.resultGrid}>
                  {visibleSummaryBuckets.length === 0 ? (
                    <div className={styles.emptyState}>No summary buckets match the current filter set.</div>
                  ) : (
                    visibleSummaryBuckets.map(bucket => (
                      <SummaryBucketCard
                        key={bucket.key}
                        title={bucket.title}
                        accent={bucket.accent}
                        rows={bucket.rows}
                      />
                    ))
                  )}
                </div>
              ) : (
                <div className={styles.detailStack}>
                  {detailSections.length === 0 && visibleChangedColumns.length === 0 ? (
                    <div className={styles.emptyState}>No detailed buckets match the current filter set.</div>
                  ) : (
                    <>
                      {detailSections.map(section => (
                        <div key={section.key}>
                          <div className={`${styles.bucketHeader} ${section.tone === 'active' ? styles.bucketHeaderActive : styles.bucketHeaderMuted}`}>{section.title}</div>
                          <div className={styles.detailGrid}>
                            {section.cards.map(card => (
                              <CollectionCard
                                key={card.key}
                                title={card.title}
                                subtitle={card.subtitle}
                                items={card.items}
                                accent={card.accent}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      {showChangedColumns && (!hideEmptyBuckets || visibleChangedColumns.length > 0) && (
                        <div className={styles.changedColumns}>
                      <div className={styles.changedColumnsHeader}>
                        <div className={styles.changedColumnsTitle}>
                          <Binary size={16} strokeWidth={2.2} color="var(--accent)" />
                          Changed columns
                        </div>
                        <div className={styles.changedColumnsSubtitle}>
                          Shared columns whose type, nullability, precision, or reference changed.
                        </div>
                      </div>
                      <div className={styles.changedColumnsBody}>
                        {visibleChangedColumns.length === 0 ? (
                          <div className={styles.emptyBucket}>No changed columns detected.</div>
                        ) : (
                          visibleChangedColumns.map(change => (
                            <div key={`${change.tableId}.${change.columnName}`} className={styles.changedColumnCard}>
                              <div className={styles.changedColumnTitle}>{change.tableId}.{change.columnName}</div>
                              <div className={styles.changePills}>
                                {change.changes.map(item => (
                                  <div key={item} className={styles.changePill}>{item}</div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
