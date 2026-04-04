import { ChevronDown, ChevronRight, Eye, EyeOff, Maximize2, PencilLine } from 'lucide-react'
import type { Group, SchemaTable } from '../../../types'
import type { DragItem, DragTarget, DropPosition } from './shared'
import { tableIdFromTable } from './shared'
import styles from '../Sidebar.module.css'

interface SidebarGroupListProps {
  groups: Group[]
  search: string
  hiddenGroups: Set<string>
  selectedTables: Set<string>
  expandedGroups: Set<string>
  tablesByGroup: Map<string, SchemaTable[]>
  tableByName: Map<string, SchemaTable>
  dragItem: DragItem | null
  dragTarget: DragTarget | null
  canDragReorder: boolean
  onToggleGroupExpand: (groupId: string) => void
  onSelectGroup: (groupId: string) => void
  onOpenGroupMenu: (groupId: string, x: number, y: number) => void
  onUpdateDropPosition: (event: React.DragEvent<HTMLElement>, nextTarget: DragTarget) => void
  onHandleGroupDrop: (groupId: string) => void
  onBeginGroupDrag: (groupId: string) => void
  onZoomToGroup: (groupId: string) => void
  onEditGroup: (groupId: string) => void
  onToggleGroupVisibility: (groupId: string) => void
  renderDragHandle: (label: string, disabled: boolean, onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void) => React.ReactNode
  renderTableRow: (table: SchemaTable, options?: { indent?: boolean; dragScope?: 'group' | 'ungrouped'; groupId?: string }) => React.ReactNode
}

export function SidebarGroupList({
  groups,
  search,
  hiddenGroups,
  selectedTables,
  expandedGroups,
  tablesByGroup,
  tableByName,
  dragItem,
  dragTarget,
  canDragReorder,
  onToggleGroupExpand,
  onSelectGroup,
  onOpenGroupMenu,
  onUpdateDropPosition,
  onHandleGroupDrop,
  onBeginGroupDrag,
  onZoomToGroup,
  onEditGroup,
  onToggleGroupVisibility,
  renderDragHandle,
  renderTableRow,
}: SidebarGroupListProps) {
  return (
    <>
      {groups.map(group => {
        const groupTables = tablesByGroup.get(group.id) ?? []
        if (groupTables.length === 0 && search) return null

        const isExpanded = expandedGroups.has(group.id)
        const isHidden = hiddenGroups.has(group.id)
        const displayTables = search
          ? groupTables
          : group.tables
              .map(name => tableByName.get(name))
              .filter((table): table is SchemaTable => table != null)

        const totalCount = group.tables.length
        const selectedCount = displayTables.filter(table => selectedTables.has(tableIdFromTable(table))).length
        const allGroupSelected = selectedCount === totalCount && totalCount > 0
        const isGroupDropTarget = dragTarget?.type === 'group' && dragTarget.groupId === group.id

        return (
          <div key={group.id} className={styles.groupRowWrap}>
            <div
              className={[
                styles.groupRow,
                isHidden ? styles.groupRowHidden : '',
                isGroupDropTarget && dragTarget?.position === 'before' ? styles.dropTargetBefore : '',
                isGroupDropTarget && dragTarget?.position === 'after' ? styles.dropTargetAfter : '',
              ].filter(Boolean).join(' ')}
              style={{ opacity: isHidden ? 0.5 : 1 }}
              onContextMenu={event => {
                event.preventDefault()
                event.stopPropagation()
                onOpenGroupMenu(group.id, event.clientX, event.clientY)
              }}
              onDragOver={event => {
                if (dragItem?.type !== 'group') return
                const rect = event.currentTarget.getBoundingClientRect()
                const position: DropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                onUpdateDropPosition(event, { type: 'group', groupId: group.id, position })
              }}
              onDrop={event => {
                event.preventDefault()
                event.stopPropagation()
                onHandleGroupDrop(group.id)
              }}
            >
              {renderDragHandle('Reorder group', !canDragReorder, () => onBeginGroupDrag(group.id))}
              <button className={styles.groupToggle} onClick={() => onToggleGroupExpand(group.id)}>
                {isExpanded ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronRight size={12} strokeWidth={2.4} />}
              </button>
              <button className={styles.groupBody} onClick={() => onSelectGroup(group.id)}>
                <div className={styles.groupIdentity}>
                  <div className={styles.groupSwatch} style={{ background: group.color }} />
                  <span className={styles.groupName}>{group.name}</span>
                  {isHidden && <span className={styles.groupStateBadge}>Hidden</span>}
                </div>
                <div className={styles.groupMetaRow}>
                  <span
                    className={styles.groupCount}
                    style={{ color: allGroupSelected ? 'var(--accent)' : selectedCount > 0 ? 'var(--text-2)' : 'var(--text-3)' }}
                  >
                    {selectedCount > 0 ? `${selectedCount}/` : ''}{totalCount} table{totalCount !== 1 ? 's' : ''}
                  </span>
                  {displayTables.length !== totalCount && <span className={styles.groupFilteredMeta}>{displayTables.length} shown</span>}
                </div>
              </button>
              <button className={styles.groupActionButton} onClick={() => onZoomToGroup(group.id)} title="Zoom to group">
                <Maximize2 size={12} strokeWidth={2.2} />
              </button>
              <button className={styles.groupActionButton} onClick={() => onEditGroup(group.id)} title="Edit group">
                <PencilLine size={12} strokeWidth={2.2} />
              </button>
              <button className={styles.groupVisibilityButton} onClick={() => onToggleGroupVisibility(group.id)} title={isHidden ? 'Show group' : 'Hide group'}>
                {isHidden ? <Eye size={12} strokeWidth={2.2} /> : <EyeOff size={12} strokeWidth={2.2} />}
              </button>
            </div>
            {isExpanded && (
              <div className={styles.groupTables} style={{ borderLeftColor: group.color }}>
                {displayTables.map(table => renderTableRow(table, { indent: true, dragScope: 'group', groupId: group.id }))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
