import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { generateCondensed, generateDDL } from '../lib/context-generator'
import { estimateTokens } from '../lib/token-estimate'
import type { SchemaData } from '../../types'

interface ContextPanelProps {
  schemaData: SchemaData
}

export function ContextPanel({ schemaData }: ContextPanelProps) {
  const { selectedTables, format, autoExpand, setFormat, setAutoExpand } = useStore()
  const [copied, setCopied] = useState(false)

  const selectedTableData = useMemo(() =>
    schemaData.tables.filter(t => selectedTables.has(`${t.schema}.${t.name}`)),
    [schemaData.tables, selectedTables]
  )

  const relevantFKs = useMemo(() => {
    const names = new Set(selectedTableData.map(t => t.name))
    return schemaData.foreignKeys.filter(fk => names.has(fk.parentTable))
  }, [schemaData.foreignKeys, selectedTableData])

  const contextText = useMemo(() => {
    if (selectedTableData.length === 0) return ''
    return format === 'condensed'
      ? generateCondensed(selectedTableData, relevantFKs)
      : generateDDL(selectedTableData, relevantFKs)
  }, [selectedTableData, relevantFKs, format])

  const tokenCount = useMemo(() => estimateTokens(contextText), [contextText])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(contextText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <aside style={{
      width: 308, background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 13px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2,
          marginBottom: 3, color: 'var(--text-1)',
        }}>
          Context Export
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {selectedTables.size > 0
            ? `${selectedTables.size} table${selectedTables.size > 1 ? 's' : ''} selected · ready to copy`
            : 'Select tables on the diagram'}
        </div>
      </div>

      {/* Format switcher */}
      <div style={{ display: 'flex', padding: '12px 18px 10px', borderBottom: '1px solid var(--border)' }}>
        {(['condensed', 'ddl'] as const).map((f, i) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            style={{
              flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
              textAlign: 'center', cursor: 'pointer',
              border: '1px solid var(--border-strong)',
              borderLeft: i === 1 ? 'none' : undefined,
              background: format === f ? 'var(--accent)' : 'var(--bg)',
              color: format === f ? 'white' : 'var(--text-2)',
              fontFamily: 'inherit',
              borderRadius: i === 0 ? '8px 0 0 8px' : '0 8px 8px 0',
            }}
          >
            {f === 'condensed' ? 'Condensed' : 'DDL'}
          </button>
        ))}
      </div>

      {/* Auto-expand toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 18px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>
          Auto-expand FK neighbors
        </span>
        <div
          onClick={() => setAutoExpand(!autoExpand)}
          style={{
            width: 30, height: 17, borderRadius: 9,
            background: autoExpand ? 'var(--accent)' : 'var(--toggle-off)',
            position: 'relative', cursor: 'pointer', transition: 'background 0.18s',
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute', width: 13, height: 13, borderRadius: '50%',
            background: 'white', top: 2, left: 2,
            transition: 'transform 0.18s',
            transform: autoExpand ? 'translateX(13px)' : 'none',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }} />
        </div>
      </div>

      {/* Preview */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        {contextText ? (
          <pre style={{
            fontFamily: 'ui-monospace, Cascadia Code, monospace',
            fontSize: 11, lineHeight: 1.75, color: 'var(--text-1)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {contextText}
          </pre>
        ) : (
          <div style={{ color: 'var(--text-3)', fontSize: 13, lineHeight: 1.6 }}>
            Select tables in the diagram to preview context output here.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '11px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '3px 9px',
            borderRadius: 20, background: 'var(--accent-light)', color: 'var(--accent)',
          }}>
            ~{tokenCount}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>tokens</span>
        </div>
        <button
          onClick={handleCopy}
          disabled={!contextText}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--r-sm)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            cursor: contextText ? 'pointer' : 'not-allowed',
            border: 'none',
            background: contextText ? 'var(--accent-grad)' : 'rgba(255,255,255,0.1)',
            color: 'white',
            boxShadow: contextText ? '0 2px 10px rgba(74,123,245,0.28)' : 'none',
            opacity: contextText ? 1 : 0.5,
          }}
        >
          {copied ? '✓ Copied!' : 'Copy context'}
        </button>
      </div>
    </aside>
  )
}
