import { GripVertical } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { tableNameFromId, useSelectionContext } from '../hooks/useSelectionContext'
import type { Group, SchemaData, SchemaTable } from '../../types'
import { SidebarGroupList } from './sidebar/SidebarGroupList'
import { SidebarMenus } from './sidebar/SidebarMenus'
import { SidebarSelectionCard } from './sidebar/SidebarSelectionCard'
import { arraysEqual, reorderList, tableIdFromTable, type DragItem, type DragTarget, type DropPosition } from './sidebar/shared'
import styles from './Sidebar.module.css'

interface SidebarProps {
  schemaData: SchemaData
  groups: Group[]
  onSelectGroup: (groupId: string) => void
  onOpenGroupModal: (initialTableName?: string | null, editGroupId?: string | null, initialTableNames?: string[] | null) => void
  onAssignTableToGroup: (tableId: string, groupId: string) => void
  onAssignTablesToGroup: (tableIds: string[], groupId: string) => void
  onUnassignTable: (tableId: string, groupId?: string) => void
  onReorderGroups: (groupIds: string[]) => void
  onReorderGroupTables: (groupId: string, tableIds: string[]) => void
}

export function Sidebar({
  schemaData,
  groups,
  onSelectGroup,
  onOpenGroupModal,
  onAssignTableToGroup,
  onAssignTablesToGroup,
  onUnassignTable,
  onReorderGroups,
  onReorderGroupTables,
}: SidebarProps) {
  const [search, setSearch] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ x: number; y: number; groupId: string } | null>(null)
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null)
  const [copiedSelectionContext, setCopiedSelectionContext] = useState(false)
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const [ungroupedOrder, setUngroupedOrder] = useState<string[]>([])
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    clearSelection,
    deselectTables,
    hiddenGroups,
    hiddenTables,
    selectedTables,
    selectTables,
    setFitToNodes,
    setHiddenTables,
    setSearchQuery,
    setZoomToTable,
    toggleGroupVisibility,
    toggleTable,
    toggleTableVisibility,
  } = useStore()

  const {
    contextText: selectionContextText,
    selectedTableIds,
    selectedTableNames,
    selectedTables: selectedTableSet,
  } = useSelectionContext(schemaData)

  function handleSearch(value: string) {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setSearchQuery(value), 200)
  }

  useEffect(() => {
    if (!ctxMenu && !groupCtxMenu && !selectionMenu) return
    const close = () => {
      setCtxMenu(null)
      setGroupCtxMenu(null)
      setSelectionMenu(null)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu, groupCtxMenu, selectionMenu])

  useEffect(() => {
    if (!copiedSelectionContext) return
    const timer = window.setTimeout(() => setCopiedSelectionContext(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copiedSelectionContext])

  const tableToGroups = useMemo(() => {
    const map = new Map<string, Group[]>()
    for (const group of groups) {
      for (const tableName of group.tables) {
        const existing = map.get(tableName)
        if (existing) existing.push(group)
        else map.set(tableName, [group])
      }
    }
    return map
  }, [groups])

  const tableByName = useMemo(
    () => new Map(schemaData.tables.map(table => [table.name, table])),
    [schemaData.tables]
  )

  const filteredTables = useMemo(() => {
    const query = search.toLowerCase()
    if (!query) return schemaData.tables
    return schemaData.tables.filter(table =>
      table.name.toLowerCase().includes(query) ||
      table.columns.some(column => column.name.toLowerCase().includes(query))
    )
  }, [schemaData.tables, search])

  const columnMatches = useMemo(() => {
    const query = search.toLowerCase()
    if (!query) return new Map<string, string[]>()

    const map = new Map<string, string[]>()
    for (const table of filteredTables) {
      if (table.name.toLowerCase().includes(query)) continue
      const cols = table.columns
        .filter(column => column.name.toLowerCase().includes(query))
        .map(column => column.name)
      if (cols.length) map.set(table.name, cols)
    }
    return map
  }, [filteredTables, search])

  const tablesByGroup = useMemo(() => {
    const map = new Map<string, SchemaTable[]>()
    for (const table of filteredTables) {
      const tableGroups = tableToGroups.get(table.name)
      if (!tableGroups) continue
      for (const group of tableGroups) {
        if (!map.has(group.id)) map.set(group.id, [])
        map.get(group.id)!.push(table)
      }
    }
    return map
  }, [filteredTables, tableToGroups])

  const ungroupedTables = useMemo(
    () => filteredTables.filter(table => !tableToGroups.has(table.name)),
    [filteredTables, tableToGroups]
  )

  useEffect(() => {
    const nextIds = ungroupedTables.map(tableIdFromTable)
    setUngroupedOrder(current => {
      const retained = current.filter(id => nextIds.includes(id))
      const missing = nextIds.filter(id => !retained.includes(id))
      const next = [...retained, ...missing]
      return arraysEqual(current, next) ? current : next
    })
  }, [ungroupedTables])

  const orderedUngroupedTables = useMemo(() => {
    const tableMap = new Map(ungroupedTables.map(table => [tableIdFromTable(table), table]))
    return ungroupedOrder
      .map(id => tableMap.get(id))
      .filter((table): table is SchemaTable => table != null)
  }, [ungroupedTables, ungroupedOrder])

  const visibleTableOrder = useMemo(() => {
    const ids: string[] = []

    for (const group of groups) {
      const groupTables = search
        ? tablesByGroup.get(group.id) ?? []
        : group.tables
            .map(name => tableByName.get(name))
            .filter((table): table is SchemaTable => table != null)

      if (!expandedGroups.has(group.id)) continue
      for (const table of groupTables) ids.push(tableIdFromTable(table))
    }

    for (const table of orderedUngroupedTables) ids.push(tableIdFromTable(table))
    return ids
  }, [expandedGroups, groups, orderedUngroupedTables, search, tableByName, tablesByGroup])

  const allExpanded = groups.length > 0 && groups.every(group => expandedGroups.has(group.id))
  const canDragReorder = search.trim().length === 0

  function toggleExpandAll() {
    setExpandedGroups(allExpanded ? new Set() : new Set(groups.map(group => group.id)))
  }

  function toggleGroupExpand(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  function handleTableClick(event: React.MouseEvent<HTMLDivElement>, nodeId: string) {
    if (event.shiftKey && selectionAnchorId) {
      const start = visibleTableOrder.indexOf(selectionAnchorId)
      const end = visibleTableOrder.indexOf(nodeId)
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start]
        const rangeIds = visibleTableOrder.slice(from, to + 1)
        const anchorSelected = selectedTables.has(selectionAnchorId)
        const targetSelected = selectedTables.has(nodeId)
        if (anchorSelected && targetSelected && rangeIds.every(id => selectedTables.has(id))) {
          deselectTables(rangeIds)
        } else {
          selectTables(rangeIds)
        }
        setSelectionAnchorId(nodeId)
        return
      }
    }

    toggleTable(nodeId)
    setSelectionAnchorId(nodeId)
  }

  function beginDrag(item: DragItem) {
    if (!canDragReorder) return
    setDragItem(item)
    setDragTarget(null)
  }

  function clearDragState() {
    setDragItem(null)
    setDragTarget(null)
  }

  function updateDropPosition(event: React.DragEvent<HTMLElement>, nextTarget: DragTarget) {
    event.preventDefault()
    event.stopPropagation()
    setDragTarget(nextTarget)
  }

  function handleGroupDrop(groupId: string) {
    if (!dragItem || dragItem.type !== 'group') return
    if (!dragTarget || dragTarget.type !== 'group' || dragTarget.groupId !== groupId) return

    const currentOrder = groups.map(group => group.id)
    const nextOrder = reorderList(currentOrder, dragItem.groupId, groupId, dragTarget.position)
    if (!arraysEqual(nextOrder, currentOrder)) {
      onReorderGroups(nextOrder)
    }
    clearDragState()
  }

  function handleGroupTableDrop(groupId: string, targetTableId: string) {
    if (!dragItem || dragItem.type !== 'group-table' || dragItem.groupId !== groupId) return
    if (!dragTarget || dragTarget.type !== 'group-table' || dragTarget.groupId !== groupId || dragTarget.tableId !== targetTableId) return

    const group = groups.find(item => item.id === groupId)
    if (!group) {
      clearDragState()
      return
    }

    const currentOrder = group.tables
      .map(name => tableByName.get(name))
      .filter((table): table is SchemaTable => table != null)
      .map(tableIdFromTable)
    const nextOrder = reorderList(currentOrder, dragItem.tableId, targetTableId, dragTarget.position)
    if (!arraysEqual(nextOrder, currentOrder)) {
      onReorderGroupTables(groupId, nextOrder)
    }
    clearDragState()
  }

  function handleUngroupedDrop(targetTableId: string) {
    if (!dragItem || dragItem.type !== 'ungrouped-table') return
    if (!dragTarget || dragTarget.type !== 'ungrouped-table' || dragTarget.tableId !== targetTableId) return

    setUngroupedOrder(current => reorderList(current, dragItem.tableId, targetTableId, dragTarget.position))
    clearDragState()
  }

  function renderDragHandle(
    label: string,
    disabled: boolean,
    onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void
  ) {
    return (
      <button
        type="button"
        draggable={!disabled}
        className={`${styles.dragHandle} ${disabled ? styles.dragHandleDisabled : ''}`}
        onClick={event => event.stopPropagation()}
        onMouseDown={event => event.stopPropagation()}
        onDragStart={event => {
          if (disabled) {
            event.preventDefault()
            return
          }
          onDragStart(event)
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', label)
        }}
        onDragEnd={clearDragState}
        title={disabled ? 'Reordering is disabled while searching' : label}
      >
        <GripVertical size={12} strokeWidth={2.2} />
      </button>
    )
  }

  function renderTableRow(table: SchemaTable, options?: { indent?: boolean; dragScope?: 'group' | 'ungrouped'; groupId?: string }) {
    const nodeId = tableIdFromTable(table)
    const isSelected = selectedTables.has(nodeId)
    const isHidden = hiddenTables.has(nodeId)
    const matchedCols = columnMatches.get(table.name)
    const dragScope = options?.dragScope ?? null
    const isDragTarget = dragScope === 'group'
      ? dragTarget?.type === 'group-table' && dragTarget.groupId === options?.groupId && dragTarget.tableId === nodeId
      : dragScope === 'ungrouped'
        ? dragTarget?.type === 'ungrouped-table' && dragTarget.tableId === nodeId
        : false

    return (
      <div
        key={nodeId}
        onContextMenu={event => {
          event.preventDefault()
          event.stopPropagation()
          setCtxMenu({ x: event.clientX, y: event.clientY, nodeId })
        }}
        onClick={event => handleTableClick(event, nodeId)}
        onDragOver={dragScope ? event => {
          const rect = event.currentTarget.getBoundingClientRect()
          const position: DropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          if (dragScope === 'group' && dragItem?.type === 'group-table' && dragItem.groupId === options?.groupId) {
            updateDropPosition(event, { type: 'group-table', groupId: options.groupId!, tableId: nodeId, position })
          }
          if (dragScope === 'ungrouped' && dragItem?.type === 'ungrouped-table') {
            updateDropPosition(event, { type: 'ungrouped-table', tableId: nodeId, position })
          }
        } : undefined}
        onDrop={dragScope ? event => {
          event.preventDefault()
          event.stopPropagation()
          if (dragScope === 'group' && options?.groupId) handleGroupTableDrop(options.groupId, nodeId)
          if (dragScope === 'ungrouped') handleUngroupedDrop(nodeId)
        } : undefined}
        className={[
          styles.tableRow,
          options?.indent ? styles.tableRowNested : '',
          isDragTarget && dragTarget?.position === 'before' ? styles.dropTargetBefore : '',
          isDragTarget && dragTarget?.position === 'after' ? styles.dropTargetAfter : '',
        ].filter(Boolean).join(' ')}
        style={{ background: isSelected ? 'var(--sel-light)' : 'transparent', opacity: isHidden ? 0.35 : 1 }}
      >
        {dragScope && renderDragHandle(
          dragScope === 'group' ? 'Reorder grouped table' : 'Reorder ungrouped table',
          !canDragReorder,
          () => dragScope === 'group' && options?.groupId
            ? beginDrag({ type: 'group-table', groupId: options.groupId, tableId: nodeId })
            : beginDrag({ type: 'ungrouped-table', tableId: nodeId })
        )}
        <div className={styles.tableMeta}>
          <div className={styles.tableName} style={{ color: isSelected ? 'var(--sel)' : 'var(--text-1)', textDecoration: isHidden ? 'line-through' : 'none' }}>
            {table.name}
          </div>
          {matchedCols && <div className={styles.tableColumnsMatch}>{matchedCols.join(', ')}</div>}
        </div>
        <span className={styles.tableColumnCount}>{table.columns.length}</span>
      </div>
    )
  }

  async function handleCopySelectionContext(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!selectionContextText) return
    await navigator.clipboard.writeText(selectionContextText)
    setCopiedSelectionContext(true)
  }

  function zoomToGroup(groupId: string) {
    const group = groups.find(item => item.id === groupId)
    if (!group) return
    const ids = group.tables
      .map(name => tableByName.get(name))
      .filter((table): table is SchemaTable => table != null)
      .map(tableIdFromTable)
    if (ids.length > 0) setFitToNodes(ids)
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.searchWrap}>
        <input
          value={search}
          onChange={event => handleSearch(event.target.value)}
          placeholder="Search tables and columns..."
          className={styles.searchInput}
        />
      </div>

      <SidebarSelectionCard
        selectedCount={selectedTableSet.size}
        selectedTableIds={selectedTableIds}
        copied={copiedSelectionContext}
        onClear={clearSelection}
        onZoom={setFitToNodes}
        onOpenGroupMenu={rect => setSelectionMenu({ x: rect.left, y: rect.bottom + 8 })}
        onCopy={handleCopySelectionContext}
        onHide={ids => {
          ids.forEach(id => toggleTableVisibility(id))
          clearSelection()
        }}
      />

      <div className={styles.sectionLabel}>Groups</div>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.toolbarButton} ${allExpanded ? styles.toolbarButtonActive : ''}`} onClick={toggleExpandAll}>
          {allExpanded ? 'Collapse groups' : 'Expand groups'}
        </button>
        <button type="button" className={`${styles.toolbarButton} ${styles.toolbarButtonPrimary}`} onClick={() => onOpenGroupModal()}>
          New group
        </button>
      </div>

      {hiddenTables.size > 0 && (
        <div className={styles.showHiddenWrap}>
          <button className={styles.showHiddenButton} onClick={() => setHiddenTables([])}>
            Show hidden tables ({hiddenTables.size})
          </button>
        </div>
      )}

      <div className={styles.content}>
        <SidebarMenus
          groups={groups}
          tableByName={tableByName}
          ctxMenu={ctxMenu}
          groupCtxMenu={groupCtxMenu}
          selectionMenu={selectionMenu}
          hiddenTables={hiddenTables}
          selectedCount={selectedTableSet.size}
          selectedTableIds={selectedTableIds}
          selectedTableNames={selectedTableNames}
          tableToGroups={tableToGroups}
          onCloseTableMenu={() => setCtxMenu(null)}
          onCloseGroupMenu={() => setGroupCtxMenu(null)}
          onCloseSelectionMenu={() => setSelectionMenu(null)}
          onZoomToTable={setZoomToTable}
          onToggleTableVisibility={toggleTableVisibility}
          onUnassignTable={onUnassignTable}
          onOpenGroupModal={onOpenGroupModal}
          onAssignTableToGroup={onAssignTableToGroup}
          onAssignTablesToGroup={onAssignTablesToGroup}
          onZoomToGroup={zoomToGroup}
        />

        <SidebarGroupList
          groups={groups}
          search={search}
          hiddenGroups={hiddenGroups}
          selectedTables={selectedTables}
          expandedGroups={expandedGroups}
          tablesByGroup={tablesByGroup}
          tableByName={tableByName}
          dragItem={dragItem}
          dragTarget={dragTarget}
          canDragReorder={canDragReorder}
          onToggleGroupExpand={toggleGroupExpand}
          onSelectGroup={onSelectGroup}
          onOpenGroupMenu={(groupId, x, y) => setGroupCtxMenu({ x, y, groupId })}
          onUpdateDropPosition={updateDropPosition}
          onHandleGroupDrop={handleGroupDrop}
          onBeginGroupDrag={groupId => beginDrag({ type: 'group', groupId })}
          onZoomToGroup={zoomToGroup}
          onEditGroup={groupId => onOpenGroupModal(null, groupId)}
          onToggleGroupVisibility={toggleGroupVisibility}
          renderDragHandle={renderDragHandle}
          renderTableRow={renderTableRow}
        />

        {orderedUngroupedTables.length > 0 && (
          <div>
            {groups.length > 0 && <div className={styles.ungroupedLabel}>Ungrouped</div>}
            {orderedUngroupedTables.map(table => renderTableRow(table, { dragScope: 'ungrouped' }))}
          </div>
        )}
      </div>
    </aside>
  )
}
