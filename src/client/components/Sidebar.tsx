import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { TablePicker } from './TablePicker'
import type { SchemaData, Group, SchemaTable, LayoutType } from '../../types'

interface SidebarProps {
  schemaData: SchemaData
  groups: Group[]
  onSelectGroup: (groupId: string) => void
  onAddGroup: () => void
}

function IconBtn({ icon, label, onClick, active }: { icon: string; label: string; onClick: () => void; active?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      <span style={{ lineHeight: 1 }}>{icon}</span>
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

const LAYOUTS: { type: LayoutType; icon: string; label: string }[] = [
  { type: 'dagre', icon: '⊟', label: 'Dagre' },
  { type: 'force', icon: '◎', label: 'Force' },
  { type: 'elk',   icon: '⊞', label: 'ELK' },
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
          if (open) { setOpen(false); return }
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
        <span style={{ fontSize: 9, lineHeight: 1, color: open ? 'var(--accent)' : 'var(--text-3)' }}>▾</span>
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
          {LAYOUTS.map(l => (
            <div
              key={l.type}
              onClick={() => {
                if (l.type !== layoutType) { setLayoutType(l.type); resetLayout() }
                setOpen(false)
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', cursor: 'pointer', fontSize: 12.5,
                fontWeight: l.type === layoutType ? 700 : 500,
                color: l.type === layoutType ? 'var(--accent)' : 'var(--text-1)',
                background: l.type === layoutType ? 'var(--accent-light)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{l.icon}</span>
              {l.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ schemaData, groups, onSelectGroup, onAddGroup }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [showTablePicker, setShowTablePicker] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    selectedTables, hiddenGroups, hiddenTables, autoExpand,
    toggleTable, selectTables, toggleGroupVisibility, toggleTableVisibility,
    setZoomToTable, resetLayout, setHiddenTables, setSearchQuery,
  } = useStore()

  const handleSearch = (value: string) => {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setSearchQuery(value), 200)
  }

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [ctxMenu])

  const tableToGroup = useMemo(() => {
    const map = new Map<string, Group>()
    for (const group of groups) {
      for (const tableName of group.tables) map.set(tableName, group)
    }
    return map
  }, [groups])

  const allTableIds = useMemo(
    () => schemaData.tables.map(t => `${t.schema}.${t.name}`),
    [schemaData.tables]
  )

  const filtered = useMemo(() =>
    schemaData.tables.filter(t => t.name.toLowerCase().includes(search.toLowerCase())),
    [schemaData.tables, search]
  )

  const tablesByGroup = useMemo(() => {
    const map = new Map<string, SchemaTable[]>()
    for (const table of filtered) {
      const group = tableToGroup.get(table.name)
      if (group) {
        if (!map.has(group.id)) map.set(group.id, [])
        map.get(group.id)!.push(table)
      }
    }
    return map
  }, [filtered, tableToGroup])

  const ungroupedTables = useMemo(
    () => filtered.filter(t => !tableToGroup.has(t.name)),
    [filtered, tableToGroup]
  )

  const allExpanded = groups.length > 0 && groups.every(g => expandedGroups.has(g.id))

  const toggleExpandAll = () => {
    setExpandedGroups(allExpanded ? new Set() : new Set(groups.map(g => g.id)))
  }

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  const handleTableClick = (nodeId: string) => {
    const wasSelected = selectedTables.has(nodeId)
    toggleTable(nodeId)
    if (!wasSelected && autoExpand) {
      const tableByName = new Map(schemaData.tables.map(t => [t.name, t]))
      const neighbors: string[] = []
      for (const fk of schemaData.foreignKeys) {
        const p = tableByName.get(fk.parentTable)
        const r = tableByName.get(fk.referencedTable)
        if (!p || !r) continue
        const pId = `${p.schema}.${p.name}`
        const rId = `${r.schema}.${r.name}`
        if (pId === nodeId) neighbors.push(rId)
        else if (rId === nodeId) neighbors.push(pId)
      }
      if (neighbors.length) selectTables([nodeId, ...neighbors])
    }
  }

  const renderTableRow = (table: SchemaTable, indent = false) => {
    const nodeId = `${table.schema}.${table.name}`
    const isSelected = selectedTables.has(nodeId)
    const isHidden = hiddenTables.has(nodeId)
    return (
      <div
        key={nodeId}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, nodeId }) }}
        onClick={() => handleTableClick(nodeId)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: `5px 9px 5px ${indent ? 22 : 9}px`,
          borderRadius: 'var(--r-sm)', cursor: 'pointer', marginBottom: 1,
          background: isSelected ? 'var(--sel-light)' : 'transparent',
          opacity: isHidden ? 0.35 : 1,
        }}
      >
        <span style={{
          fontSize: 12.5, fontWeight: 500, flex: 1,
          color: isSelected ? 'var(--sel)' : 'var(--text-1)',
          textDecoration: isHidden ? 'line-through' : 'none',
        }}>
          {table.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 500 }}>
          {table.columns.length}
        </span>
      </div>
    )
  }

  return (
    <aside style={{
      width: 234, background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search tables…"
          style={{
            width: '100%', padding: '7px 10px',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-sm)', fontFamily: 'inherit',
            fontSize: 12.5, color: 'var(--text-1)',
            background: 'var(--bg)', outline: 'none',
          }}
        />
      </div>

      {/* Icon toolbar */}
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <IconBtn icon="↺" label="Recalc layout" onClick={resetLayout} />
        <IconBtn icon="⊡" label="Choose visible" onClick={() => setShowTablePicker(true)} />
        <IconBtn icon={allExpanded ? '⊟' : '⊕'} label={allExpanded ? 'Collapse all' : 'Expand all'} onClick={toggleExpandAll} active={allExpanded} />
        <LayoutDropdown />
        <div style={{ flex: 1 }} />
        <IconBtn icon="⬡" label="New group" onClick={onAddGroup} />
      </div>

      {/* Show all hidden */}
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

      {/* Table list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 6, position: 'relative' }}>
        {/* Context menu */}
        {ctxMenu && (
          <div
            style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 200,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden', minWidth: 130,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              onClick={() => { setZoomToTable(ctxMenu.nodeId); setCtxMenu(null) }}
              style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500 }}
            >
              Zoom to
            </div>
            <div
              onClick={() => { toggleTableVisibility(ctxMenu.nodeId); setCtxMenu(null) }}
              style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500, borderTop: '1px solid var(--border)' }}
            >
              {hiddenTables.has(ctxMenu.nodeId) ? 'Show' : 'Hide'}
            </div>
          </div>
        )}

        {/* Groups with collapsible tables */}
        {groups.map(group => {
          const groupTables = tablesByGroup.get(group.id) ?? []
          if (groupTables.length === 0 && search) return null
          const isExpanded = expandedGroups.has(group.id)
          const isHidden = hiddenGroups.has(group.id)
          const displayTables = search ? groupTables : group.tables
            .map(name => schemaData.tables.find(t => t.name === name))
            .filter((t): t is SchemaTable => t != null)

          return (
            <div key={group.id} style={{ marginBottom: 2 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 4px 4px 2px', borderRadius: 'var(--r-sm)',
                opacity: isHidden ? 0.5 : 1,
              }}>
                <button
                  onClick={() => toggleGroupExpand(group.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', padding: '2px 4px', fontSize: 10,
                    lineHeight: 1, flexShrink: 0,
                  }}
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: group.color, flexShrink: 0 }} />
                <span
                  onClick={() => onSelectGroup(group.id)}
                  style={{ fontSize: 12.5, fontWeight: 600, flex: 1, color: 'var(--text-1)', cursor: 'pointer' }}
                >
                  {group.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
                  {group.tables.length}
                </span>
                <button
                  onClick={() => toggleGroupVisibility(group.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-3)', padding: '2px 3px', lineHeight: 1 }}
                  title={isHidden ? 'Show group' : 'Hide group'}
                >
                  {isHidden ? '○' : '◉'}
                </button>
              </div>
              {isExpanded && displayTables.map(t => renderTableRow(t, true))}
            </div>
          )
        })}

        {/* Ungrouped tables */}
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
            {ungroupedTables.map(t => renderTableRow(t))}
          </div>
        )}
      </div>

      {/* Table picker modal */}
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
