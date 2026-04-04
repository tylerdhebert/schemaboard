import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useSelectionContext } from '../hooks/useSelectionContext'
import { estimateTokens } from '../lib/token-estimate'
import type { SchemaData } from '../../types'
import styles from './ContextPanel.module.css'

interface ContextPanelProps {
  schemaData: SchemaData
}

export function ContextPanel({ schemaData }: ContextPanelProps) {
  const { format, setFormat } = useStore()
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState('')
  const [savedText, setSavedText] = useState<string | null>(null)
  const { contextText, selectedTables } = useSelectionContext(schemaData)

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

  function handleToggleEdit() {
    if (isEditing) {
      setSavedText(editedText)
      setIsEditing(false)
      return
    }

    setEditedText(savedText ?? contextText)
    setIsEditing(true)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(displayText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>Context Export</div>
        <div className={styles.subtitle}>
          {selectedTables.size > 0
            ? `${selectedTables.size} table${selectedTables.size > 1 ? 's' : ''} selected, ready to copy`
            : 'Select tables in the board'}
        </div>
      </div>

      <div className={styles.formatRow}>
        {(['condensed', 'ddl'] as const).map((nextFormat, index) => (
          <button
            key={nextFormat}
            onClick={() => setFormat(nextFormat)}
            className={`${styles.formatButton} ${index === 0 ? styles.formatButtonLeft : styles.formatButtonRight} ${format === nextFormat ? styles.formatButtonActive : styles.formatButtonInactive}`}
          >
            {nextFormat === 'condensed' ? 'Condensed' : 'DDL'}
          </button>
        ))}
      </div>

      <div className={styles.previewHeader}>
        <span className={styles.previewLabel}>{isEditing ? 'Editing' : 'Preview'}</span>
        <div className={styles.previewActions}>
          {hasCustomEdits && !isEditing && (
            <button
              onClick={() => setSavedText(null)}
              className={`${styles.smallButton} ${styles.smallButtonMuted}`}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleToggleEdit}
            disabled={!contextText && !isEditing}
            className={`${styles.smallButton} ${isEditing ? styles.smallButtonActive : styles.smallButtonMuted} ${!contextText && !isEditing ? styles.smallButtonDisabled : ''}`}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {isEditing ? (
          <textarea
            value={editedText}
            onChange={event => setEditedText(event.target.value)}
            className={styles.textarea}
          />
        ) : displayText ? (
          <div className={styles.previewScroll}>
            <pre className={styles.previewText}>{displayText}</pre>
          </div>
        ) : (
          <div className={styles.emptyText}>Select tables in the board to preview context output here.</div>
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.tokenWrap}>
          <span className={styles.tokenBadge}>~{tokenCount}</span>
          <span className={styles.tokenLabel}>tokens</span>
        </div>
        <button
          onClick={handleCopy}
          disabled={!displayText}
          className={`${styles.copyButton} ${displayText ? styles.copyButtonEnabled : styles.copyButtonDisabled}`}
        >
          {copied ? 'Copied' : 'Copy context'}
        </button>
      </div>
    </aside>
  )
}
