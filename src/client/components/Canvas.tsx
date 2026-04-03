import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { TableNode } from './TableNode'
import { computeLayout } from '../lib/layout'
import { useStore } from '../store'
import type { Group, SchemaData, SchemaTable } from '../../types'

const EDGE_ACTIVE_STROKE = 'rgba(74,123,245,0.5)'
const EDGE_DIM_STROKE = 'rgba(255,255,255,0.06)'

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { selfloop: SelfLoopEdge }

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
  const { zoomToTable, setZoomToTable, fitToNodes, setFitToNodes, fitViewKey } = useStore()
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

export function Canvas({ schemaData, groups }: CanvasProps) {
  const {
    selectedTables,
    hiddenGroups,
    hiddenTables,
    tablePositions,
    layoutKey,
    layoutType,
    searchQuery,
    compactNodes,
    toggleTable,
    triggerFitView,
    setTablePosition,
  } = useStore()

  const tableToGroups = useMemo(() => {
    const map = new Map<string, Group[]>()
    for (const group of groups) {
      for (const tableName of group.tables) {
        const existing = map.get(tableName)
        if (existing) {
          existing.push(group)
        } else {
          map.set(tableName, [group])
        }
      }
    }
    return map
  }, [groups])

  const visibleTables = useMemo(() =>
    schemaData.tables.filter(table => {
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

  useEffect(() => {
    const isNewLayout = appliedLayoutRef.current !== baseLayout
    appliedLayoutRef.current = baseLayout

    const hasSelection = selectedTables.size > 0
    const query = searchQuery.length >= 2 ? searchQuery : ''

    setRfNodes(previousNodes => {
      const previousPositions = (isNewLayout && baseLayout.fresh)
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

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--canvas)',
      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
      backgroundSize: '22px 22px',
    }}>
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
        proOptions={{ hideAttribution: true }}
      >
        <ZoomController />
        <MiniMap
          nodeColor={node => (node.data as { selected?: boolean }).selected ? '#4a7bf5' : 'rgba(255,255,255,0.12)'}
          maskColor="rgba(0,0,0,0.45)"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
          }}
        />
      </ReactFlow>
    </div>
  )
}
