import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Group, SchemaTable } from '../../types'
import styles from './TableNode.module.css'

interface TableNodeData {
  table: SchemaTable
  groups: Group[]
  selected: boolean
  dim: boolean
  matched?: boolean
  compact?: boolean
}

interface TableNodeProps {
  id: string
  data: TableNodeData
}

export const TableNode = memo(function TableNode({ id, data }: TableNodeProps) {
  const { table, groups, selected, dim, matched, compact } = data
  const groupColors = groups.length > 0 ? groups.map(group => group.color) : ['var(--text-3)']

  return (
    <div
      data-table-id={id}
      className={styles.node}
      style={{
        border: selected
          ? '1.5px solid var(--sel)'
          : matched
            ? '1.5px solid rgba(251,191,36,0.85)'
            : '1.5px solid var(--border)',
        boxShadow: selected
          ? '0 0 0 4px var(--sel-ring), var(--shadow-md)'
          : matched
            ? '0 0 0 3px rgba(251,191,36,0.25), var(--shadow-md)'
            : 'var(--shadow-md)',
        opacity: dim ? 0.35 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} className={styles.hiddenHandle} />
      <Handle type="source" position={Position.Right} className={styles.hiddenHandle} />

      <div className={styles.header}>
        <div className={styles.groupBars}>
          {groupColors.map(color => (
            <div key={color} className={styles.groupBar} style={{ background: color }} />
          ))}
        </div>
        <span className={styles.tableName}>{table.name}</span>
        <span className={styles.schemaName}>{table.schema}</span>
      </div>

      {!compact && (
        <div className={styles.columns}>
          {table.columns.map(column => (
            <div key={column.name} className={styles.columnRow}>
              {column.isPK ? (
                <span className={`${styles.badge} ${styles.pkBadge}`}>PK</span>
              ) : column.isFK ? (
                <span className={`${styles.badge} ${styles.fkBadge}`}>FK</span>
              ) : (
                <span className={styles.placeholderBadge}>..</span>
              )}

              <span
                className={styles.columnName}
                style={{ color: column.isNullable ? 'var(--text-2)' : 'var(--text-1)' }}
              >
                {column.name}
              </span>

              {column.isNullable && (
                <span className={styles.nullableMark}>?</span>
              )}

              <span className={styles.dataType}>{column.dataType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})
