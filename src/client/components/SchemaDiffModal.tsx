import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
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

interface SchemaDiffModalProps {
  activeConnection: string
  currentSchema: SchemaData
  connections: Connection[]
  onClose: () => void
}

type CompareMode = 'connection' | 'snapshot'

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
      label: 'Demo Baseline',
      eyebrow: 'Reference schema',
      description: 'Stable ecommerce catalog used as the baseline canvas.',
    }
  }

  if (value === '__demo2__') {
    return {
      label: 'Demo Drift',
      eyebrow: 'Alternate schema',
      description: 'A deliberately drifted version of the demo for diff testing.',
    }
  }

  return {
    label: value || 'Unknown source',
    eyebrow: 'Live connection',
    description: 'Query the current schema directly from this datasource.',
  }
}

function cardStyle(active: boolean, accent: string): CSSProperties {
  return {
    width: '100%',
    display: 'block',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'var(--text-1)',
    padding: 14,
    borderRadius: 14,
    border: active ? `1px solid ${accent}` : '1px solid var(--border)',
    background: active ? 'rgba(74,123,245,0.14)' : 'rgba(255,255,255,0.02)',
    boxShadow: 'none',
    cursor: 'pointer',
    transition: 'transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease',
  }
}

function TonePill({ children, style }: { children: ReactNode, style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 9px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.09)',
        background: 'rgba(255,255,255,0.04)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        color: 'var(--text-2)',
        ...style,
      }}
    >
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
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: `linear-gradient(180deg, ${accent}18 0%, rgba(255,255,255,0.02) 100%)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: accent, display: 'inline-flex' }}>{icon}</div>
        <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 800, color: value ? 'var(--text-1)' : 'var(--text-2)' }}>
          {value}
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-2)', fontWeight: 600 }}>{label}</div>
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
    <div
      style={{
        borderRadius: 18,
        border: '1px solid var(--border)',
        background: `linear-gradient(180deg, ${accent}14 0%, rgba(255,255,255,0.02) 100%)`,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{title}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-2)' }}>{subtitle}</div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.length === 0 ? (
          <div style={{ padding: '8px 4px', fontSize: 12.5, color: 'var(--text-3)' }}>No drift in this bucket.</div>
        ) : (
          items.map(item => (
            <div
              key={item}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.18)',
                border: '1px solid rgba(255,255,255,0.06)',
                fontSize: 12.5,
                color: 'var(--text-1)',
                wordBreak: 'break-word',
              }}
            >
              {item}
            </div>
          ))
        )}
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
  const qc = useQueryClient()

  const compareConnectionOptions = useMemo(() => {
    const demoOptions = [
      { value: '__demo__', ...sourceMeta('__demo__') },
      { value: '__demo2__', ...sourceMeta('__demo2__') },
    ].filter(option => option.value !== activeConnection)

    const liveOptions = connections
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 130,
        padding: 12,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 1260,
          maxWidth: 'calc(100vw - 24px)',
          height: 'calc(100vh - 24px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(51,46,37,0.98)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          display: 'flex',
          flexWrap: 'wrap',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={event => event.stopPropagation()}
      >
        <div style={{ width: 360, maxWidth: '100%', padding: 20, borderRight: '1px solid var(--border)', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 23, lineHeight: 1.05, fontWeight: 800, letterSpacing: -0.8, color: 'var(--text-1)' }}>
                Schema Diff
              </div>
              <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-2)' }}>
                Compare the active source against another connection or a saved snapshot.
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                background: 'rgba(0,0,0,0.18)',
                color: 'var(--text-2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>

          <div style={{ marginTop: 16, padding: 16, borderRadius: 18, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.14)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-3)', fontWeight: 700 }}>Current source</div>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 700 }}>{currentMeta.label}</div>
            <div style={{ marginTop: 4, fontSize: 12.5, color: 'var(--text-2)' }}>{currentMeta.description}</div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-3)', fontWeight: 700, marginBottom: 10 }}>Comparison mode</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <button onClick={() => setCompareMode('connection')} style={cardStyle(compareMode === 'connection', 'rgba(74,123,245,0.9)')}>
                <Database size={18} strokeWidth={2.2} color="var(--accent)" />
                <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700 }}>Live target</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: 'var(--text-2)' }}>Run the diff against another live source.</div>
              </button>
              <button onClick={() => setCompareMode('snapshot')} style={cardStyle(compareMode === 'snapshot', 'rgba(245,158,11,0.9)')}>
                <FolderPlus size={18} strokeWidth={2.2} color="var(--sel)" />
                <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700 }}>Snapshot</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.45, color: 'var(--text-2)' }}>Freeze a baseline and compare against it later.</div>
              </button>
            </div>
          </div>

          {compareMode === 'connection' ? (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-3)', fontWeight: 700 }}>Target source</div>
              {compareConnectionOptions.length === 0 ? (
                <div style={{ padding: 16, borderRadius: 16, border: '1px dashed var(--border-strong)', color: 'var(--text-3)', fontSize: 12.5 }}>
                  No other connections are available to compare yet.
                </div>
              ) : (
                compareConnectionOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setCompareConnection(option.value)}
                    style={cardStyle(compareConnection === option.value, option.value.startsWith('__demo') ? 'rgba(245,158,11,0.9)' : 'rgba(74,123,245,0.9)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-3)', fontWeight: 700 }}>{option.eyebrow}</div>
                        <div style={{ marginTop: 7, fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{option.label}</div>
                        <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-2)' }}>{option.description}</div>
                      </div>
                      <GitCompareArrows size={16} strokeWidth={2.2} color={compareConnection === option.value ? 'var(--text-1)' : 'var(--text-3)'} />
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 18, border: '1px solid var(--border)', background: 'rgba(0,0,0,0.16)' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-3)', fontWeight: 700, marginBottom: 10 }}>Capture baseline</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
                  <input
                    value={snapshotName}
                    onChange={event => setSnapshotName(event.target.value)}
                    placeholder="Release candidate, pre-migration, staging..."
                    style={{
                      flex: 1,
                      padding: '11px 12px',
                      borderRadius: 12,
                      border: '1px solid var(--border-strong)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text-1)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => createSnapshotMutation.mutate()}
                    disabled={!snapshotName || createSnapshotMutation.isPending}
                    style={{
                      minHeight: 42,
                      padding: '0 14px',
                      borderRadius: 12,
                      border: 'none',
                      background: snapshotName ? 'var(--accent-grad)' : 'rgba(255,255,255,0.08)',
                      color: 'white',
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: snapshotName ? 'pointer' : 'not-allowed',
                      flex: '0 0 auto',
                    }}
                  >
                    {createSnapshotMutation.isPending ? 'Saving...' : 'Capture'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-3)', fontWeight: 700 }}>Saved baselines</div>
                {snapshots.length === 0 ? (
                  <div style={{ padding: 16, borderRadius: 16, border: '1px dashed var(--border-strong)', color: 'var(--text-3)', fontSize: 12.5 }}>
                    No snapshots yet. Capture the current schema to create the first baseline.
                  </div>
                ) : (
                  snapshots.map(snapshot => {
                    const active = snapshot.id === selectedSnapshotId
                    return (
                      <div key={snapshot.id} style={{ ...cardStyle(active, 'rgba(245,158,11,0.9)'), cursor: 'default' }}>
                        <button onClick={() => setSelectedSnapshotId(snapshot.id)} style={{ all: 'unset', display: 'block', cursor: 'pointer' }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{snapshot.name}</div>
                          <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-2)' }}>{formatDate(snapshot.createdAt)}</div>
                        </button>
                        <button
                          onClick={() => deleteSnapshotMutation.mutate(snapshot.id)}
                          style={{
                            marginTop: 10,
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            color: 'var(--text-3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 12,
                          }}
                        >
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
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'var(--err-bg)', color: 'var(--err-color)', fontSize: 12.5 }}>
              {snapshotError}
            </div>
          )}
        </div>

        <div style={{ flex: 1, height: '100%', minWidth: 320, padding: 22, overflowY: 'auto', position: 'relative', zIndex: 1 }}>
          {comparisonSchemaQuery.isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-2)', fontSize: 13 }}>
              <RefreshCw size={15} strokeWidth={2.2} />
              Loading comparison schema...
            </div>
          ) : comparisonSchemaQuery.isError ? (
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--err-bg)', color: 'var(--err-color)', fontSize: 13 }}>
              {readRouteError(comparisonSchemaQuery.error, 'Failed to load comparison schema')}
            </div>
          ) : !comparisonSchemaQuery.data || !diff ? (
            <div style={{ padding: 22, borderRadius: 18, border: '1px dashed var(--border-strong)', color: 'var(--text-2)', fontSize: 13 }}>
              Pick a target source on the left to generate a comparison.
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: 22,
                  borderRadius: 24,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <TonePill style={{ color: 'rgba(255,255,255,0.78)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  {compareMode === 'connection' ? 'Live Diff' : 'Snapshot Diff'}
                </TonePill>
                <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1.1 }}>
                    {currentMeta.label}
                  </div>
                  <GitCompareArrows size={18} strokeWidth={2.2} color="rgba(255,255,255,0.7)" />
                  <div style={{ fontSize: 28, lineHeight: 1.05, fontWeight: 800, letterSpacing: -1.1 }}>
                    {comparisonMeta.label}
                  </div>
                </div>
                <div style={{ marginTop: 10, maxWidth: 720, fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)' }}>
                  {countTotalChanges(diff) === 0
                    ? 'These sources are structurally aligned. No table, column, or foreign-key drift was detected.'
                    : `${countTotalChanges(diff)} structural differences detected across tables, columns, and foreign keys.`}
                </div>
                <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <TonePill>{currentStats.tables} tables / {currentStats.columns} columns / {currentStats.foreignKeys} FKs</TonePill>
                  {comparisonStats && (
                    <TonePill>{comparisonStats.tables} tables / {comparisonStats.columns} columns / {comparisonStats.foreignKeys} FKs</TonePill>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                <MetricCard icon={<Boxes size={16} strokeWidth={2.2} />} label="Table drift" value={diff.currentOnlyTables.length + diff.comparisonOnlyTables.length} accent="rgba(245,158,11,0.95)" />
                <MetricCard icon={<Binary size={16} strokeWidth={2.2} />} label="Column drift" value={diff.currentOnlyColumns.length + diff.comparisonOnlyColumns.length + diff.changedColumns.length} accent="rgba(74,123,245,0.95)" />
                <MetricCard icon={<Link2 size={16} strokeWidth={2.2} />} label="Foreign key drift" value={diff.currentOnlyForeignKeys.length + diff.comparisonOnlyForeignKeys.length} accent="rgba(34,194,200,0.95)" />
                <MetricCard icon={<GitCompareArrows size={16} strokeWidth={2.2} />} label="Total deltas" value={countTotalChanges(diff)} accent="rgba(236,72,153,0.95)" />
              </div>

              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <CollectionCard title="Only in current" subtitle="Tables present in the active schema only." items={diff.currentOnlyTables} accent="rgba(245,158,11,0.9)" />
                <CollectionCard title="Only in target" subtitle="Tables that exist only in the comparison source." items={diff.comparisonOnlyTables} accent="rgba(34,194,200,0.9)" />
                <CollectionCard title="Columns only in current" subtitle="New or extra columns on the active source." items={diff.currentOnlyColumns.map(item => `${item.tableId}.${item.columnName}`)} accent="rgba(74,123,245,0.9)" />
                <CollectionCard title="Columns only in target" subtitle="Columns missing from the active source." items={diff.comparisonOnlyColumns.map(item => `${item.tableId}.${item.columnName}`)} accent="rgba(168,85,247,0.9)" />
                <CollectionCard title="FKs only in current" subtitle="Relationships added on the active source." items={diff.currentOnlyForeignKeys} accent="rgba(34,197,94,0.9)" />
                <CollectionCard title="FKs only in target" subtitle="Relationships present only in the comparison source." items={diff.comparisonOnlyForeignKeys} accent="rgba(239,68,68,0.9)" />
              </div>

              <div style={{ marginTop: 16, borderRadius: 20, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
                    <Binary size={16} strokeWidth={2.2} color="var(--accent)" />
                    Changed columns
                  </div>
                  <div style={{ marginTop: 5, fontSize: 12.5, color: 'var(--text-2)' }}>
                    Shared columns whose type, nullability, precision, or reference changed.
                  </div>
                </div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {diff.changedColumns.length === 0 ? (
                    <div style={{ padding: '8px 4px', fontSize: 12.5, color: 'var(--text-3)' }}>No changed columns detected.</div>
                  ) : (
                    diff.changedColumns.map(change => (
                      <div key={`${change.tableId}.${change.columnName}`} style={{ padding: 14, borderRadius: 16, background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{change.tableId}.{change.columnName}</div>
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {change.changes.map(item => (
                            <div key={item} style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(74,123,245,0.14)', border: '1px solid rgba(74,123,245,0.22)', fontSize: 12, color: 'var(--text-1)' }}>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
