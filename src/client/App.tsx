import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api/client'
import { useStore } from './store'
import { traceFkChain } from './lib/fk-chain'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Canvas } from './components/Canvas'
import { ContextPanel } from './components/ContextPanel'
import { GroupModal } from './components/GroupModal'
import type { Connection, Group, SchemaData } from '../types'

const EMPTY_SCHEMA: SchemaData = { tables: [], foreignKeys: [] }

export function App() {
  const { activeConnection, selectedTables, clearSelection, selectTables, deselectTables, toggleTableVisibility, setHiddenTables } = useStore()
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tableId: string } | null>(null)
  const qc = useQueryClient()

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.api.connections.get()
      if (res.error) throw res.error
      return res.data ?? []
    }
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.api.groups.get()
      if (res.error) throw res.error
      return res.data ?? []
    }
  })

  const { data: schemaData = EMPTY_SCHEMA, refetch } = useQuery({
    queryKey: ['schema', activeConnection],
    enabled: !!activeConnection,
    queryFn: async () => {
      if (activeConnection === '__demo__') {
        const res = await api.api.schema.demo.get()
        if (res.error) throw res.error
        return (res.data as SchemaData) ?? EMPTY_SCHEMA
      }
      const res = await api.api.schema.get({ query: { connection: activeConnection! } })
      if (res.error) throw res.error
      return (res.data as SchemaData) ?? EMPTY_SCHEMA
    }
  })

  const fkNeighbors = useMemo(() => {
    const tableByName = new Map(schemaData.tables.map(t => [t.name, t]))
    const map = new Map<string, string[]>()
    for (const fk of schemaData.foreignKeys) {
      const p = tableByName.get(fk.parentTable)
      const r = tableByName.get(fk.referencedTable)
      if (!p || !r) continue
      const pId = `${p.schema}.${p.name}`
      const rId = `${r.schema}.${r.name}`
      if (!map.has(pId)) map.set(pId, [])
      if (!map.has(rId)) map.set(rId, [])
      map.get(pId)!.push(rId)
      map.get(rId)!.push(pId)
    }
    return map
  }, [schemaData.tables, schemaData.foreignKeys])

  // Apply hideAllInitially when schema first loads for each connection switch.
  // Use a ref so refreshes don't re-hide tables the user has already shown.
  const lastHideConnectionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeConnection || !schemaData.tables.length) return
    if (lastHideConnectionRef.current === activeConnection) return
    lastHideConnectionRef.current = activeConnection
    const conn = (connections as Connection[]).find(c => c.name === activeConnection)
    if (conn?.hideAllInitially) {
      setHiddenTables(schemaData.tables.map(t => `${t.schema}.${t.name}`))
    }
  }, [activeConnection, schemaData, connections, setHiddenTables])

  const assignGroupMutation = useMutation({
    mutationFn: async ({ groupId, tableName }: { groupId: string; tableName: string }) => {
      const group = (groups as Group[]).find(g => g.id === groupId)
      if (!group) return
      const tables = group.tables.includes(tableName)
        ? group.tables
        : [...group.tables, tableName]
      const res = await api.api.groups({ id: groupId }).put({ tables })
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] })
  })

  const handleSelectGroup = useCallback((groupId: string) => {
    const group = (groups as Group[]).find(g => g.id === groupId)
    if (!group) return
    const ids = group.tables
      .map(name => schemaData.tables.find(t => t.name === name))
      .filter((t): t is NonNullable<typeof t> => t != null)
      .map(t => `${t.schema}.${t.name}`)
    const allSelected = ids.length > 0 && ids.every(id => selectedTables.has(id))
    if (allSelected) {
      deselectTables(ids)
    } else {
      selectTables(ids)
    }
  }, [groups, schemaData.tables, selectedTables, selectTables, deselectTables])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-table-id]') as HTMLElement | null
    if (target?.dataset.tableId) {
      e.preventDefault()
      setCtxMenu({ x: e.clientX, y: e.clientY, tableId: target.dataset.tableId })
    }
  }, [])

  return (
    <div
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={() => setCtxMenu(null)}
      onContextMenu={handleContextMenu}
    >
      <Header connections={connections} onRefresh={() => refetch()} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeConnection && (
          <Sidebar
            schemaData={schemaData}
            groups={groups as Group[]}
            onSelectGroup={handleSelectGroup}
            onAddGroup={() => setShowGroupModal(true)}
          />
        )}

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {activeConnection ? (
            <Canvas schemaData={schemaData} groups={groups as Group[]} />
          ) : (
            <div style={{
              flex: 1, height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)', fontSize: 14,
              background: 'var(--canvas)',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}>
              Select a connection above to load the schema
            </div>
          )}

          {/* Selection count bar */}
          {selectedTables.size > 0 && (
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 40, padding: '5px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: 'var(--shadow-md)', fontSize: 13, fontWeight: 500,
              color: 'var(--text-2)', zIndex: 10, pointerEvents: 'auto',
            }}>
              <span style={{ fontWeight: 800, color: 'var(--sel)' }}>{selectedTables.size}</span>
              <span>table{selectedTables.size > 1 ? 's' : ''} selected</span>
              <button
                onClick={e => {
                  e.stopPropagation()
                  selectedTables.forEach(id => toggleTableVisibility(id))
                  clearSelection()
                }}
                style={{
                  fontSize: 11.5, color: 'var(--text-3)', cursor: 'pointer',
                  padding: '2px 7px', borderRadius: 4,
                  border: '1px solid var(--border-strong)', background: 'none', fontFamily: 'inherit',
                }}
              >
                Hide
              </button>
              <button
                onClick={e => { e.stopPropagation(); clearSelection() }}
                style={{
                  fontSize: 11.5, color: 'var(--text-3)', cursor: 'pointer',
                  padding: '2px 7px', borderRadius: 4,
                  border: 'none', background: 'none', fontFamily: 'inherit',
                }}
              >
                Clear ×
              </button>
            </div>
          )}

          {/* Right-click context menu */}
          {ctxMenu && (
            <div
              style={{
                position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', boxShadow: 'var(--shadow-lg)',
                zIndex: 50, minWidth: 160, overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div
                onClick={() => {
                  selectTables(traceFkChain(ctxMenu.tableId, fkNeighbors))
                  setCtxMenu(null)
                }}
                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500 }}
              >
                Trace FK chain
              </div>
              <div style={{ padding: '4px 12px 3px', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                Assign to group
              </div>
              {(groups as Group[]).length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-3)' }}>
                  No groups yet
                </div>
              )}
              {(groups as Group[]).map(g => (
                <div
                  key={g.id}
                  onClick={() => {
                    // tableId is "schema.tableName" — extract unqualified name
                    const tableName = ctxMenu.tableId.split('.').slice(1).join('.')
                    assignGroupMutation.mutate({ groupId: g.id, tableName })
                    setCtxMenu(null)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                    color: 'var(--text-1)',
                  }}
                >
                  <div style={{ width: 9, height: 9, borderRadius: 3, background: g.color, flexShrink: 0 }} />
                  {g.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {activeConnection && <ContextPanel schemaData={schemaData} />}
      </div>

      {showGroupModal && (
        <GroupModal
          groups={groups as Group[]}
          onClose={() => setShowGroupModal(false)}
        />
      )}
    </div>
  )
}
