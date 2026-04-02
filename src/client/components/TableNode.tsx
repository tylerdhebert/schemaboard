import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { SchemaTable, Group } from '../../types'

interface TableNodeData {
  table: SchemaTable
  group: Group | null
  selected: boolean
  dim: boolean
}

interface TableNodeProps {
  id: string
  data: TableNodeData
}

export const TableNode = memo(function TableNode({ id, data }: TableNodeProps) {
  const { table, group, selected, dim } = data
  const groupColor = group?.color ?? 'var(--text-3)'

  return (
    <div
      data-table-id={id}
      style={{
        background: 'var(--surface)',
        border: selected ? '1.5px solid var(--sel)' : '1.5px solid var(--border)',
        borderRadius: 'var(--r)',
        boxShadow: selected
          ? '0 0 0 4px var(--sel-ring), var(--shadow-md)'
          : 'var(--shadow-md)',
        minWidth: 200,
        overflow: 'hidden',
        opacity: dim ? 0.35 : 1,
        transition: 'opacity 0.18s, box-shadow 0.18s, border-color 0.18s',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{
        padding: '9px 13px 8px',
        display: 'flex', alignItems: 'center', gap: 7,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 3, height: 17, borderRadius: 2,
          background: groupColor, flexShrink: 0,
        }} />
        <span style={{
          fontSize: 12.5, fontWeight: 700, letterSpacing: -0.2,
          flex: 1, color: 'var(--text-1)',
        }}>
          {table.name}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
          {table.schema}
        </span>
      </div>

      {/* Columns */}
      <div style={{ padding: '5px 0 3px' }}>
        {table.columns.map(col => (
          <div key={col.name} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3.5px 13px', fontSize: 11.5,
          }}>
            {col.isPK ? (
              <span style={{
                fontSize: 8.5, fontWeight: 800, padding: '1.5px 4px', borderRadius: 3,
                background: 'var(--pk-bg)', color: 'var(--pk-color)',
                minWidth: 20, textAlign: 'center', flexShrink: 0,
              }}>PK</span>
            ) : col.isFK ? (
              <span style={{
                fontSize: 8.5, fontWeight: 800, padding: '1.5px 4px', borderRadius: 3,
                background: 'var(--fk-bg)', color: 'var(--fk-color)',
                minWidth: 20, textAlign: 'center', flexShrink: 0,
              }}>FK</span>
            ) : (
              <span style={{ minWidth: 20, flexShrink: 0, visibility: 'hidden' }}>··</span>
            )}
            <span style={{
              fontWeight: 500, flex: 1,
              color: col.isNullable ? 'var(--text-2)' : 'var(--text-1)',
            }}>
              {col.name}
            </span>
            {col.isNullable && (
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>?</span>
            )}
            <span style={{
              fontSize: 10.5, color: 'var(--text-3)',
              fontFamily: 'ui-monospace, monospace',
            }}>
              {col.dataType}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
