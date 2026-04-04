import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  FolderKanban,
  GitCompareArrows,
  Link2,
  PlugZap,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { useStore } from '../store'
import { ConnectionModal } from './ConnectionModal'
import type { Connection } from '../../types'
import styles from './Header.module.css'

interface HeaderProps {
  isDemoMode: boolean
  hasActiveSource: boolean
  connections: Connection[]
  currentWorkspaceName: string | null
  isWorkspaceDirty: boolean
  canSaveWorkspace: boolean
  onRefresh: () => void
  onSaveWorkspace: () => void
  onOpenWorkspaces: () => void
  onOpenDiff: () => void
}

type MenuKey = 'workspace' | 'tools' | 'connections' | null

interface MenuButtonProps {
  icon: React.ReactNode
  label: string
  open: boolean
  disabled?: boolean
  onClick: () => void
}

function MenuButton({
  icon,
  label,
  open,
  disabled,
  onClick,
}: MenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles.menuTrigger} ${open ? styles.menuTriggerOpen : ''} ${disabled ? styles.menuTriggerDisabled : ''}`}
    >
      <span className={styles.menuTriggerIcon}>{icon}</span>
      <span className={styles.menuTriggerLabel}>{label}</span>
      <ChevronDown size={14} strokeWidth={2.2} className={`${styles.menuChevron} ${open ? styles.menuChevronOpen : ''}`} />
    </button>
  )
}

export function Header({
  isDemoMode,
  hasActiveSource,
  connections,
  currentWorkspaceName,
  isWorkspaceDirty,
  canSaveWorkspace,
  onRefresh,
  onSaveWorkspace,
  onOpenWorkspaces,
  onOpenDiff,
}: HeaderProps) {
  const { activeConnection, setActiveConnection, setDemoMode } = useStore()
  const [showModal, setShowModal] = useState(false)
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const menuWrapRef = useRef<HTMLDivElement | null>(null)

  const sourceLabel = useMemo(() => {
    if (activeConnection) return activeConnection
    if (isDemoMode) return 'Sample schema'
    return 'No source selected'
  }, [activeConnection, isDemoMode])

  const workspaceLabel = currentWorkspaceName
    ? `${currentWorkspaceName}${isWorkspaceDirty ? ' *' : ''}`
    : 'Unsaved view'

  const statusDetail = hasActiveSource
    ? currentWorkspaceName
      ? (isWorkspaceDirty ? 'Unsaved changes' : workspaceLabel)
      : workspaceLabel
    : 'Pick a live connection or enter demo mode'

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function toggleMenu(menu: Exclude<MenuKey, null>) {
    setOpenMenu(current => current === menu ? null : menu)
  }

  function closeMenu() {
    setOpenMenu(null)
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.leftRail}>
          <div className={styles.brandBlock}>
            <span className={styles.brand}>schemaboard</span>
            <span className={styles.brandMeta}>schema workbench</span>
          </div>

          <div className={styles.statusPill}>
            <span className={`${styles.modePill} ${isDemoMode ? styles.modePillDemo : styles.modePillLive}`}>
              {isDemoMode ? 'Demo' : 'Live'}
            </span>
            <div className={styles.statusText}>
              <div className={styles.statusTitle}>{sourceLabel}</div>
              <div className={styles.statusMeta}>{statusDetail}</div>
            </div>
          </div>
        </div>

        <div className={styles.menuRow} ref={menuWrapRef}>
          <div className={styles.menuGroup}>
            <MenuButton
              icon={<FolderKanban size={15} strokeWidth={2.2} />}
              label="Workspace"
              open={openMenu === 'workspace'}
              disabled={!hasActiveSource}
              onClick={() => toggleMenu('workspace')}
            />
            {openMenu === 'workspace' && (
              <div className={styles.menuPanel}>
                <div className={styles.menuSectionTitle}>Current view</div>
                <div className={styles.menuSummary}>{workspaceLabel}</div>
                {currentWorkspaceName && (
                  <div className={`${styles.menuHint} ${isWorkspaceDirty ? styles.menuHintDirty : ''}`}>
                    {isWorkspaceDirty ? 'Unsaved changes on the board' : 'Workspace is up to date'}
                  </div>
                )}
                {currentWorkspaceName && (
                  <button
                    type="button"
                    className={`${styles.menuAction} ${isWorkspaceDirty ? styles.menuActionPrimary : ''} ${!canSaveWorkspace ? styles.menuActionDisabled : ''}`}
                    disabled={!canSaveWorkspace}
                    onClick={() => {
                      closeMenu()
                      onSaveWorkspace()
                    }}
                  >
                    <FolderKanban size={14} strokeWidth={2.2} />
                    Save changes
                  </button>
                )}
                <button
                  type="button"
                  className={styles.menuActionPrimary}
                  onClick={() => {
                    closeMenu()
                    onOpenWorkspaces()
                  }}
                >
                  <FolderKanban size={14} strokeWidth={2.2} />
                  {currentWorkspaceName ? 'Open workspace manager' : 'Save as workspace'}
                </button>
              </div>
            )}
          </div>

          <div className={styles.menuGroup}>
            <MenuButton
              icon={<Sparkles size={15} strokeWidth={2.2} />}
              label="Tools"
              open={openMenu === 'tools'}
              disabled={!hasActiveSource}
              onClick={() => toggleMenu('tools')}
            />
            {openMenu === 'tools' && (
              <div className={styles.menuPanel}>
                <div className={styles.menuSectionTitle}>Board tools</div>
                <button
                  type="button"
                  className={styles.menuAction}
                  onClick={() => {
                    closeMenu()
                    onOpenDiff()
                  }}
                >
                  <GitCompareArrows size={14} strokeWidth={2.2} />
                  Open schema diff
                </button>
                <button
                  type="button"
                  className={styles.menuAction}
                  onClick={() => {
                    closeMenu()
                    onRefresh()
                  }}
                >
                  <RefreshCw size={14} strokeWidth={2.2} />
                  Refresh schema
                </button>
              </div>
            )}
          </div>

          <div className={styles.menuGroup}>
            <MenuButton
              icon={<PlugZap size={15} strokeWidth={2.2} />}
              label="Connections"
              open={openMenu === 'connections'}
              onClick={() => toggleMenu('connections')}
            />
            {openMenu === 'connections' && (
              <div className={`${styles.menuPanel} ${styles.connectionPanel}`}>
                <div className={styles.menuSectionTitle}>Mode</div>
                <button
                  type="button"
                  className={`${styles.menuAction} ${isDemoMode ? styles.menuActionSelected : ''}`}
                  onClick={() => {
                    closeMenu()
                    setDemoMode(!isDemoMode)
                  }}
                >
                  <Sparkles size={14} strokeWidth={2.2} />
                  {isDemoMode ? 'Exit demo mode' : 'Enter demo mode'}
                </button>

                <div className={styles.menuSectionTitle}>Live connections</div>
                {connections.length === 0 ? (
                  <div className={styles.menuEmpty}>No saved connections yet</div>
                ) : (
                  <div className={styles.connectionList}>
                    {connections.map(connection => {
                      const selected = activeConnection === connection.name
                      return (
                        <button
                          key={connection.name}
                          type="button"
                          className={`${styles.connectionItem} ${selected ? styles.connectionItemSelected : ''}`}
                          onClick={() => {
                            closeMenu()
                            setActiveConnection(connection.name)
                          }}
                        >
                          <span className={styles.connectionName}>{connection.name}</span>
                          {selected && <span className={styles.connectionTag}>Active</span>}
                        </button>
                      )
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className={styles.menuAction}
                  onClick={() => {
                    closeMenu()
                    setShowModal(true)
                  }}
                >
                  <Link2 size={14} strokeWidth={2.2} />
                  Manage connections
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showModal && (
        <ConnectionModal
          connections={connections}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
