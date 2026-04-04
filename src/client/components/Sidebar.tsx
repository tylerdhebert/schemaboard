import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  EyeOff,
  FolderMinus,
  FolderPlus,
  Layers3,
  Maximize2,
  PencilLine,
  Plus,
  X,
} from 'lucide-react'
import { useStore } from '../store'
import { generateCondensed, generateDDL } from '../lib/context-generator'
import type { Group, SchemaData, SchemaTable } from '../../types'
import styles from './Sidebar.module.css'

interface SidebarProps {
  schemaData: SchemaData
  groups: Group[]
  onSelectGroup: (groupId: string) => void
  onOpenGroupModal: (initialTableName?: string | null, editGroupId?: string | null, initialTableNames?: string[] | null) => void
  onAssignTableToGroup: (tableId: string, groupId: string) => void
  onAssignTablesToGroup: (tableIds: string[], groupId: string) => void
  onUnassignTable: (tableId: string, groupId?: string) => void
}

function tableNameFromId(tableId: string): string {
  return tableId.split('.').slice(1).join('.')
}

function MenuHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string
  title: string
  meta?: string
}) {
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
    <button
      type="button"
      className={`${styles.menuAction} ${tone === 'danger' ? styles.menuActionDanger : ''}`}
      onClick={onClick}
    >
      <span className={styles.menuActionIcon}>{icon}</span>
      <span className={styles.menuActionBody}>
        <span className={styles.menuActionLabel}>{label}</span>
        {meta && <span className={styles.menuActionMeta}>{meta}</span>}
      </span>
    </button>
  )
}

export function Sidebar({
  schemaData,
  groups,
  onSelectGroup,
  onOpenGroupModal,
  onAssignTableToGroup,
  onAssignTablesToGroup,
  onUnassignTable,
}: SidebarProps) {
  const [search, setSearch] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ x: number; y: number; groupId: string } | null>(null)
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null)
  const [copiedSelectionContext, setCopiedSelectionContext] = useState(false)
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    clearSelection,
    format,
    deselectTables,
    hiddenGroups,
    hiddenTables,
    selectedTables,
    selectTables,
    setFitToNodes,
    setSearchQuery,
    setZoomToTable,
    toggleGroupVisibility,
    toggleTable,
    toggleTableVisibility,
  } = useStore()

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

  const filtered = useMemo(() => {
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
    for (const table of filtered) {
      if (table.name.toLowerCase().includes(query)) continue
      const cols = table.columns
        .filter(column => column.name.toLowerCase().includes(query))
        .map(column => column.name)
      if (cols.length) map.set(table.name, cols)
    }
    return map
  }, [filtered, search])

  const tablesByGroup = useMemo(() => {
    const map = new Map<string, SchemaTable[]>()
    for (const table of filtered) {
      const tableGroups = tableToGroups.get(table.name)
      if (!tableGroups) continue
      for (const group of tableGroups) {
        if (!map.has(group.id)) map.set(group.id, [])
        map.get(group.id)!.push(table)
      }
    }
    return map
  }, [filtered, tableToGroups])

  const ungroupedTables = useMemo(
    () => filtered.filter(table => !tableToGroups.has(table.name)),
    [filtered, tableToGroups]
  )

  const visibleTableOrder = useMemo(() => {
    const ids: string[] = []

    for (const group of groups) {
      const groupTables = search
        ? tablesByGroup.get(group.id) ?? []
        : group.tables
            .map(name => tableByName.get(name))
            .filter((table): table is SchemaTable => table != null)

      if (!expandedGroups.has(group.id)) continue
      for (const table of groupTables) {
        ids.push(`${table.schema}.${table.name}`)
      }
    }

    for (const table of ungroupedTables) {
      ids.push(`${table.schema}.${table.name}`)
    }

    return ids
  }, [groups, search, tablesByGroup, tableByName, expandedGroups, ungroupedTables])

  const allExpanded = groups.length > 0 && groups.every(group => expandedGroups.has(group.id))

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

  function renderTableRow(table: SchemaTable, options?: { indent?: boolean }) {
    const nodeId = `${table.schema}.${table.name}`
    const isSelected = selectedTables.has(nodeId)
    const isHidden = hiddenTables.has(nodeId)
    const matchedCols = columnMatches.get(table.name)
    const indent = options?.indent ?? false

    return (
      <div
        key={nodeId}
        onContextMenu={event => {
          event.preventDefault()
          event.stopPropagation()
          setCtxMenu({ x: event.clientX, y: event.clientY, nodeId })
        }}
        onClick={event => handleTableClick(event, nodeId)}
        className={`${styles.tableRow} ${indent ? styles.tableRowNested : ''}`}
        style={{
          background: isSelected ? 'var(--sel-light)' : 'transparent',
          opacity: isHidden ? 0.35 : 1,
        }}
      >
        <div className={styles.tableMeta}>
          <div
            className={styles.tableName}
            style={{
              color: isSelected ? 'var(--sel)' : 'var(--text-1)',
              textDecoration: isHidden ? 'line-through' : 'none',
            }}
          >
            {table.name}
          </div>
          {matchedCols && (
            <div className={styles.tableColumnsMatch}>
              {matchedCols.join(', ')}
            </div>
          )}
        </div>
        <span className={styles.tableColumnCount}>{table.columns.length}</span>
      </div>
    )
  }

  const ctxMenuTableName = ctxMenu ? tableNameFromId(ctxMenu.nodeId) : null
  const ctxMenuGroups = ctxMenuTableName ? tableToGroups.get(ctxMenuTableName) ?? [] : []
  const assignableGroups = groups.filter(group => !ctxMenuGroups.some(item => item.id === group.id))
  const selectedTableIds = useMemo(() => [...selectedTables], [selectedTables])
  const selectedTableNames = useMemo(() => selectedTableIds.map(tableNameFromId), [selectedTableIds])
  const selectedTableData = useMemo(
    () => schemaData.tables.filter(table => selectedTables.has(`${table.schema}.${table.name}`)),
    [schemaData.tables, selectedTables]
  )
  const selectionRelevantFKs = useMemo(() => {
    const names = new Set(selectedTableData.map(table => table.name))
    return schemaData.foreignKeys.filter(fk => names.has(fk.parentTable))
  }, [schemaData.foreignKeys, selectedTableData])
  const selectionContextText = useMemo(() => {
    if (selectedTableData.length === 0) return ''
    return format === 'condensed'
      ? generateCondensed(selectedTableData, selectionRelevantFKs)
      : generateDDL(selectedTableData, selectionRelevantFKs)
  }, [selectedTableData, selectionRelevantFKs, format])

  async function handleCopySelectionContext(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!selectionContextText) return
    await navigator.clipboard.writeText(selectionContextText)
    setCopiedSelectionContext(true)
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

      <div className={styles.selectionSlot}>
        <div className={`${styles.selectionToolbar} ${selectedTables.size === 0 ? styles.selectionToolbarIdle : ''}`}>
          <div className={styles.selectionToolbarHeader}>
            <div className={styles.selectionToolbarSummary}>
              <span className={styles.selectionToolbarCount}>{selectedTables.size}</span>
              <div className={styles.selectionToolbarCopy}>
                <span className={styles.selectionToolbarEyebrow}>Selection</span>
                <span className={styles.selectionToolbarLabel}>
                  {selectedTables.size > 0
                    ? `${selectedTables.size} table${selectedTables.size === 1 ? '' : 's'} selected`
                    : 'No tables selected'}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={selectedTables.size === 0}
              className={`${styles.selectionToolbarButton} ${styles.selectionToolbarButtonMuted} ${selectedTables.size === 0 ? styles.selectionToolbarButtonDisabled : ''}`}
              onClick={event => {
                event.stopPropagation()
                clearSelection()
              }}
              title="Clear selection"
            >
              <X size={12} strokeWidth={2.2} />
            </button>
          </div>
          <div className={styles.selectionToolbarActions}>
            <button
              type="button"
              disabled={selectedTables.size === 0}
              className={`${styles.selectionToolbarButton} ${selectedTables.size === 0 ? styles.selectionToolbarButtonDisabled : ''}`}
              onClick={event => {
                event.stopPropagation()
                setFitToNodes(selectedTableIds)
              }}
            >
              <Maximize2 size={12} strokeWidth={2.2} />
              Zoom
            </button>
            <button
              type="button"
              disabled={selectedTables.size === 0}
              className={`${styles.selectionToolbarButton} ${styles.selectionToolbarButtonPrimary} ${selectedTables.size === 0 ? styles.selectionToolbarButtonDisabled : ''}`}
              onClick={event => {
                event.stopPropagation()
                const rect = event.currentTarget.getBoundingClientRect()
                setSelectionMenu(current => current ? null : { x: rect.left, y: rect.bottom + 8 })
              }}
            >
              <FolderPlus size={12} strokeWidth={2.2} />
              Group
              <ChevronDown size={11} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              disabled={selectedTables.size === 0}
              className={`${styles.selectionToolbarButton} ${selectedTables.size === 0 ? styles.selectionToolbarButtonDisabled : ''}`}
              onClick={handleCopySelectionContext}
            >
              {copiedSelectionContext ? <Check size={12} strokeWidth={2.4} /> : <Copy size={12} strokeWidth={2.2} />}
              {copiedSelectionContext ? 'Copied' : 'Copy context'}
            </button>
            <button
              type="button"
              disabled={selectedTables.size === 0}
              className={`${styles.selectionToolbarButton} ${selectedTables.size === 0 ? styles.selectionToolbarButtonDisabled : ''}`}
              onClick={event => {
                event.stopPropagation()
                selectedTableIds.forEach(id => toggleTableVisibility(id))
                clearSelection()
              }}
            >
              <EyeOff size={12} strokeWidth={2.2} />
              Hide
            </button>
          </div>
        </div>
      </div>

      <div className={styles.sectionLabel}>Groups</div>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolbarButton} ${allExpanded ? styles.toolbarButtonActive : ''}`}
          onClick={toggleExpandAll}
        >
          {allExpanded ? 'Collapse groups' : 'Expand groups'}
        </button>
        <button
          type="button"
          className={`${styles.toolbarButton} ${styles.toolbarButtonPrimary}`}
          onClick={() => onOpenGroupModal()}
        >
          <FolderPlus size={13} strokeWidth={2.2} />
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
        {selectionMenu && selectedTables.size > 0 && (
          <div
            className={`${styles.menu} ${styles.tableMenu}`}
            style={{ left: selectionMenu.x, top: selectionMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <MenuHeader
              eyebrow="Selection"
              title={`${selectedTables.size} table${selectedTables.size === 1 ? '' : 's'}`}
              meta="Group the current selection"
            />
            <MenuAction
              icon={<Layers3 size={14} strokeWidth={2.1} />}
              label="Add to new group"
              meta="Create one group from all selected tables"
              onClick={() => {
                onOpenGroupModal(null, null, selectedTableNames)
                setSelectionMenu(null)
              }}
            />
            <div className={styles.menuSectionLabel}>
              <span>Add to existing group</span>
            </div>
            {groups.length === 0 && (
              <div className={styles.menuEmpty}>No groups yet</div>
            )}
            {groups.map(group => (
              <button
                key={group.id}
                type="button"
                className={styles.menuGroupItem}
                onClick={() => {
                  onAssignTablesToGroup(selectedTableIds, group.id)
                  setSelectionMenu(null)
                }}
              >
                <div className={styles.menuSwatch} style={{ background: group.color }} />
                <span className={styles.menuGroupName}>{group.name}</span>
                <span className={styles.menuGroupMeta}>
                  <span className={styles.menuGroupCount}>{selectedTables.size}</span>
                  <span className={styles.menuGroupBadge}>
                    <Plus size={11} strokeWidth={2.4} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {ctxMenu && (
          <div
            className={`${styles.menu} ${styles.tableMenu}`}
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <MenuHeader
              eyebrow="Table"
              title={ctxMenuTableName ?? 'Table actions'}
              meta={`${ctxMenuGroups.length} group${ctxMenuGroups.length === 1 ? '' : 's'}`}
            />
            <MenuAction
              icon={<Maximize2 size={14} strokeWidth={2.1} />}
              label="Zoom to table"
              meta="Center this table on the board"
              onClick={() => {
                setZoomToTable(ctxMenu.nodeId)
                setCtxMenu(null)
              }}
            />
            <MenuAction
              icon={hiddenTables.has(ctxMenu.nodeId) ? <Eye size={14} strokeWidth={2.1} /> : <EyeOff size={14} strokeWidth={2.1} />}
              label={hiddenTables.has(ctxMenu.nodeId) ? 'Show table' : 'Hide table'}
              meta={hiddenTables.has(ctxMenu.nodeId) ? 'Bring it back into view' : 'Hide it from the board'}
              onClick={() => {
                toggleTableVisibility(ctxMenu.nodeId)
                setCtxMenu(null)
              }}
            />
            {ctxMenuGroups.map(group => (
              <MenuAction
                key={group.id}
                icon={<FolderMinus size={14} strokeWidth={2.1} />}
                label={`Remove from ${group.name}`}
                meta="Unassign from this group"
                onClick={() => {
                  onUnassignTable(ctxMenu.nodeId, group.id)
                  setCtxMenu(null)
                }}
                tone="danger"
              />
            ))}
            <div className={styles.menuDivider} />
            <MenuAction
              icon={<FolderPlus size={14} strokeWidth={2.1} />}
              label="Add to new group"
              meta="Create a new group from this table"
              onClick={() => {
                onOpenGroupModal(ctxMenuTableName)
                setCtxMenu(null)
              }}
            />
            <div className={styles.menuSectionLabel}>
              <span>Assign to group</span>
            </div>
            {assignableGroups.length === 0 && (
              <div className={styles.menuEmpty}>No other groups</div>
            )}
            {assignableGroups.map(group => (
              <button
                key={group.id}
                type="button"
                className={styles.menuGroupItem}
                onClick={() => {
                  onAssignTableToGroup(ctxMenu.nodeId, group.id)
                  setCtxMenu(null)
                }}
              >
                <div className={styles.menuSwatch} style={{ background: group.color }} />
                <span className={styles.menuGroupName}>{group.name}</span>
                <span className={styles.menuGroupBadge}>
                  <Plus size={11} strokeWidth={2.4} />
                </span>
              </button>
            ))}
          </div>
        )}

        {groupCtxMenu && (() => {
          const group = groups.find(item => item.id === groupCtxMenu.groupId)
          if (!group) return null

          return (
            <div
              className={`${styles.menu} ${styles.groupMenu}`}
              style={{ left: groupCtxMenu.x, top: groupCtxMenu.y }}
              onClick={event => event.stopPropagation()}
            >
              <MenuHeader
                eyebrow="Group"
                title={group.name}
                meta={`${group.tables.length} table${group.tables.length === 1 ? '' : 's'}`}
              />
              <MenuAction
                icon={<Maximize2 size={14} strokeWidth={2.1} />}
                label="Zoom to group"
                meta="Fit all group tables on the board"
                onClick={() => {
                  const ids = group.tables
                    .map(name => tableByName.get(name))
                    .filter((table): table is SchemaTable => table != null)
                    .map(table => `${table.schema}.${table.name}`)
                  if (ids.length > 0) setFitToNodes(ids)
                  setGroupCtxMenu(null)
                }}
              />
              <MenuAction
                icon={<PencilLine size={14} strokeWidth={2.1} />}
                label="Edit group"
                meta="Rename or recolor this group"
                onClick={() => {
                  onOpenGroupModal(null, group.id)
                  setGroupCtxMenu(null)
                }}
              />
            </div>
          )
        })()}

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
          const selectedCount = displayTables.filter(table => selectedTables.has(`${table.schema}.${table.name}`)).length
          const allGroupSelected = selectedCount === totalCount && totalCount > 0

          return (
            <div key={group.id} className={styles.groupRowWrap}>
              <div
                className={`${styles.groupRow} ${isHidden ? styles.groupRowHidden : ''}`}
                style={{ opacity: isHidden ? 0.5 : 1 }}
                onContextMenu={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  setGroupCtxMenu({ x: event.clientX, y: event.clientY, groupId: group.id })
                }}
              >
                <button className={styles.groupToggle} onClick={() => toggleGroupExpand(group.id)}>
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
                      style={{
                        color: allGroupSelected ? 'var(--accent)' : selectedCount > 0 ? 'var(--text-2)' : 'var(--text-3)',
                      }}
                    >
                      {selectedCount > 0 ? `${selectedCount}/` : ''}{totalCount} table{totalCount !== 1 ? 's' : ''}
                    </span>
                    {displayTables.length !== totalCount && (
                      <span className={styles.groupFilteredMeta}>{displayTables.length} shown</span>
                    )}
                  </div>
                </button>
                <button
                  className={styles.groupActionButton}
                  onClick={() => {
                    const ids = group.tables
                      .map(name => tableByName.get(name))
                      .filter((table): table is SchemaTable => table != null)
                      .map(table => `${table.schema}.${table.name}`)
                    if (ids.length > 0) setFitToNodes(ids)
                  }}
                  title="Zoom to group"
                >
                  <Maximize2 size={12} strokeWidth={2.2} />
                </button>
                <button
                  className={styles.groupActionButton}
                  onClick={() => onOpenGroupModal(null, group.id)}
                  title="Edit group"
                >
                  <PencilLine size={12} strokeWidth={2.2} />
                </button>
                <button
                  className={styles.groupVisibilityButton}
                  onClick={() => toggleGroupVisibility(group.id)}
                  title={isHidden ? 'Show group' : 'Hide group'}
                >
                  {isHidden ? <Eye size={12} strokeWidth={2.2} /> : <EyeOff size={12} strokeWidth={2.2} />}
                </button>
              </div>
              {isExpanded && (
                <div className={styles.groupTables} style={{ borderLeftColor: group.color }}>
                  {displayTables.map(table => renderTableRow(table, { indent: true }))}
                </div>
              )}
            </div>
          )
        })}

        {ungroupedTables.length > 0 && (
          <div>
            {groups.length > 0 && (
              <div className={styles.ungroupedLabel}>Ungrouped</div>
            )}
            {ungroupedTables.map(table => renderTableRow(table))}
          </div>
        )}
      </div>
    </aside>
  )
}
