import { useState } from 'react'
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
import type { Connection, SchemaData, SchemaSnapshot, SchemaSnapshotSummary } from '../../types'
import { CollectionCard, countTotalChanges, formatDate, MetricCard, readRouteError, schemaStats, sourceMeta, SummaryBucketCard, TonePill } from './schema-diff/helpers'
import { useSchemaDiffData, type CompareMode, type DriftFocus } from './schema-diff/useSchemaDiffData'
import styles from './SchemaDiffModal.module.css'

interface SchemaDiffModalProps {
  activeConnection: string
  currentSchema: SchemaData
  connections: Connection[]
  onClose: () => void
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
  const {
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
    visibleChangedColumns,
  } = useSchemaDiffData({
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
  })

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
