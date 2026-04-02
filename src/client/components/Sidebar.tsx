import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../store'
import type { SchemaData, Group } from '../../types'

interface SidebarProps {
  schemaData: SchemaData
  groups: Group[]
  onSelectGroup: (groupId: string) => void
  onAddGroup: () => void
}

export function Sidebar({ schemaData, groups, onSelectGroup, onAddGroup }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const {
    selectedTables, hiddenGroups, hiddenTables, autoExpand,
    toggleTable, selectTables, toggleGroupVisibility, toggleTableVisibility,
    setZoomToTable, resetLayout,
  } = useStore()

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

  const filtered = schemaData.tables.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside style={{
      width: 234, background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Groups */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.9px',
          textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8,
        }}>
          Groups
        </div>

        {groups.map(group => {
          const isHidden = hiddenGroups.has(group.id)
          return (
            <div
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 'var(--r-sm)',
                cursor: 'pointer', marginBottom: 2,
                opacity: isHidden ? 0.45 : 1,
              }}
            >
              <div style={{
                width: 9, height: 9, borderRadius: 3,
                background: group.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--text-1)' }}>
                {group.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>
                {group.tables.length}
              </span>
              <button
                onClick={e => { e.stopPropagation(); toggleGroupVisibility(group.id) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--text-3)', padding: '2px 4px',
                  lineHeight: 1,
                }}
                title={isHidden ? 'Show group' : 'Hide group'}
              >
                {isHidden ? '○' : '◉'}
              </button>
            </div>
          )
        })}

        <button
          onClick={onAddGroup}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 8px', borderRadius: 'var(--r-sm)',
            cursor: 'pointer', color: 'var(--text-3)',
            fontSize: 12, fontWeight: 500,
            background: 'none', border: 'none',
            width: '100%', marginTop: 4, fontFamily: 'inherit',
          }}
        >
          + New group
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
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

      {/* Recalculate layout + show all hidden */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
        <button
          onClick={resetLayout}
          style={{
            flex: 1, padding: '5px 8px',
            borderRadius: 'var(--r-sm)', border: '1px solid var(--border-strong)',
            background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
            color: 'var(--text-3)', cursor: 'pointer',
          }}
        >
          Recalculate layout
        </button>
        {hiddenTables.size > 0 && (
          <button
            onClick={() => [...hiddenTables].forEach(id => toggleTableVisibility(id))}
            style={{
              padding: '5px 8px',
              borderRadius: 'var(--r-sm)', border: '1px solid var(--border-strong)',
              background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
              color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Show all ({hiddenTables.size})
          </button>
        )}
      </div>

      {/* Table list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 6, position: 'relative' }}>
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
              style={{
                padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                color: 'var(--text-1)', fontWeight: 500,
              }}
            >
              Zoom to
            </div>
            <div
              onClick={() => { toggleTableVisibility(ctxMenu.nodeId); setCtxMenu(null) }}
              style={{
                padding: '8px 14px', fontSize: 13, cursor: 'pointer',
                color: 'var(--text-1)', fontWeight: 500,
                borderTop: '1px solid var(--border)',
              }}
            >
              {hiddenTables.has(ctxMenu.nodeId) ? 'Show' : 'Hide'}
            </div>
          </div>
        )}

        {filtered.map(table => {
          const nodeId = `${table.schema}.${table.name}`
          const isSelected = selectedTables.has(nodeId)
          const isHidden = hiddenTables.has(nodeId)
          const group = tableToGroup.get(table.name)
          return (
            <div
              key={nodeId}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, nodeId }) }}
              onClick={() => {
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
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '6px 9px', borderRadius: 'var(--r-sm)',
                cursor: 'pointer', marginBottom: 1,
                background: isSelected ? 'var(--sel-light)' : 'transparent',
                opacity: isHidden ? 0.35 : 1,
              }}
            >
              <div style={{
                width: 3, height: 15, borderRadius: 2, flexShrink: 0,
                background: group?.color ?? 'var(--text-3)',
                opacity: group ? 1 : 0.3,
              }} />
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
        })}
      </div>
    </aside>
  )
}
