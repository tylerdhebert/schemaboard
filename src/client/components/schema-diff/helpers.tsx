import type { ReactNode } from 'react'
import { diffSchemas } from '../../lib/schema-diff'
import type { SchemaData } from '../../../types'
import styles from '../SchemaDiffModal.module.css'

export function formatDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function readRouteError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'value' in error) {
    const value = (error as { value?: { error?: string } }).value
    if (value?.error) return value.error
  }

  if (error instanceof Error) return error.message
  return fallback
}

export function countTotalChanges(diff: ReturnType<typeof diffSchemas>): number {
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

export function schemaStats(schema: SchemaData) {
  return {
    tables: schema.tables.length,
    columns: schema.tables.reduce((total, table) => total + table.columns.length, 0),
    foreignKeys: schema.foreignKeys.length,
  }
}

export function sourceMeta(value: string | null | undefined): {
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

export function TonePill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.tonePill} ${className}`.trim()}>
      {children}
    </div>
  )
}

export function MetricCard({
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

export function CollectionCard({
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

export function SummaryBucketCard({
  title,
  accent,
  rows,
}: {
  title: string
  accent: string
  rows: Array<{ label: string; value: number }>
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
