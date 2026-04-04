import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Binary, Boxes, ChevronDown, Eye, Network, RefreshCw, Rows3 } from 'lucide-react'
import {
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SelfLoopEdge } from './SelfLoopEdge'
import { TablePicker } from './TablePicker'
import { TableNode } from './TableNode'
import { computeLayout } from '../lib/layout'
import { useStore } from '../store'
import type { Group, LayoutType, SchemaData, SchemaTable } from '../../types'
import styles from './Canvas.module.css'

const EDGE_ACTIVE_STROKE = 'rgba(74,123,245,0.5)'
const EDGE_DIM_STROKE = 'rgba(255,255,255,0.06)'

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { selfloop: SelfLoopEdge }
const LAYOUTS: { type: LayoutType; icon: React.ReactNode; label: string }[] = [
  { type: 'dagre', icon: <Binary size={14} strokeWidth={2} />, label: 'Dagre' },
  { type: 'force', icon: <Network size={14} strokeWidth={2} />, label: 'Force' },
  { type: 'elk', icon: <Boxes size={14} strokeWidth={2} />, label: 'ELK' },
]

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
  const prevFitViewKey = useRef(fitViewKey)
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
    const frame = requestAnimationFrame(() => {
      fitView({ duration: 400, padding: 0.15 })
    })

    return () => cancelAnimationFrame(frame)
  }, [fitViewKey, fitView])

  return null
}

interface CanvasProps {
  schemaData: SchemaData
  groups: Group[]
}

type BaseLayout = {
  nodes: Node[]
  edges: Edge[]
  fresh: boolean
}

type MarqueeSelection = {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

function CanvasControlButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`${styles.controlButton} ${active ? styles.controlButtonActive : ''}`}
    >
      <span className={styles.controlButtonIcon}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function LayoutDropdown() {
  const { layoutType, resetLayout, setLayoutType } = useStore()
  const [open, setOpen] = useState(false)
  const [dropRect, setDropRect] = useState<DOMRect | null>(null)
  const current = LAYOUTS.find(layout => layout.type === layoutType)!

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  return (
    <div className={styles.controlWrap}>
      <button
        type="button"
        title="Switch layout algorithm"
        onClick={event => {
          event.stopPropagation()
          if (open) {
            setOpen(false)
            return
          }
          setDropRect(event.currentTarget.getBoundingClientRect())
          setOpen(true)
        }}
        className={`${styles.controlButton} ${open ? styles.controlButtonActive : ''}`}
      >
        <span className={styles.controlButtonIcon}>{current.icon}</span>
        <span>{current.label}</span>
        <span className={styles.controlButtonIcon}>
          <ChevronDown size={12} strokeWidth={2.2} />
        </span>
      </button>

      {open && dropRect && (
        <div
          className={styles.controlMenu}
          style={{ left: dropRect.left, top: dropRect.bottom + 6 }}
          onClick={event => event.stopPropagation()}
        >
          {LAYOUTS.map(layout => (
            <button
              key={layout.type}
              type="button"
              className={`${styles.controlMenuItem} ${layout.type === layoutType ? styles.controlMenuItemActive : ''}`}
              onClick={() => {
                if (layout.type !== layoutType) {
                  setLayoutType(layout.type)
                  resetLayout()
                }
                setOpen(false)
              }}
            >
              <span className={styles.controlButtonIcon}>{layout.icon}</span>
              <span>{layout.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Canvas({ schemaData, groups }: CanvasProps) {
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
  const [marqueeSelection, setMarqueeSelection] = useState<MarqueeSelection | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 })
  const marqueeStateRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null)
  const suppressContextMenuRef = useRef(false)

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

  const visibleTables = useMemo(
    () => schemaData.tables.filter(table => {
      const id = `${table.schema}.${table.name}`
      if (hiddenTables.has(id)) return false

      const tableGroups = tableToGroups.get(table.name)
      return !tableGroups || tableGroups.some(group => !hiddenGroups.has(group.id))
    }),
    [schemaData.tables, tableToGroups, hiddenGroups, hiddenTables]
  )

  const [baseLayout, setBaseLayout] = useState<BaseLayout>({ nodes: [], edges: [], fresh: true })
  const prevLayoutKeyRef = useRef(layoutKey)
  const prevLayoutTypeRef = useRef(layoutType)

  useEffect(() => {
    let cancelled = false
    const fresh = prevLayoutKeyRef.current !== layoutKey || prevLayoutTypeRef.current !== layoutType
    prevLayoutKeyRef.current = layoutKey
    prevLayoutTypeRef.current = layoutType

    computeLayout(layoutType, visibleTables, schemaData.foreignKeys).then(({ nodes, edges }) => {
      if (cancelled) return
      setBaseLayout({ nodes, edges, fresh })
    })

    return () => {
      cancelled = true
    }
  }, [visibleTables, schemaData.foreignKeys, layoutKey, layoutType])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])
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

    setRfEdges(baseLayout.edges.map(edge => {
      const sourceSelected = selectedTables.has(edge.source as string)
      const targetSelected = selectedTables.has(edge.target as string)
      const active = selectedTables.size === 0 || (sourceSelected && targetSelected)

      return {
        ...edge,
        style: {
          ...edge.style,
          stroke: active ? EDGE_ACTIVE_STROKE : EDGE_DIM_STROKE,
          strokeWidth: active ? 1.5 : 1,
        },
        animated: false,
      }
    }))
  }, [baseLayout, selectedTables, tableToGroups, searchQuery, compactNodes, tablePositions, setRfNodes, setRfEdges, triggerFitView])

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    toggleTable(node.id)
  }, [toggleTable])

  const onNodeDragStop: NodeMouseHandler = useCallback((_event, node) => {
    setTablePosition(node.id, node.position)
  }, [setTablePosition])

  const finishMarqueeSelection = useCallback((selection: MarqueeSelection | null) => {
    marqueeStateRef.current = null
    setMarqueeSelection(null)
    if (!selection) return

    const { x, y, zoom } = viewportRef.current
    const left = Math.min(selection.startX, selection.currentX)
    const top = Math.min(selection.startY, selection.currentY)
    const right = Math.max(selection.startX, selection.currentX)
    const bottom = Math.max(selection.startY, selection.currentY)
    const width = right - left
    const height = bottom - top

    if (width < 6 || height < 6) return

    const flowLeft = (left - x) / zoom
    const flowTop = (top - y) / zoom
    const flowRight = (right - x) / zoom
    const flowBottom = (bottom - y) / zoom

    const selectedIds = rfNodes
      .filter(node => {
        const box = getNodeBox(node as Node & { measured?: { width?: number; height?: number } })
        return !(
          box.right < flowLeft ||
          box.left > flowRight ||
          box.bottom < flowTop ||
          box.top > flowBottom
        )
      })
      .map(node => node.id)

    clearSelection()
    if (selectedIds.length > 0) {
      selectTables(selectedIds)
    }
  }, [rfNodes, clearSelection, selectTables])

  useEffect(() => {
    function handlePointerMove(event: MouseEvent) {
      const marqueeState = marqueeStateRef.current
      const canvas = canvasRef.current
      if (!marqueeState || !canvas) return

      const rect = canvas.getBoundingClientRect()
      const nextX = event.clientX - rect.left
      const nextY = event.clientY - rect.top
      const moved = Math.abs(nextX - marqueeState.startX) > 4 || Math.abs(nextY - marqueeState.startY) > 4
      marqueeStateRef.current = { ...marqueeState, moved: marqueeState.moved || moved }
      if (moved) suppressContextMenuRef.current = true

      setMarqueeSelection({
        startX: marqueeState.startX,
        startY: marqueeState.startY,
        currentX: nextX,
        currentY: nextY,
      })
    }

    function handlePointerUp() {
      finishMarqueeSelection(marqueeSelection)
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [finishMarqueeSelection, marqueeSelection])

  const allTableIds = useMemo(
    () => schemaData.tables.map(table => `${table.schema}.${table.name}`),
    [schemaData.tables]
  )

  const marqueeBox = marqueeSelection ? {
    left: Math.min(marqueeSelection.startX, marqueeSelection.currentX),
    top: Math.min(marqueeSelection.startY, marqueeSelection.currentY),
    width: Math.abs(marqueeSelection.currentX - marqueeSelection.startX),
    height: Math.abs(marqueeSelection.currentY - marqueeSelection.startY),
  } : null

  return (
    <div
      ref={canvasRef}
      className={`${styles.canvas} ${marqueeSelection ? styles.canvasSelecting : ''}`}
      onMouseDownCapture={event => {
        if (event.button !== 2 || !canvasRef.current) return

        const target = event.target as HTMLElement
        if (target.closest('[data-table-id]') || target.closest(`.${styles.controls}`)) return

        event.preventDefault()
        event.stopPropagation()

        const rect = canvasRef.current.getBoundingClientRect()
        const startX = event.clientX - rect.left
        const startY = event.clientY - rect.top
        marqueeStateRef.current = { startX, startY, moved: false }
        setMarqueeSelection({ startX, startY, currentX: startX, currentY: startY })
      }}
      onContextMenuCapture={event => {
        if (suppressContextMenuRef.current) {
          suppressContextMenuRef.current = false
          event.preventDefault()
          event.stopPropagation()
          return
        }

        const target = event.target as HTMLElement
        if (!target.closest('[data-table-id]')) {
          event.preventDefault()
        }
      }}
    >
      <div className={styles.controls}>
        <CanvasControlButton
          icon={<RefreshCw size={14} strokeWidth={2.2} />}
          label="Recalc"
          onClick={resetLayout}
        />
        <LayoutDropdown />
        <CanvasControlButton
          icon={<Rows3 size={14} strokeWidth={2.2} />}
          label={compactNodes ? 'Show columns' : 'Headers only'}
          onClick={toggleCompactNodes}
          active={compactNodes}
        />
        <CanvasControlButton
          icon={<Eye size={14} strokeWidth={2.2} />}
          label="Choose visible"
          onClick={() => setShowTablePicker(true)}
        />
      </div>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
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
