import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api/client'
import { Canvas } from './components/Canvas'
import { ContextPanel } from './components/ContextPanel'
import { GroupModal } from './components/GroupModal'
import { Header } from './components/Header'
import { SchemaDiffModal } from './components/SchemaDiffModal'
import { Sidebar } from './components/Sidebar'
import { WorkspaceModal } from './components/WorkspaceModal'
import { useStore } from './store'
import type { Connection, Group, SchemaData, Workspace } from '../types'

const EMPTY_SCHEMA: SchemaData = { tables: [], foreignKeys: [] }

function tableNameFromId(tableId: string): string {
  return tableId.split('.').slice(1).join('.')
}

export function App() {
  const {
    activeConnection,
    activeWorkspaceId,
    applyWorkspaceState,
    selectedTables,
    clearSelection,
    selectTables,
    deselectTables,
    toggleTableVisibility,
    setActiveWorkspaceId,
    setHiddenTables,
  } = useStore()
  const [groupModalState, setGroupModalState] = useState<{ initialTableName?: string | null; editGroupId?: string | null } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tableId: string } | null>(null)
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  const [showDiffModal, setShowDiffModal] = useState(false)
  const qc = useQueryClient()

  const { data: connections = [] } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.api.connections.get()
      if (res.error) throw res.error
      return (res.data as Connection[]) ?? []
    },
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.api.groups.get()
      if (res.error) throw res.error
      return (res.data as Group[]) ?? []
    },
  })

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces', activeConnection],
    enabled: !!activeConnection,
    queryFn: async () => {
      const res = await api.api.workspaces.get({ query: { connection: activeConnection! } })
      if (res.error) throw res.error
      return (res.data as Workspace[]) ?? []
    },
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
    },
  })

  useEffect(() => {
    if (activeWorkspaceId && !(workspaces as Workspace[]).some(workspace => workspace.id === activeWorkspaceId)) {
      setActiveWorkspaceId(null)
    }
  }, [activeWorkspaceId, workspaces, setActiveWorkspaceId])

  const lastHideConnectionRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeConnection || !schemaData.tables.length) return
    if (lastHideConnectionRef.current === activeConnection) return

    lastHideConnectionRef.current = activeConnection
    const connection = (connections as Connection[]).find(item => item.name === activeConnection)
    if (connection?.hideAllInitially) {
      setHiddenTables(schemaData.tables.map(table => `${table.schema}.${table.name}`))
    }
  }, [activeConnection, schemaData, connections, setHiddenTables])

  const assignGroupMutation = useMutation({
    mutationFn: async ({ groupId, tableName }: { groupId: string; tableName: string }) => {
      const res = await api.api.groups.membership.post({ tableName, action: 'add', groupId })
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })

  const unassignGroupMutation = useMutation({
    mutationFn: async ({ tableName, groupId }: { tableName: string; groupId?: string }) => {
      const res = await api.api.groups.membership.post(
        groupId
          ? { tableName, action: 'remove', groupId }
          : { tableName, action: 'clear' }
      )
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })

  const tableByName = useMemo(
    () => new Map(schemaData.tables.map(table => [table.name, table])),
    [schemaData.tables]
  )

  const currentWorkspace = useMemo(
    () => (workspaces as Workspace[]).find(workspace => workspace.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  )

  const handleSelectGroup = useCallback((groupId: string) => {
    const group = (groups as Group[]).find(item => item.id === groupId)
    if (!group) return

    const ids = group.tables
      .map(name => tableByName.get(name))
      .filter((table): table is NonNullable<typeof table> => table != null)
      .map(table => `${table.schema}.${table.name}`)

    const allSelected = ids.length > 0 && ids.every(id => selectedTables.has(id))
    if (allSelected) {
      deselectTables(ids)
    } else {
      selectTables(ids)
    }
  }, [groups, tableByName, selectedTables, selectTables, deselectTables])

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    const target = (event.target as HTMLElement).closest('[data-table-id]') as HTMLElement | null
    if (!target?.dataset.tableId) return

    event.preventDefault()
    setCtxMenu({ x: event.clientX, y: event.clientY, tableId: target.dataset.tableId })
  }, [])

  const openGroupModal = useCallback((initialTableName?: string | null, editGroupId?: string | null) => {
    setCtxMenu(null)
    setGroupModalState({ initialTableName: initialTableName ?? null, editGroupId: editGroupId ?? null })
  }, [])

  const handleAssignTableToGroup = useCallback((tableId: string, groupId: string) => {
    assignGroupMutation.mutate({ groupId, tableName: tableNameFromId(tableId) })
    setCtxMenu(null)
  }, [assignGroupMutation])

  const handleUnassignTable = useCallback((tableId: string, groupId?: string) => {
    unassignGroupMutation.mutate({ tableName: tableNameFromId(tableId), groupId })
    setCtxMenu(null)
  }, [unassignGroupMutation])

  const handleLoadWorkspace = useCallback((workspace: Workspace) => {
    applyWorkspaceState(workspace.state, workspace.id)
  }, [applyWorkspaceState])

  const ctxMenuTableName = ctxMenu ? tableNameFromId(ctxMenu.tableId) : null
  const ctxMenuGroups = ctxMenuTableName
    ? (groups as Group[]).filter(group => group.tables.includes(ctxMenuTableName))
    : []

  return (
    <div
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      onClick={() => setCtxMenu(null)}
      onContextMenu={handleContextMenu}
    >
      <Header
        connections={connections as Connection[]}
        currentWorkspaceName={currentWorkspace?.name ?? null}
        onRefresh={() => refetch()}
        onOpenWorkspaces={() => setShowWorkspaceModal(true)}
        onOpenDiff={() => setShowDiffModal(true)}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeConnection && (
          <Sidebar
            schemaData={schemaData}
            groups={groups as Group[]}
            onSelectGroup={handleSelectGroup}
            onOpenGroupModal={openGroupModal}
            onAssignTableToGroup={handleAssignTableToGroup}
            onUnassignTable={handleUnassignTable}
          />
        )}

        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {activeConnection ? (
            <Canvas schemaData={schemaData} groups={groups as Group[]} />
          ) : (
            <div style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-3)',
              fontSize: 14,
              background: 'var(--canvas)',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}>
              Select a connection above to load the schema
            </div>
          )}

          {selectedTables.size > 0 && (
            <div style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 40,
              padding: '5px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: 'var(--shadow-md)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-2)',
              zIndex: 10,
              pointerEvents: 'auto',
            }}>
              <span style={{ fontWeight: 800, color: 'var(--sel)' }}>{selectedTables.size}</span>
              <span>table{selectedTables.size > 1 ? 's' : ''} selected</span>
              <button
                onClick={event => {
                  event.stopPropagation()
                  selectedTables.forEach(id => toggleTableVisibility(id))
                  clearSelection()
                }}
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: '2px 7px',
                  borderRadius: 4,
                  border: '1px solid var(--border-strong)',
                  background: 'none',
                  fontFamily: 'inherit',
                }}
              >
                Hide
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  clearSelection()
                }}
                style={{
                  fontSize: 11.5,
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: '2px 7px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'none',
                  fontFamily: 'inherit',
                }}
              >
                Clear x
              </button>
            </div>
          )}

          {ctxMenu && (
            <div
              style={{
                position: 'fixed',
                left: ctxMenu.x,
                top: ctxMenu.y,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 50,
                minWidth: 180,
                overflow: 'hidden',
              }}
              onClick={event => event.stopPropagation()}
            >
              {ctxMenuGroups.map(group => (
                <div
                  key={group.id}
                  onClick={() => handleUnassignTable(ctxMenu.tableId, group.id)}
                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', color: 'var(--text-1)', fontWeight: 500 }}
                >
                  Unassign from {group.name}
                </div>
              ))}
              <div
                onClick={() => openGroupModal(ctxMenuTableName)}
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text-1)',
                  fontWeight: 500,
                  borderTop: ctxMenuGroups.length > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                Add to new group
              </div>
              <div style={{
                padding: '4px 12px 3px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--text-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                borderBottom: '1px solid var(--border)',
                borderTop: '1px solid var(--border)',
              }}>
                Assign to group
              </div>
              {(groups as Group[]).filter(group => !ctxMenuGroups.some(item => item.id === group.id)).length === 0 && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-3)' }}>
                  No other groups
                </div>
              )}
              {(groups as Group[]).filter(group => !ctxMenuGroups.some(item => item.id === group.id)).map(group => (
                <div
                  key={group.id}
                  onClick={() => handleAssignTableToGroup(ctxMenu.tableId, group.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text-1)',
                  }}
                >
                  <div style={{ width: 9, height: 9, borderRadius: 3, background: group.color, flexShrink: 0 }} />
                  {group.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {activeConnection && <ContextPanel schemaData={schemaData} />}
      </div>

      {groupModalState && (
        <GroupModal
          groups={groups as Group[]}
          initialTableName={groupModalState.initialTableName}
          editGroupId={groupModalState.editGroupId}
          onClose={() => setGroupModalState(null)}
        />
      )}

      {showWorkspaceModal && activeConnection && (
        <WorkspaceModal
          activeConnection={activeConnection}
          workspaces={workspaces as Workspace[]}
          activeWorkspaceId={activeWorkspaceId}
          onLoadWorkspace={handleLoadWorkspace}
          onClose={() => setShowWorkspaceModal(false)}
        />
      )}

      {showDiffModal && activeConnection && (
        <SchemaDiffModal
          activeConnection={activeConnection}
          currentSchema={schemaData}
          connections={connections as Connection[]}
          onClose={() => setShowDiffModal(false)}
        />
      )}
    </div>
  )
}
