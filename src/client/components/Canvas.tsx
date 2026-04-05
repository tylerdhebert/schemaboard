import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { RelationshipEdge } from './RelationshipEdge'
import { SelfLoopEdge } from './SelfLoopEdge'
import { TablePicker } from './TablePicker'
import { TableNode } from './TableNode'
import { CanvasToolbar } from './canvas/CanvasToolbar'
import { useMarqueeSelection } from './canvas/useMarqueeSelection'
import { computeLayout } from '../lib/layout'
import { DEFAULT_SOURCE_HANDLE_ID, DEFAULT_TARGET_HANDLE_ID } from '../lib/table-handles'
import { useStore } from '../store'
import type { Group, LayoutType, SchemaData, SchemaTable } from '../../types'
import styles from './Canvas.module.css'

const EDGE_ACTIVE_STROKE = 'rgba(74,123,245,0.5)'
const EDGE_DIM_STROKE = 'rgba(255,255,255,0.06)'
const EDGE_ENERGIZED_STROKE = 'rgba(126,169,255,0.92)'

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { relationship: RelationshipEdge, selfloop: SelfLoopEdge }

function matchesSearch(table: SchemaTable, query: string): boolean {
  const q = query.toLowerCase()
  if (table.name.toLowerCase().includes(q)) return true
  return table.columns.some(column => column.name.toLowerCase().includes(q))
}

function getNodeBox(node: Node & { measured?: { width?: number; height?: number } }) {
  const width = node.measured?.width ?? 220
  const height = node.measured?.height ?? 80
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + width,
    bottom: node.position.y + height,
    width,
    height,
  }
}

function ZoomController() {
  const { fitToNodes, fitViewKey, setFitToNodes, setZoomToTable, zoomToTable } = useStore()
  const { fitView, getNode, setCenter, setViewport } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const prevFitViewKey = useRef(fitViewKey)
  const pendingFitViewKeyRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!zoomToTable) return

    setZoomToTable(null)
    const node = getNode(zoomToTable) as (Node & { measured?: { width?: number; height?: number } }) | undefined
    if (!node) return

    const width = node.measured?.width ?? 220
    const height = node.measured?.height ?? 80
    setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 1.5, duration: 500 })
  }, [zoomToTable, getNode, setCenter, setZoomToTable])

  useEffect(() => {
    if (!fitToNodes) return

    const requestedIds = [...fitToNodes]
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)

    frameRef.current = requestAnimationFrame(() => {
      const existingNodes = requestedIds
        .map(id => getNode(id) as (Node & { measured?: { width?: number; height?: number } }) | undefined)
        .filter((node): node is Node & { measured?: { width?: number; height?: number } } => node != null)

      if (existingNodes.length === 0) {
        setFitToNodes(null)
        return
      }

      if (existingNodes.length === 1) {
        const box = getNodeBox(existingNodes[0])
        setFitToNodes(null)
        setCenter(box.left + box.width / 2, box.top + box.height / 2, { zoom: 1.2, duration: 500 })
        return
      }

      const boxes = existingNodes.map(getNodeBox)
      const bounds = boxes.reduce((acc, box) => ({
        left: Math.min(acc.left, box.left),
        top: Math.min(acc.top, box.top),
        right: Math.max(acc.right, box.right),
        bottom: Math.max(acc.bottom, box.bottom),
      }), {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY,
      })

      const width = Math.max(bounds.right - bounds.left, 1)
      const height = Math.max(bounds.bottom - bounds.top, 1)
      const centerX = bounds.left + width / 2
      const centerY = bounds.top + height / 2

      const pane = document.querySelector('.react-flow__viewport')?.parentElement
      const paneWidth = pane?.clientWidth ?? window.innerWidth
      const paneHeight = pane?.clientHeight ?? window.innerHeight
      const padding = 0.24
      const zoomX = paneWidth / (width * (1 + padding))
      const zoomY = paneHeight / (height * (1 + padding))
      const zoom = Math.max(0.35, Math.min(1.25, Math.min(zoomX, zoomY)))

      const viewport: Viewport = {
        x: paneWidth / 2 - centerX * zoom,
        y: paneHeight / 2 - centerY * zoom,
        zoom,
      }

      setFitToNodes(null)
      setViewport(viewport, { duration: 500 })
    })

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    }
  }, [fitToNodes, setFitToNodes, getNode, setCenter, setViewport])

  useEffect(() => {
    if (prevFitViewKey.current === fitViewKey) return

    prevFitViewKey.current = fitViewKey
    pendingFitViewKeyRef.current = fitViewKey
  }, [fitViewKey])

  useEffect(() => {
    if (!nodesInitialized) return
    if (pendingFitViewKeyRef.current == null) return

    pendingFitViewKeyRef.current = null
    const frame = requestAnimationFrame(() => {
      fitView({ duration: 400, padding: 0.15 })
    })

    return () => cancelAnimationFrame(frame)
  }, [fitViewKey, nodesInitialized, fitView])

  return null
}

interface CanvasProps {
  schemaData: SchemaData
  groups: Group[]
  viewportResetKey: string
}

type BaseLayout = {
  nodes: Node[]
  edges: Edge[]
  fresh: boolean
  viewportResetKey: string
}

export function Canvas({ schemaData, groups, viewportResetKey }: CanvasProps) {
  const {
    clearSelection,
    compactNodes,
    hiddenGroups,
    hiddenTables,
    layoutKey,
    layoutType,
    resetLayout,
    searchQuery,
    setHiddenTables,
    selectedTables,
    selectTables,
    setTablePosition,
    toggleTable,
    toggleCompactNodes,
    tablePositions,
    triggerFitView,
  } = useStore()
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const groupMembershipKey = useMemo(
    () => groups
      .map(group => `${group.id}:${group.color}:${[...group.tables].sort().join(',')}`)
      .sort()
      .join('|'),
    [groups]
  )

  const tableToGroups = useMemo(() => {
    const map = new Map<string, Group[]>()
    for (const group of [...groups].sort((left, right) => left.id.localeCompare(right.id))) {
      for (const tableName of group.tables) {
        const existing = map.get(tableName)
        if (existing) existing.push(group)
        else map.set(tableName, [group])
      }
    }
    return map
  }, [groupMembershipKey])

  const visibleTables = useMemo(
    () => schemaData.tables.filter(table => {
      const id = `${table.schema}.${table.name}`
      if (hiddenTables.has(id)) return false

      const tableGroups = tableToGroups.get(table.name)
      return !tableGroups || tableGroups.some(group => !hiddenGroups.has(group.id))
    }),
    [schemaData.tables, tableToGroups, hiddenGroups, hiddenTables]
  )

  const [baseLayout, setBaseLayout] = useState<BaseLayout>({ nodes: [], edges: [], fresh: true, viewportResetKey })
  const prevLayoutKeyRef = useRef(layoutKey)
  const prevLayoutTypeRef = useRef(layoutType)
  const pendingViewportResetKeyRef = useRef<string | null>(viewportResetKey)
  const prevViewportResetKeyRef = useRef(viewportResetKey)

  useEffect(() => {
    if (prevViewportResetKeyRef.current === viewportResetKey) return
    prevViewportResetKeyRef.current = viewportResetKey
    pendingViewportResetKeyRef.current = viewportResetKey
  }, [viewportResetKey])

  useEffect(() => {
    let cancelled = false
    const fresh = prevLayoutKeyRef.current !== layoutKey || prevLayoutTypeRef.current !== layoutType
    prevLayoutKeyRef.current = layoutKey
    prevLayoutTypeRef.current = layoutType

    computeLayout(layoutType, visibleTables, schemaData.foreignKeys).then(({ nodes, edges }) => {
      if (cancelled) return
      setBaseLayout({ nodes, edges, fresh, viewportResetKey })
    })

    return () => {
      cancelled = true
    }
  }, [visibleTables, schemaData.foreignKeys, layoutKey, layoutType, viewportResetKey])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
  const {
    marqueeSelection,
    marqueeBox,
    viewportRef,
    beginMarqueeSelection,
    handleContextMenuCapture,
  } = useMarqueeSelection({
    canvasRef,
    rfNodes,
    selectTables,
    clearSelection,
  })
  const appliedLayoutRef = useRef<BaseLayout | null>(null)
  const prevTablePositionsRef = useRef(tablePositions)

  useEffect(() => {
    const isNewLayout = appliedLayoutRef.current !== baseLayout
    const positionsChanged = prevTablePositionsRef.current !== tablePositions
    appliedLayoutRef.current = baseLayout
    prevTablePositionsRef.current = tablePositions

    const hasSelection = selectedTables.size > 0
    const query = searchQuery.length >= 2 ? searchQuery : ''

    setRfNodes(previousNodes => {
      const previousPositions = (isNewLayout && baseLayout.fresh) || positionsChanged
        ? null
        : new Map(previousNodes.map(node => [node.id, node.position]))

      return baseLayout.nodes.map(node => {
        const table = (node.data as { table: SchemaTable }).table
        const groupsForTable = tableToGroups.get(table.name) ?? []
        const selected = selectedTables.has(node.id)
        const dim = hasSelection && !selected
        const matched = query ? matchesSearch(table, query) : false

        return {
          ...node,
          position: tablePositions[node.id] ?? previousPositions?.get(node.id) ?? node.position,
          data: { table, groups: groupsForTable, selected, dim, matched, compact: compactNodes },
        }
      })
    })

    if (isNewLayout && baseLayout.fresh) {
      triggerFitView()
    }

    if (
      pendingViewportResetKeyRef.current === baseLayout.viewportResetKey &&
      baseLayout.nodes.length > 0
    ) {
      pendingViewportResetKeyRef.current = null
      triggerFitView()
    }

    setRfEdges(baseLayout.edges.map(edge => {
      const energized = draggingNodeId != null && (edge.source === draggingNodeId || edge.target === draggingNodeId)
      const sourceSelected = selectedTables.has(edge.source as string)
      const targetSelected = selectedTables.has(edge.target as string)
      const active = selectedTables.size === 0 || (sourceSelected && targetSelected)

      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: energized ? EDGE_ENERGIZED_STROKE : active ? EDGE_ACTIVE_STROKE : EDGE_DIM_STROKE,
          strokeWidth: energized ? 1.9 : active ? 1.5 : 1,
        },
        sourceHandle: compactNodes ? DEFAULT_SOURCE_HANDLE_ID : edge.sourceHandle,
        targetHandle: compactNodes ? DEFAULT_TARGET_HANDLE_ID : edge.targetHandle,
        data: {
          ...(edge.data as Record<string, unknown> | undefined),
          energized,
        },
        animated: energized,
      }
    }))
  }, [baseLayout, selectedTables, tableToGroups, searchQuery, compactNodes, tablePositions, draggingNodeId, setRfNodes, setRfEdges, triggerFitView])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    toggleTable(node.id)
  }, [toggleTable])

  const onNodeDragStart: NodeMouseHandler = useCallback((_event, node) => {
    setDraggingNodeId(node.id)
  }, [])

  const onNodeDragStop: NodeMouseHandler = useCallback((_event, node) => {
    setDraggingNodeId(null)
    setTablePosition(node.id, node.position)
  }, [setTablePosition])

  const allTableIds = useMemo(
    () => schemaData.tables.map(table => `${table.schema}.${table.name}`),
    [schemaData.tables]
  )

  return (
    <div
      ref={canvasRef}
      className={`${styles.canvas} ${marqueeSelection ? styles.canvasSelecting : ''}`}
      onMouseDownCapture={event => beginMarqueeSelection(event, styles.controls)}
      onContextMenuCapture={handleContextMenuCapture}
    >
      <CanvasToolbar
        compactNodes={compactNodes}
        onResetLayout={resetLayout}
        onToggleCompactNodes={toggleCompactNodes}
        onChooseVisible={() => setShowTablePicker(true)}
      />
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.01}
        maxZoom={2}
        onMove={(_, viewport) => {
          viewportRef.current = viewport
        }}
        proOptions={{ hideAttribution: true }}
      >
        <ZoomController />
        <MiniMap
          nodeColor={node => (node.data as { selected?: boolean }).selected ? '#4a7bf5' : 'rgba(255,255,255,0.12)'}
          maskColor="rgba(0,0,0,0.45)"
          className={styles.miniMap}
          pannable={true}
          zoomable={true}
        />
      </ReactFlow>

      {marqueeBox && (
        <div
          className={styles.marqueeSelection}
          style={{
            left: marqueeBox.left,
            top: marqueeBox.top,
            width: marqueeBox.width,
            height: marqueeBox.height,
          }}
        />
      )}

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
    </div>
  )
}
