import { Binary, Boxes, ChevronDown, Eye, Network, RefreshCw, Rows3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import type { LayoutType } from '../../../types'
import styles from '../Canvas.module.css'

const LAYOUTS: { type: LayoutType; icon: React.ReactNode; label: string }[] = [
  { type: 'dagre', icon: <Binary size={14} strokeWidth={2} />, label: 'Dagre' },
  { type: 'force', icon: <Network size={14} strokeWidth={2} />, label: 'Force' },
  { type: 'elk', icon: <Boxes size={14} strokeWidth={2} />, label: 'ELK' },
]

function CanvasControlButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`${styles.controlButton} ${active ? styles.controlButtonActive : ''}`}
    >
      <span className={styles.controlButtonIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function LayoutDropdown() {
  const { layoutType, resetLayout, setLayoutType } = useStore()
  const [open, setOpen] = useState(false)
  const [dropRect, setDropRect] = useState<DOMRect | null>(null)
  const current = LAYOUTS.find(layout => layout.type === layoutType)!

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div className={styles.controlWrap}>
      <button
        type="button"
        title="Switch layout algorithm"
        onClick={event => {
          event.stopPropagation()
          if (open) {
            setOpen(false)
            return
          }
          setDropRect(event.currentTarget.getBoundingClientRect())
          setOpen(true)
        }}
        className={`${styles.controlButton} ${open ? styles.controlButtonActive : ''}`}
      >
        <span className={styles.controlButtonIcon}>{current.icon}</span>
        <span>{current.label}</span>
        <span className={styles.controlButtonIcon}>
          <ChevronDown size={12} strokeWidth={2.2} />
        </span>
      </button>

      {open && dropRect && (
        <div
          className={styles.controlMenu}
          style={{ left: dropRect.left, top: dropRect.bottom + 6 }}
          onClick={event => event.stopPropagation()}
        >
          {LAYOUTS.map(layout => (
            <button
              key={layout.type}
              type="button"
              className={`${styles.controlMenuItem} ${layout.type === layoutType ? styles.controlMenuItemActive : ''}`}
              onClick={() => {
                if (layout.type !== layoutType) {
                  setLayoutType(layout.type)
                  resetLayout()
                }
                setOpen(false)
              }}
            >
              <span className={styles.controlButtonIcon}>{layout.icon}</span>
              <span>{layout.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface CanvasToolbarProps {
  compactNodes: boolean
  onResetLayout: () => void
  onToggleCompactNodes: () => void
  onChooseVisible: () => void
}

export function CanvasToolbar({
  compactNodes,
  onResetLayout,
  onToggleCompactNodes,
  onChooseVisible,
}: CanvasToolbarProps) {
  return (
    <div className={styles.controls}>
      <CanvasControlButton
        icon={<RefreshCw size={14} strokeWidth={2.2} />}
        label="Recalc"
        onClick={onResetLayout}
      />
      <LayoutDropdown />
      <CanvasControlButton
        icon={<Rows3 size={14} strokeWidth={2.2} />}
        label={compactNodes ? 'Show columns' : 'Headers only'}
        onClick={onToggleCompactNodes}
        active={compactNodes}
      />
      <CanvasControlButton
        icon={<Eye size={14} strokeWidth={2.2} />}
        label="Choose visible"
        onClick={onChooseVisible}
      />
    </div>
  )
}
