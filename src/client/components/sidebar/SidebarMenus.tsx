import { Eye, EyeOff, FolderMinus, FolderPlus, Layers3, Maximize2, PencilLine, Plus } from 'lucide-react'
import { tableNameFromId } from '../../hooks/useSelectionContext'
import type { Group, SchemaTable } from '../../../types'
import styles from '../Sidebar.module.css'

interface MenuHeaderProps {
  eyebrow: string
  title: string
  meta?: string
}

function MenuHeader({ eyebrow, title, meta }: MenuHeaderProps) {
  return (
    <div className={styles.menuHeader}>
      <div className={styles.menuEyebrow}>{eyebrow}</div>
      <div className={styles.menuTitle}>{title}</div>
      {meta && <div className={styles.menuMeta}>{meta}</div>}
    </div>
  )
}

function MenuAction({
  icon,
  label,
  meta,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  meta?: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button type="button" className={`${styles.menuAction} ${tone === 'danger' ? styles.menuActionDanger : ''}`} onClick={onClick}>
      <span className={styles.menuActionIcon}>{icon}</span>
      <span className={styles.menuActionBody}>
        <span className={styles.menuActionLabel}>{label}</span>
        {meta && <span className={styles.menuActionMeta}>{meta}</span>}
      </span>
    </button>
  )
}

interface SidebarMenusProps {
  groups: Group[]
  tableByName: Map<string, SchemaTable>
  ctxMenu: { x: number; y: number; nodeId: string } | null
  groupCtxMenu: { x: number; y: number; groupId: string } | null
  selectionMenu: { x: number; y: number } | null
  hiddenTables: Set<string>
  selectedCount: number
  selectedTableIds: string[]
  selectedTableNames: string[]
  tableToGroups: Map<string, Group[]>
  onCloseTableMenu: () => void
  onCloseGroupMenu: () => void
  onCloseSelectionMenu: () => void
  onZoomToTable: (tableId: string) => void
  onToggleTableVisibility: (tableId: string) => void
  onUnassignTable: (tableId: string, groupId?: string) => void
  onOpenGroupModal: (initialTableName?: string | null, editGroupId?: string | null, initialTableNames?: string[] | null) => void
  onAssignTableToGroup: (tableId: string, groupId: string) => void
  onAssignTablesToGroup: (tableIds: string[], groupId: string) => void
  onZoomToGroup: (groupId: string) => void
}

export function SidebarMenus(props: SidebarMenusProps) {
  const {
    groups,
    tableByName,
    ctxMenu,
    groupCtxMenu,
    selectionMenu,
    hiddenTables,
    selectedCount,
    selectedTableIds,
    selectedTableNames,
    tableToGroups,
    onCloseTableMenu,
    onCloseGroupMenu,
    onCloseSelectionMenu,
    onZoomToTable,
    onToggleTableVisibility,
    onUnassignTable,
    onOpenGroupModal,
    onAssignTableToGroup,
    onAssignTablesToGroup,
    onZoomToGroup,
  } = props

  const ctxMenuTableName = ctxMenu ? tableNameFromId(ctxMenu.nodeId) : null
  const ctxMenuGroups = ctxMenuTableName ? tableToGroups.get(ctxMenuTableName) ?? [] : []
  const assignableGroups = groups.filter(group => !ctxMenuGroups.some(item => item.id === group.id))

  return (
    <>
      {selectionMenu && selectedCount > 0 && (
        <div className={`${styles.menu} ${styles.tableMenu}`} style={{ left: selectionMenu.x, top: selectionMenu.y }} onClick={event => event.stopPropagation()}>
          <MenuHeader eyebrow="Selection" title={`${selectedCount} table${selectedCount === 1 ? '' : 's'}`} meta="Group the current selection" />
          <MenuAction icon={<Layers3 size={14} strokeWidth={2.1} />} label="Add to new group" meta="Create one group from all selected tables" onClick={() => { onOpenGroupModal(null, null, selectedTableNames); onCloseSelectionMenu() }} />
          <div className={styles.menuSectionLabel}><span>Add to existing group</span></div>
          {groups.length === 0 && <div className={styles.menuEmpty}>No groups yet</div>}
          {groups.map(group => (
            <button key={group.id} type="button" className={styles.menuGroupItem} onClick={() => { onAssignTablesToGroup(selectedTableIds, group.id); onCloseSelectionMenu() }}>
              <div className={styles.menuSwatch} style={{ background: group.color }} />
              <span className={styles.menuGroupName}>{group.name}</span>
              <span className={styles.menuGroupMeta}><span className={styles.menuGroupBadge}><Plus size={11} strokeWidth={2.4} /></span></span>
            </button>
          ))}
        </div>
      )}

      {ctxMenu && (
        <div className={`${styles.menu} ${styles.tableMenu}`} style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={event => event.stopPropagation()}>
          <MenuHeader eyebrow="Table" title={ctxMenuTableName ?? 'Table actions'} meta={`${ctxMenuGroups.length} group${ctxMenuGroups.length === 1 ? '' : 's'}`} />
          <MenuAction icon={<Maximize2 size={14} strokeWidth={2.1} />} label="Zoom to table" meta="Center this table on the board" onClick={() => { onZoomToTable(ctxMenu.nodeId); onCloseTableMenu() }} />
          <MenuAction icon={hiddenTables.has(ctxMenu.nodeId) ? <Eye size={14} strokeWidth={2.1} /> : <EyeOff size={14} strokeWidth={2.1} />} label={hiddenTables.has(ctxMenu.nodeId) ? 'Show table' : 'Hide table'} meta={hiddenTables.has(ctxMenu.nodeId) ? 'Bring it back into view' : 'Hide it from the board'} onClick={() => { onToggleTableVisibility(ctxMenu.nodeId); onCloseTableMenu() }} />
          {ctxMenuGroups.map(group => (
            <MenuAction key={group.id} icon={<FolderMinus size={14} strokeWidth={2.1} />} label={`Remove from ${group.name}`} meta="Unassign from this group" onClick={() => { onUnassignTable(ctxMenu.nodeId, group.id); onCloseTableMenu() }} tone="danger" />
          ))}
          <div className={styles.menuDivider} />
          <MenuAction icon={<FolderPlus size={14} strokeWidth={2.1} />} label="Add to new group" meta="Create a new group from this table" onClick={() => { onOpenGroupModal(ctxMenuTableName); onCloseTableMenu() }} />
          <div className={styles.menuSectionLabel}><span>Assign to group</span></div>
          {assignableGroups.length === 0 && <div className={styles.menuEmpty}>No other groups</div>}
          {assignableGroups.map(group => (
            <button key={group.id} type="button" className={styles.menuGroupItem} onClick={() => { onAssignTableToGroup(ctxMenu.nodeId, group.id); onCloseTableMenu() }}>
              <div className={styles.menuSwatch} style={{ background: group.color }} />
              <span className={styles.menuGroupName}>{group.name}</span>
              <span className={styles.menuGroupBadge}><Plus size={11} strokeWidth={2.4} /></span>
            </button>
          ))}
        </div>
      )}

      {groupCtxMenu && (() => {
        const group = groups.find(item => item.id === groupCtxMenu.groupId)
        if (!group) return null

        return (
          <div className={`${styles.menu} ${styles.groupMenu}`} style={{ left: groupCtxMenu.x, top: groupCtxMenu.y }} onClick={event => event.stopPropagation()}>
            <MenuHeader eyebrow="Group" title={group.name} meta={`${group.tables.length} table${group.tables.length === 1 ? '' : 's'}`} />
            <MenuAction icon={<Maximize2 size={14} strokeWidth={2.1} />} label="Zoom to group" meta="Fit all group tables on the board" onClick={() => { onZoomToGroup(group.id); onCloseGroupMenu() }} />
            <MenuAction icon={<PencilLine size={14} strokeWidth={2.1} />} label="Edit group" meta="Rename or recolor this group" onClick={() => { onOpenGroupModal(null, group.id); onCloseGroupMenu() }} />
          </div>
        )
      })()}
    </>
  )
}
