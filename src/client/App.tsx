import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Copy, EyeOff, FolderMinus, FolderPlus, Layers3, Maximize2, Plus, X } from 'lucide-react'
import { api } from './api/client'
import { Canvas } from './components/Canvas'
import { ContextPanel } from './components/ContextPanel'
import { GroupModal } from './components/GroupModal'
import { Header } from './components/Header'
import { SchemaDiffModal } from './components/SchemaDiffModal'
import { Sidebar } from './components/Sidebar'
import { WorkspaceModal } from './components/WorkspaceModal'
import { tableNameFromId, useSelectionContext } from './hooks/useSelectionContext'
import { useStore, workspaceStatesEqual } from './store'
import type { Connection, Group, SchemaData, Workspace } from '../types'
import styles from './App.module.css'

const EMPTY_SCHEMA: SchemaData = { tables: [], foreignKeys: [] }
const DEFAULT_LEFT_SIDEBAR_WIDTH = 320
const DEFAULT_RIGHT_PANEL_WIDTH = 308
const MIN_SIDEBAR_WIDTH = 240
const MAX_SIDEBAR_WIDTH = 520
const MIN_CONTEXT_PANEL_WIDTH = 260
const MAX_CONTEXT_PANEL_WIDTH = 520

function ContextMenuAction({
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
      onClick={onClick}
      className={`${styles.menuAction} ${tone === 'danger' ? styles.menuActionDanger : ''}`}
    >
      <span className={styles.menuActionIcon}>{icon}</span>
      <span className={styles.menuActionBody}>
        <span className={styles.menuActionLabel}>{label}</span>
        {meta && <span className={styles.menuActionMeta}>{meta}</span>}
      </span>
    </button>
  )
}

export function App() {
  const {
    activeConnection,
    activeWorkspaceId,
    appMode,
    applyWorkspaceState,
    compactNodes,
    clearSelection,
    deselectTables,
    format,
    hiddenGroups,
    hiddenTables,
    layoutType,
    selectTables,
    selectedTables,
    setActiveWorkspaceId,
    setFitToNodes,
    setHiddenTables,
    tablePositions,
    toggleTableVisibility,
  } = useStore()

  const [groupModalState, setGroupModalState] = useState<{ initialTableName?: string | null; initialTableNames?: string[] | null; editGroupId?: string | null } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tableId: string } | null>(null)
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number } | null>(null)
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  const [workspaceModalIntent, setWorkspaceModalIntent] = useState<'create' | 'update'>('update')
  const [workspaceModalDraftName, setWorkspaceModalDraftName] = useState('')
  const [showDiffModal, setShowDiffModal] = useState(false)
  const [copiedSelectionContext, setCopiedSelectionContext] = useState(false)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    const stored = window.localStorage.getItem('schemaboard:left-sidebar-width')
    return stored ? Number(stored) : DEFAULT_LEFT_SIDEBAR_WIDTH
  })
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const stored = window.localStorage.getItem('schemaboard:right-panel-width')
    return stored ? Number(stored) : DEFAULT_RIGHT_PANEL_WIDTH
  })
  const resizeStateRef = useRef<{ side: 'left' | 'right'; startX: number; startWidth: number } | null>(null)
  const qc = useQueryClient()
  const isDemoMode = appMode === 'demo'
  const effectiveConnection = isDemoMode ? '__demo__' : activeConnection

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
    queryKey: ['workspaces', effectiveConnection],
    enabled: !!effectiveConnection,
    queryFn: async () => {
      const res = await api.api.workspaces.get({ query: { connection: effectiveConnection! } })
      if (res.error) throw res.error
      return (res.data as Workspace[]) ?? []
    },
  })

  const { data: schemaData = EMPTY_SCHEMA, refetch } = useQuery({
    queryKey: ['schema', appMode, effectiveConnection],
    enabled: !!effectiveConnection,
    queryFn: async () => {
      if (isDemoMode) {
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
    if (!effectiveConnection || !schemaData.tables.length || isDemoMode) return
    if (lastHideConnectionRef.current === effectiveConnection) return

    lastHideConnectionRef.current = effectiveConnection
    const connection = (connections as Connection[]).find(item => item.name === activeConnection)
    if (connection?.hideAllInitially) {
      setHiddenTables(schemaData.tables.map(table => `${table.schema}.${table.name}`))
    }
  }, [effectiveConnection, isDemoMode, activeConnection, schemaData, connections, setHiddenTables])

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

  const reorderGroupsMutation = useMutation({
    mutationFn: async (groupIds: string[]) => {
      const res = await api.api.groups.reorder.post({ groupIds })
      if (res.error) throw res.error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })

  const reorderGroupTablesMutation = useMutation({
    mutationFn: async ({ groupId, tableNames }: { groupId: string; tableNames: string[] }) => {
      const res = await api.api.groups({ id: groupId }).put({ tables: tableNames })
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

  const currentWorkspaceState = useMemo(() => ({
    selectedTables: [...selectedTables],
    hiddenGroups: [...hiddenGroups],
    hiddenTables: [...hiddenTables],
    format,
    layoutType,
    compactNodes,
    tablePositions: { ...tablePositions },
  }), [selectedTables, hiddenGroups, hiddenTables, format, layoutType, compactNodes, tablePositions])
  const isWorkspaceDirty = useMemo(
    () => currentWorkspace ? !workspaceStatesEqual(currentWorkspace.state, currentWorkspaceState) : false,
    [currentWorkspace, currentWorkspaceState]
  )

  const saveWorkspaceMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace) throw new Error('No workspace selected')

      const res = await api.api.workspaces({ id: currentWorkspace.id }).put({
        name: currentWorkspace.name,
        state: currentWorkspaceState,
      })

      if (res.error) throw res.error
      return res.data as Workspace
    },
    onSuccess: (workspace) => {
      qc.setQueryData(['workspaces', effectiveConnection], (current: Workspace[] | undefined) => (
        (current ?? []).map(item => item.id === workspace.id ? workspace : item)
      ))
      qc.invalidateQueries({ queryKey: ['workspaces', effectiveConnection] })
    },
  })

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

  const openGroupModal = useCallback((initialTableName?: string | null, editGroupId?: string | null, initialTableNames?: string[] | null) => {
    setCtxMenu(null)
    setSelectionMenu(null)
    setGroupModalState({
      initialTableName: initialTableName ?? null,
      initialTableNames: initialTableNames ?? null,
      editGroupId: editGroupId ?? null,
    })
  }, [])

  const handleAssignTableToGroup = useCallback((tableId: string, groupId: string) => {
    assignGroupMutation.mutate({ groupId, tableName: tableNameFromId(tableId) })
    setCtxMenu(null)
  }, [assignGroupMutation])

  const handleAssignTablesToGroup = useCallback((tableIds: string[], groupId: string) => {
    for (const tableId of tableIds) {
      assignGroupMutation.mutate({ groupId, tableName: tableNameFromId(tableId) })
    }
    setCtxMenu(null)
    setSelectionMenu(null)
  }, [assignGroupMutation])

  const handleUnassignTable = useCallback((tableId: string, groupId?: string) => {
    unassignGroupMutation.mutate({ tableName: tableNameFromId(tableId), groupId })
    setCtxMenu(null)
  }, [unassignGroupMutation])

  const handleReorderGroups = useCallback((groupIds: string[]) => {
    reorderGroupsMutation.mutate(groupIds)
  }, [reorderGroupsMutation])

  const handleReorderGroupTables = useCallback((groupId: string, tableIds: string[]) => {
    reorderGroupTablesMutation.mutate({
      groupId,
      tableNames: tableIds.map(tableNameFromId),
    })
  }, [reorderGroupTablesMutation])

  const handleLoadWorkspace = useCallback((workspace: Workspace) => {
    applyWorkspaceState(workspace.state, workspace.id)
  }, [applyWorkspaceState])

  const openWorkspaceManager = useCallback(() => {
    setWorkspaceModalIntent('update')
    setWorkspaceModalDraftName(currentWorkspace?.name ?? '')
    setShowWorkspaceModal(true)
  }, [currentWorkspace])

  const openSaveAsWorkspace = useCallback(() => {
    setWorkspaceModalIntent('create')
    setWorkspaceModalDraftName(currentWorkspace?.name ? `${currentWorkspace.name} copy` : '')
    setShowWorkspaceModal(true)
  }, [currentWorkspace])

  const {
    contextText: selectionContextText,
    selectedTableIds,
    selectedTableNames,
    selectedTables: selectedTableSet,
  } = useSelectionContext(schemaData)

  const ctxMenuTableName = ctxMenu ? tableNameFromId(ctxMenu.tableId) : null
  const ctxMenuGroups = ctxMenuTableName
    ? (groups as Group[]).filter(group => group.tables.includes(ctxMenuTableName))
    : []
  const assignableCtxGroups = useMemo(
    () => (groups as Group[]).filter(group => !ctxMenuGroups.some(item => item.id === group.id)),
    [groups, ctxMenuGroups]
  )
  const ctxMenuSummary = `${ctxMenuGroups.length} group${ctxMenuGroups.length === 1 ? '' : 's'}`
  useEffect(() => {
    window.localStorage.setItem('schemaboard:left-sidebar-width', String(leftSidebarWidth))
  }, [leftSidebarWidth])

  useEffect(() => {
    window.localStorage.setItem('schemaboard:right-panel-width', String(rightPanelWidth))
  }, [rightPanelWidth])

  useEffect(() => {
    if (!copiedSelectionContext) return
    const timer = window.setTimeout(() => setCopiedSelectionContext(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copiedSelectionContext])

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const resizeState = resizeStateRef.current
      if (!resizeState) return

      if (resizeState.side === 'left') {
        const nextWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          Math.min(MAX_SIDEBAR_WIDTH, resizeState.startWidth + (event.clientX - resizeState.startX))
        )
        setLeftSidebarWidth(nextWidth)
        return
      }

      const nextWidth = Math.max(
        MIN_CONTEXT_PANEL_WIDTH,
        Math.min(MAX_CONTEXT_PANEL_WIDTH, resizeState.startWidth - (event.clientX - resizeState.startX))
      )
      setRightPanelWidth(nextWidth)
    }

    function handlePointerUp() {
      resizeStateRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [])

  function startResize(side: 'left' | 'right', event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    resizeStateRef.current = {
      side,
      startX: event.clientX,
      startWidth: side === 'left' ? leftSidebarWidth : rightPanelWidth,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  async function handleCopySelectionContext(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    if (!selectionContextText) return
    await navigator.clipboard.writeText(selectionContextText)
    setCopiedSelectionContext(true)
  }

  return (
    <div className={styles.app} onClick={() => {
      setCtxMenu(null)
      setSelectionMenu(null)
    }} onContextMenu={handleContextMenu}>
      <Header
        isDemoMode={isDemoMode}
        hasActiveSource={!!effectiveConnection}
        connections={connections as Connection[]}
        currentWorkspaceName={currentWorkspace?.name ?? null}
        isWorkspaceDirty={isWorkspaceDirty}
        canSaveWorkspace={!!currentWorkspace && isWorkspaceDirty && !saveWorkspaceMutation.isPending}
        onRefresh={() => refetch()}
        onSaveWorkspace={() => saveWorkspaceMutation.mutate()}
        onSaveAsWorkspace={openSaveAsWorkspace}
        onOpenWorkspaces={openWorkspaceManager}
        onOpenDiff={() => setShowDiffModal(true)}
      />

      <div className={styles.main}>
        {effectiveConnection && (
          <>
            <div className={styles.leftPane} style={{ width: leftSidebarWidth }}>
              <Sidebar
                schemaData={schemaData}
                groups={groups as Group[]}
                onSelectGroup={handleSelectGroup}
                onOpenGroupModal={openGroupModal}
                onAssignTableToGroup={handleAssignTableToGroup}
                onAssignTablesToGroup={handleAssignTablesToGroup}
                onUnassignTable={handleUnassignTable}
                onReorderGroups={handleReorderGroups}
                onReorderGroupTables={handleReorderGroupTables}
              />
            </div>
            <div
              className={`${styles.resizeHandle} ${styles.leftResizeHandle}`}
              onMouseDown={event => startResize('left', event)}
              title="Resize sidebar"
            />
          </>
        )}

        <div className={styles.canvasArea}>
          {effectiveConnection ? (
            <Canvas
              schemaData={schemaData}
              groups={groups as Group[]}
              viewportResetKey={effectiveConnection}
            />
          ) : (
            <div className={styles.emptyState}>
              Select a source to load a schema
            </div>
          )}

          {selectedTableSet.size > 0 && (
            <div className={styles.selectionBar}>
              <div className={styles.selectionSummary}>
                <span className={styles.selectionCount}>{selectedTableSet.size}</span>
                <div className={styles.selectionCopy}>
                  <span className={styles.selectionLabel}>table{selectedTableSet.size > 1 ? 's' : ''} selected</span>
                  <span className={styles.selectionMeta}>Quick actions for the current selection</span>
                </div>
              </div>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  setFitToNodes(selectedTableIds)
                }}
                className={styles.selectionButton}
              >
                <Maximize2 size={13} strokeWidth={2.2} />
                Zoom
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  const rect = event.currentTarget.getBoundingClientRect()
                  setSelectionMenu(current => current ? null : { x: rect.left, y: rect.bottom + 8 })
                }}
                className={`${styles.selectionButton} ${styles.selectionButtonPrimary}`}
              >
                <FolderPlus size={13} strokeWidth={2.2} />
                Group
                <ChevronDown size={12} strokeWidth={2.4} />
              </button>
              <button
                type="button"
                onClick={handleCopySelectionContext}
                className={`${styles.selectionButton} ${styles.selectionButtonPrimary}`}
              >
                {copiedSelectionContext ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={2.2} />}
                {copiedSelectionContext ? 'Copied' : 'Copy context'}
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  selectedTableIds.forEach(id => toggleTableVisibility(id))
                  clearSelection()
                }}
                className={styles.selectionButton}
              >
                <EyeOff size={13} strokeWidth={2.2} />
                Hide
              </button>
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  clearSelection()
                }}
                className={`${styles.selectionButton} ${styles.selectionButtonMuted}`}
              >
                <X size={13} strokeWidth={2.2} />
                Clear
              </button>
            </div>
          )}

          {selectionMenu && selectedTableSet.size > 0 && (
            <div
              className={styles.menu}
              style={{ left: selectionMenu.x, top: selectionMenu.y }}
              onClick={event => event.stopPropagation()}
            >
              <div className={styles.menuHeader}>
                <div className={styles.menuEyebrow}>Selection</div>
                <div className={styles.menuTitle}>{selectedTableSet.size} table{selectedTableSet.size === 1 ? '' : 's'}</div>
                <div className={styles.menuMeta}>Group the current selection</div>
              </div>
              <ContextMenuAction
                icon={<Layers3 size={14} strokeWidth={2.1} />}
                label="Add to new group"
                meta="Create one group from all selected tables"
                onClick={() => openGroupModal(null, null, selectedTableNames)}
              />
              <div className={styles.menuSection}>
                <span>Add to existing group</span>
              </div>
              {groups.length === 0 && (
                <div className={styles.menuEmpty}>No groups yet</div>
              )}
              {(groups as Group[]).map(group => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleAssignTablesToGroup(selectedTableIds, group.id)}
                  className={styles.menuGroupItem}
                >
                  <div className={styles.menuSwatch} style={{ background: group.color }} />
                  <span className={styles.menuGroupName}>{group.name}</span>
                  <span className={styles.menuGroupMeta}>
                      <span className={styles.menuGroupCount}>{selectedTableSet.size}</span>
                    <span className={styles.menuGroupBadge}>
                      <Plus size={11} strokeWidth={2.4} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {ctxMenu && (
            <div className={styles.menu} style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={event => event.stopPropagation()}>
              <div className={styles.menuHeader}>
                <div className={styles.menuEyebrow}>Table</div>
                <div className={styles.menuTitle}>{ctxMenuTableName}</div>
                <div className={styles.menuMeta}>{ctxMenuSummary}</div>
              </div>
              {ctxMenuGroups.map(group => (
                <ContextMenuAction
                  key={group.id}
                  icon={<FolderMinus size={14} strokeWidth={2.1} />}
                  label={`Remove from ${group.name}`}
                  meta="Unassign from this group"
                  onClick={() => handleUnassignTable(ctxMenu.tableId, group.id)}
                  tone="danger"
                />
              ))}
              {ctxMenuGroups.length > 0 && <div className={styles.menuDivider} />}
              <ContextMenuAction
                icon={<FolderPlus size={14} strokeWidth={2.1} />}
                label="Add to new group"
                meta="Create a group from this table"
                onClick={() => openGroupModal(ctxMenuTableName)}
              />
              <div className={styles.menuSection}>
                <span>Assign to group</span>
              </div>
              {assignableCtxGroups.length === 0 && (
                <div className={styles.menuEmpty}>No other groups</div>
              )}
              {assignableCtxGroups.map(group => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleAssignTableToGroup(ctxMenu.tableId, group.id)}
                  className={styles.menuGroupItem}
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
        </div>

        {effectiveConnection && (
          <>
            <div
              className={`${styles.resizeHandle} ${styles.rightResizeHandle}`}
              onMouseDown={event => startResize('right', event)}
              title="Resize context panel"
            />
            <div className={styles.rightPane} style={{ width: rightPanelWidth }}>
              <ContextPanel schemaData={schemaData} />
            </div>
          </>
        )}
      </div>

      {groupModalState && (
        <GroupModal
          groups={groups as Group[]}
          initialTableName={groupModalState.initialTableName}
          initialTableNames={groupModalState.initialTableNames}
          editGroupId={groupModalState.editGroupId}
          onClose={() => setGroupModalState(null)}
        />
      )}

      {showWorkspaceModal && effectiveConnection && (
        <WorkspaceModal
          activeConnection={effectiveConnection}
          workspaces={workspaces as Workspace[]}
          activeWorkspaceId={activeWorkspaceId}
          defaultAction={workspaceModalIntent}
          defaultDraftName={workspaceModalDraftName}
          onLoadWorkspace={handleLoadWorkspace}
          onClose={() => setShowWorkspaceModal(false)}
        />
      )}

      {showDiffModal && effectiveConnection && (
        <SchemaDiffModal
          activeConnection={effectiveConnection}
          currentSchema={schemaData}
          connections={connections as Connection[]}
          onClose={() => setShowDiffModal(false)}
        />
      )}
    </div>
  )
}
