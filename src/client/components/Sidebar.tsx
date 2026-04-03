import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Binary,
  Boxes,
  ChevronDown,
  ChevronRight,
  Eye,
  FolderPlus,
  Gauge,
  Maximize2,
  Network,
  RefreshCw,
  Rows3,
} from 'lucide-react'
import { useStore } from '../store'
import { TablePicker } from './TablePicker'
import type { SchemaData, Group, SchemaTable, LayoutType } from '../../types'

interface SidebarProps {
  schemaData: SchemaData
  groups: Group[]
  onSelectGroup: (groupId: string) => void
  onOpenGroupModal: (initialTableName?: string | null, editGroupId?: string | null) => void
  onAssignTableToGroup: (tableId: string, groupId: string) => void
  onUnassignTable: (tableId: string, groupId?: string) => void
}

function tableNameFromId(tableId: string): string {
  return tableId.split('.').slice(1).join('.')
}

function IconBtn({
  icon,
  label,
  onClick,
  active
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(true)
  }
  const handleLeave = () => {
    leaveTimer.current = setTimeout(() => setHovered(false), 120)
  }

  return (
    <button
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={onClick}
      title={label}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '5px 7px', borderRadius: 'var(--r-sm)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: active ? 'var(--accent-light)' : 'none',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
        color: active ? 'var(--accent)' : 'var(--text-3)',
        overflow: 'hidden', flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <span style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      <span style={{
        maxWidth: hovered ? 120 : 0,
        overflow: 'hidden', whiteSpace: 'nowrap',
        transition: 'max-width 0.18s ease, padding-left 0.18s ease',
        paddingLeft: hovered ? 5 : 0,
        fontSize: 11, fontWeight: 600,
      }}>
        {label}
      </span>
    </button>
  )
}

const LAYOUTS: { type: LayoutType; icon: React.ReactNode; label: string }[] = [
  { type: 'dagre', icon: <Binary size={14} strokeWidth={2} />, label: 'Dagre' },
  { type: 'force', icon: <Network size={14} strokeWidth={2} />, label: 'Force' },
  { type: 'elk', icon: <Boxes size={14} strokeWidth={2} />, label: 'ELK' },
]

function LayoutDropdown() {
  const { layoutType, setLayoutType, resetLayout } = useStore()
  const [open, setOpen] = useState(false)
  const [dropRect, setDropRect] = useState<DOMRect | null>(null)
  const current = LAYOUTS.find(l => l.type === layoutType)!

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={e => {
          e.stopPropagation()
          if (open) {
            setOpen(false)
            return
          }
          setDropRect(e.currentTarget.getBoundingClientRect())
          setOpen(true)
        }}
        title="Switch layout algorithm"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '5px 7px', borderRadius: 'var(--r-sm)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-strong)'}`,
          background: open ? 'var(--accent-light)' : 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
          color: open ? 'var(--accent)' : 'var(--text-3)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <span style={{ lineHeight: 1 }}>{current.icon}</span>
        <span style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center', color: open ? 'var(--accent)' : 'var(--text-3)' }}>
          <ChevronDown size={12} strokeWidth={2.2} />
        </span>
      </button>

      {open && dropRect && (
        <div
          style={{
            position: 'fixed',
            left: dropRect.left,
            top: dropRect.bottom + 4,
            zIndex: 300,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            minWidth: 110,
          }}
          onClick={e => e.stopPropagation()}
        >
          {LAYOUTS.map(layout => (
            <div
              key={layout.type}
              onClick={() => {
                if (layout.type !== layoutType) {
                  setLayoutType(layout.type)
                  resetLayout()
                }
                setOpen(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', cursor: 'pointer', fontSize: 12.5,
                fontWeight: layout.type === layoutType ? 700 : 500,
                color: layout.type === layoutType ? 'var(--accent)' : 'var(--text-1)',
                background: layout.type === layoutType ? 'var(--accent-light)' : 'transparent',
              }}
            >
              <span style={{ lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>{layout.icon}</span>
              {layout.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  schemaData,
  groups,
  onSelectGroup,
  onOpenGroupModal,
  onAssignTableToGroup,
  onUnassignTable,
}: SidebarProps) {
  const [search, setSearch] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ x: number; y: number; groupId: string } | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    selectedTables, hiddenGroups, hiddenTables, compactNodes,
    toggleTable, toggleGroupVisibility, toggleTableVisibility,
    setZoomToTable, resetLayout, setHiddenTables, setSearchQuery, setFitToNodes, toggleCompactNodes,
  } = useStore()

  const handleSearch = (value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setSearchQuery(value), 200)
  }

  useEffect(() => {
    if (!ctxMenu && !groupCtxMenu) return
    const close = () => {
      setCtxMenu(null)
      setGroupCtxMenu(null)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu, groupCtxMenu])

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

  const allTableIds = useMemo(
    () => schemaData.tables.map(t => `${t.schema}.${t.name}`),
    [schemaData.tables]
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return schemaData.tables
    return schemaData.tables.filter(table =>
      table.name.toLowerCase().includes(q) ||
      table.columns.some(column => column.name.toLowerCase().includes(q))
    )
  }, [schemaData.tables, search])

  const columnMatches = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return new Map<string, string[]>()
    const map = new Map<string, string[]>()
    for (const table of filtered) {
      if (table.name.toLowerCase().includes(q)) continue
      const cols = table.columns
        .filter(column => column.name.toLowerCase().includes(q))
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

  const allExpanded = groups.length > 0 && groups.every(group => expandedGroups.has(group.id))

  const toggleExpandAll = () => {
    setExpandedGroups(allExpanded ? new Set() : new Set(groups.map(group => group.id)))
  }

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const handleTableClick = (nodeId: string) => {
    toggleTable(nodeId)
  }

  const renderTableRow = (table: SchemaTable, indent = false) => {
    const nodeId = `${table.schema}.${table.name}`
    const isSelected = selectedTables.has(nodeId)
    const isHidden = hiddenTables.has(nodeId)
    const matchedCols = columnMatches.get(table.name)
    return (
      <div
        key={nodeId}
        onContextMenu={e => {
          e.preventDefault()
          e.stopPropagation()
          setCtxMenu({ x: e.clientX, y: e.clientY, nodeId })
        }}
        onClick={() => handleTableClick(nodeId)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: `5px 9px 5px ${indent ? 22 : 9}px`,
          borderRadius: 'var(--r-sm)', cursor: 'pointer', marginBottom: 1,
          background: isSelected ? 'var(--sel-light)' : 'transparent',
          opacity: isHidden ? 0.35 : 1,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 500,
            color: isSelected ? 'var(--sel)' : 'var(--text-1)',
            textDecoration: isHidden ? 'line-through' : 'none',
          }}>
            {table.name}
          </div>
          {matchedCols && (
            <div style={{
              fontSize: 10.5, color: 'var(--accent)', fontWeight: 500,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              marginTop: 1,
            }}>
              {matchedCols.join(', ')}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500, flexShrink: 0 }}>
          {table.columns.length}
        </span>
      </div>
    )
  }

  const ctxMenuTableName = ctxMenu ? tableNameFromId(ctxMenu.nodeId) : null
  const ctxMenuGroups = ctxMenuTableName ? tableToGroups.get(ctxMenuTableName) ?? [] : []
  const assignableGroups = groups.filter(group => !ctxMenuGroups.some(item => item.id === group.id))

  return (
    <aside style={{
      width: 320, background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', flexShrink: 0,
    }}>
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search tables & columns..."
          style={{
            width: '100%', padding: '7px 10px',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)', fontFamily: 'inherit',
            fontSize: 12.5, color: 'var(--text-1)',
            background: 'var(--bg)', outline: 'none',
          }}
        />
      </div>

      <div style={{
        padding: '6px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <IconBtn icon={<RefreshCw size={14} strokeWidth={2.2} />} label="Recalc layout" onClick={resetLayout} />
        <IconBtn icon={<Eye size={14} strokeWidth={2.2} />} label="Choose visible" onClick={() => setShowTablePicker(true)} />
        <IconBtn
          icon={allExpanded ? <Maximize2 size={14} strokeWidth={2.2} /> : <Gauge size={14} strokeWidth={2.2} />}
          label={allExpanded ? 'Collapse all' : 'Expand all'}
          onClick={toggleExpandAll}
          active={allExpanded}
        />
        <IconBtn
          icon={<Rows3 size={14} strokeWidth={2.2} />}
          label={compactNodes ? 'Show columns' : 'Headers only'}
          onClick={toggleCompactNodes}
          active={compactNodes}
        />
        <LayoutDropdown />
        <div style={{ flex: 1 }} />
        <IconBtn icon={<FolderPlus size={14} strokeWidth={2.2} />} label="New group" onClick={() => onOpenGroupModal()} />
      </div>

      {hiddenTables.size > 0 && (
        <div style={{ padding: '4px 10px', borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setHiddenTables([])}
            style={{
              width: '100%', padding: '4px 8px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border-strong)', background: 'none',
              fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
              color: 'var(--accent)', cursor: 'pointer',
            }}
          >
            Show all hidden ({hiddenTables.size})
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 6, position: 'relative' }}>
        {ctxMenu && (
          <div
            style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden', minWidth: 180,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              onClick={() => {
                setZoomToTable(ctxMenu.nodeId)
                setCtxMenu(null)
              }}
              style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500 }}
            >
              Zoom to
            </div>
            <div
              onClick={() => {
                toggleTableVisibility(ctxMenu.nodeId)
                setCtxMenu(null)
              }}
              style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500, borderTop: '1px solid var(--border)' }}
            >
              {hiddenTables.has(ctxMenu.nodeId) ? 'Show' : 'Hide'}
            </div>
            {ctxMenuGroups.map(group => (
              <div
                key={group.id}
                onClick={() => {
                  onUnassignTable(ctxMenu.nodeId, group.id)
                  setCtxMenu(null)
                }}
                style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500, borderTop: '1px solid var(--border)' }}
              >
                Unassign from {group.name}
              </div>
            ))}
            <div
              onClick={() => {
                onOpenGroupModal(ctxMenuTableName)
                setCtxMenu(null)
              }}
              style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500, borderTop: '1px solid var(--border)' }}
            >
              Add to new group
            </div>
            <div style={{
              padding: '4px 12px 3px', fontSize: 10, fontWeight: 700,
              color: 'var(--text-3)', textTransform: 'uppercase',
              letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)'
            }}>
              Assign to group
            </div>
            {assignableGroups.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-3)' }}>
                No other groups
              </div>
            )}
            {assignableGroups.map(group => (
              <div
                key={group.id}
                onClick={() => {
                  onAssignTableToGroup(ctxMenu.nodeId, group.id)
                  setCtxMenu(null)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-1)',
                }}
              >
                <div style={{ width: 9, height: 9, borderRadius: 3, background: group.color, flexShrink: 0 }} />
                {group.name}
              </div>
            ))}
          </div>
        )}

        {groupCtxMenu && (() => {
          const group = groups.find(item => item.id === groupCtxMenu.groupId)
          if (!group) return null

          return (
            <div
              style={{
                position: 'fixed', left: groupCtxMenu.x, top: groupCtxMenu.y, zIndex: 200,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden', minWidth: 150,
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                onClick={() => {
                  const ids = group.tables
                    .map(name => tableByName.get(name))
                    .filter((table): table is SchemaTable => table != null)
                    .map(table => `${table.schema}.${table.name}`)
                  if (ids.length > 0) setFitToNodes(ids)
                  setGroupCtxMenu(null)
                }}
                style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500 }}
              >
                Zoom to group
              </div>
              <div
                onClick={() => {
                  onOpenGroupModal(null, group.id)
                  setGroupCtxMenu(null)
                }}
                style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500, borderTop: '1px solid var(--border)' }}
              >
                Edit group
              </div>
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
            <div key={group.id} style={{ marginBottom: 2 }}>
              <div
                onContextMenu={e => {
                  e.preventDefault()
                  e.stopPropagation()
                  setGroupCtxMenu({ x: e.clientX, y: e.clientY, groupId: group.id })
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 4px 4px 2px', borderRadius: 'var(--r-sm)',
                  opacity: isHidden ? 0.5 : 1,
                }}
              >
                <button
                  onClick={() => toggleGroupExpand(group.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', padding: '2px 4px', fontSize: 10,
                    lineHeight: 1, flexShrink: 0,
                  }}
                >
                  {isExpanded ? <ChevronDown size={12} strokeWidth={2.4} /> : <ChevronRight size={12} strokeWidth={2.4} />}
                </button>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: group.color, flexShrink: 0 }} />
                <span
                  onClick={() => onSelectGroup(group.id)}
                  style={{ fontSize: 12.5, fontWeight: 600, flex: 1, color: 'var(--text-1)', cursor: 'pointer' }}
                >
                  {group.name}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: allGroupSelected ? 'var(--accent)' : selectedCount > 0 ? 'var(--text-2)' : 'var(--text-3)',
                }}>
                  {selectedCount > 0 ? `${selectedCount}/` : ''}{totalCount}
                </span>
                <button
                  onClick={() => toggleGroupVisibility(group.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-3)', padding: '2px 3px', lineHeight: 1 }}
                  title={isHidden ? 'Show group' : 'Hide group'}
                >
                  {isHidden ? 'o' : 'O'}
                </button>
              </div>
              {isExpanded && displayTables.map(table => renderTableRow(table, true))}
            </div>
          )
        })}

        {ungroupedTables.length > 0 && (
          <div>
            {groups.length > 0 && (
              <div style={{
                padding: '6px 9px 3px', fontSize: 10, fontWeight: 700,
                color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase',
              }}>
                Ungrouped
              </div>
            )}
            {ungroupedTables.map(table => renderTableRow(table))}
          </div>
        )}
      </div>

      {showTablePicker && (
        <TablePicker
          tables={allTableIds}
          selected={allTableIds.filter(id => !hiddenTables.has(id))}
          onChange={selected => {
            const newHidden = allTableIds.filter(id => !selected.includes(id))
            setHiddenTables(newHidden)
          }}
          onClose={() => setShowTablePicker(false)}
          title="Choose visible tables"
        />
      )}
    </aside>
  )
}
