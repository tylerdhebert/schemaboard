import { Check, ChevronDown, Copy, EyeOff, FolderPlus, Maximize2, X } from 'lucide-react'
import styles from '../Sidebar.module.css'

interface SidebarSelectionCardProps {
  selectedCount: number
  selectedTableIds: string[]
  copied: boolean
  onClear: () => void
  onZoom: (ids: string[]) => void
  onOpenGroupMenu: (rect: DOMRect) => void
  onCopy: (event: React.MouseEvent<HTMLButtonElement>) => void
  onHide: (ids: string[]) => void
}

export function SidebarSelectionCard({
  selectedCount,
  selectedTableIds,
  copied,
  onClear,
  onZoom,
  onOpenGroupMenu,
  onCopy,
  onHide,
}: SidebarSelectionCardProps) {
  const disabled = selectedCount === 0

  return (
    <div className={styles.selectionSlot}>
      <div className={`${styles.selectionToolbar} ${disabled ? styles.selectionToolbarIdle : ''}`}>
        <div className={styles.selectionToolbarHeader}>
          <div className={styles.selectionToolbarSummary}>
            <span className={styles.selectionToolbarCount}>{selectedCount}</span>
            <div className={styles.selectionToolbarCopy}>
              <span className={styles.selectionToolbarEyebrow}>Selection</span>
              <span className={styles.selectionToolbarLabel}>
                {disabled ? 'No tables selected' : `${selectedCount} table${selectedCount === 1 ? '' : 's'} selected`}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            className={`${styles.selectionToolbarButton} ${styles.selectionToolbarButtonMuted} ${disabled ? styles.selectionToolbarButtonDisabled : ''}`}
            onClick={event => {
              event.stopPropagation()
              onClear()
            }}
            title="Clear selection"
          >
            <X size={12} strokeWidth={2.2} />
          </button>
        </div>
        <div className={styles.selectionToolbarActions}>
          <button
            type="button"
            disabled={disabled}
            className={`${styles.selectionToolbarButton} ${disabled ? styles.selectionToolbarButtonDisabled : ''}`}
            onClick={event => {
              event.stopPropagation()
              onZoom(selectedTableIds)
            }}
          >
            <Maximize2 size={12} strokeWidth={2.2} />
            Zoom
          </button>
          <button
            type="button"
            disabled={disabled}
            className={`${styles.selectionToolbarButton} ${styles.selectionToolbarButtonPrimary} ${disabled ? styles.selectionToolbarButtonDisabled : ''}`}
            onClick={event => {
              event.stopPropagation()
              onOpenGroupMenu(event.currentTarget.getBoundingClientRect())
            }}
          >
            <FolderPlus size={12} strokeWidth={2.2} />
            Group
            <ChevronDown size={11} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            disabled={disabled}
            className={`${styles.selectionToolbarButton} ${disabled ? styles.selectionToolbarButtonDisabled : ''}`}
            onClick={onCopy}
          >
            {copied ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} strokeWidth={2.2} />}
            {copied ? 'Copied' : 'Copy context'}
          </button>
          <button
            type="button"
            disabled={disabled}
            className={`${styles.selectionToolbarButton} ${disabled ? styles.selectionToolbarButtonDisabled : ''}`}
            onClick={event => {
              event.stopPropagation()
              onHide(selectedTableIds)
            }}
          >
            <EyeOff size={12} strokeWidth={2.2} />
            Hide
          </button>
        </div>
      </div>
    </div>
  )
}
