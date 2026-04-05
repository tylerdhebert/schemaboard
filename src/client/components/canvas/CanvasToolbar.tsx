import { Binary, Boxes, ChevronDown, Eye, Network, RefreshCw, Rows3, Settings2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
  visible = true,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  visible?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`${styles.controlButton} ${styles.controlFlyoutButton} ${visible ? styles.controlFlyoutButtonVisible : ''} ${active ? styles.controlButtonActive : ''}`}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <span className={styles.controlButtonIcon}>{icon}</span>
      <span>{label}</span>
    </button>
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
  const { layoutType, resetLayout, setLayoutType } = useStore()
  const [hovered, setHovered] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const controlsRef = useRef<HTMLDivElement | null>(null)
  const currentLayout = LAYOUTS.find(layout => layout.type === layoutType)!
  const expanded = hovered || pinnedOpen

  useEffect(() => {
    if (!pinnedOpen) return

    const handleWindowPointerDown = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setPinnedOpen(false)
        setLayoutOpen(false)
      }
    }

    window.addEventListener('pointerdown', handleWindowPointerDown)
    return () => window.removeEventListener('pointerdown', handleWindowPointerDown)
  }, [pinnedOpen])

  useEffect(() => {
    if (!expanded) {
      setLayoutOpen(false)
    }
  }, [expanded])

  return (
    <div
      ref={controlsRef}
      className={`${styles.controls} ${expanded ? styles.controlsExpanded : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setHovered(false)
          setPinnedOpen(false)
          setLayoutOpen(false)
        }
      }}
    >
      <button
        type="button"
        title="Canvas tools"
        aria-label="Canvas tools"
        aria-expanded={expanded}
        className={`${styles.controlButton} ${styles.controlGearButton} ${expanded ? styles.controlButtonActive : ''}`}
        onClick={() => {
          if (pinnedOpen) {
            setPinnedOpen(false)
            setLayoutOpen(false)
            return
          }
          setPinnedOpen(true)
        }}
      >
        <span className={styles.controlButtonIcon}>
          <Settings2 size={16} strokeWidth={2.1} />
        </span>
      </button>

      <div className={styles.controlFlyout} aria-label="Canvas tools menu">
        <CanvasControlButton
          icon={<RefreshCw size={14} strokeWidth={2.2} />}
          label="Recalc"
          onClick={onResetLayout}
          visible={expanded}
        />
        <div className={`${styles.controlWrap} ${layoutOpen ? styles.controlWrapMenuOpen : ''}`}>
          <button
            type="button"
            title="Switch layout algorithm"
            className={`${styles.controlButton} ${styles.controlFlyoutButton} ${expanded ? styles.controlFlyoutButtonVisible : ''} ${layoutOpen ? styles.controlButtonActive : ''}`}
            aria-hidden={!expanded}
            aria-expanded={layoutOpen}
            tabIndex={expanded ? 0 : -1}
            onClick={event => {
              event.stopPropagation()
              setLayoutOpen(current => !current)
            }}
          >
            <span className={styles.controlButtonIcon}>{currentLayout.icon}</span>
            <span>{currentLayout.label}</span>
            <span className={`${styles.controlButtonIcon} ${layoutOpen ? styles.controlChevronOpen : ''}`}>
              <ChevronDown size={12} strokeWidth={2.2} />
            </span>
          </button>

          {layoutOpen && expanded && (
            <div
              className={styles.controlMenu}
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
                    setLayoutOpen(false)
                  }}
                >
                  <span className={styles.controlButtonIcon}>{layout.icon}</span>
                  <span>{layout.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <CanvasControlButton
          icon={<Rows3 size={14} strokeWidth={2.2} />}
          label={compactNodes ? 'Show columns' : 'Headers only'}
          onClick={onToggleCompactNodes}
          active={compactNodes}
          visible={expanded}
        />
        <CanvasControlButton
          icon={<Eye size={14} strokeWidth={2.2} />}
          label="Choose visible"
          onClick={onChooseVisible}
          visible={expanded}
        />
      </div>
    </div>
  )
}
