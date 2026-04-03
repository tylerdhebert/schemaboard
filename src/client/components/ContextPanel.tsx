import { useMemo, useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { generateCondensed, generateDDL } from '../lib/context-generator'
import { estimateTokens } from '../lib/token-estimate'
import type { SchemaData } from '../../types'

interface ContextPanelProps {
  schemaData: SchemaData
}

export function ContextPanel({ schemaData }: ContextPanelProps) {
  const { selectedTables, format, setFormat } = useStore()
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [savedText, setSavedText] = useState<string | null>(null)

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

  const isEditingRef = useRef(isEditing)
  useEffect(() => { isEditingRef.current = isEditing }, [isEditing])

  useEffect(() => {
    setSavedText(null)
    if (isEditingRef.current) {
      setEditedText(contextText)
    }
  }, [contextText])

  const displayText = isEditing ? editedText : (savedText ?? contextText)
  const tokenCount = useMemo(() => estimateTokens(displayText), [displayText])
  const hasCustomEdits = savedText !== null

  const handleToggleEdit = () => {
    if (isEditing) {
      setSavedText(editedText)
      setIsEditing(false)
    } else {
      setEditedText(savedText ?? contextText)
      setIsEditing(true)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText)
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

      {/* Preview header with edit toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 18px 6px',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-3)' }}>
          {isEditing ? 'Editing' : 'Preview'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {hasCustomEdits && !isEditing && (
            <button
              onClick={() => setSavedText(null)}
              style={{
                fontSize: 11, fontWeight: 600, padding: '3px 9px',
                borderRadius: 5, border: '1px solid var(--border-strong)',
                background: 'transparent', color: 'var(--text-3)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleToggleEdit}
            disabled={!contextText && !isEditing}
            style={{
              fontSize: 11, fontWeight: 600, padding: '3px 9px',
              borderRadius: 5, border: '1px solid var(--border-strong)',
              background: isEditing ? 'var(--accent)' : 'transparent',
              color: isEditing ? 'white' : 'var(--text-3)',
              cursor: contextText || isEditing ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              opacity: !contextText && !isEditing ? 0.4 : 1,
            }}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {/* Preview / Edit area */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 18px 14px', display: 'flex', flexDirection: 'column' }}>
        {isEditing ? (
          <textarea
            value={editedText}
            onChange={e => setEditedText(e.target.value)}
            style={{
              flex: 1, width: '100%', resize: 'none',
              fontFamily: 'ui-monospace, Cascadia Code, monospace',
              fontSize: 11, lineHeight: 1.75,
              color: 'var(--text-1)', background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--r-sm)',
              padding: '10px 12px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        ) : displayText ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <pre style={{
              fontFamily: 'ui-monospace, Cascadia Code, monospace',
              fontSize: 11, lineHeight: 1.75, color: 'var(--text-1)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0,
            }}>
              {displayText}
            </pre>
          </div>
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
          disabled={!displayText}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 'var(--r-sm)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
            cursor: displayText ? 'pointer' : 'not-allowed',
            border: 'none',
            background: displayText ? 'var(--accent-grad)' : 'rgba(255,255,255,0.1)',
            color: 'white',
            boxShadow: displayText ? '0 2px 10px rgba(74,123,245,0.28)' : 'none',
            opacity: displayText ? 1 : 0.5,
          }}
        >
          {copied ? '✓ Copied!' : 'Copy context'}
        </button>
      </div>
    </aside>
  )
}
