import { useCallback, useMemo, useEffect, useRef, useState } from 'react'

const EDGE_ACTIVE_STROKE = 'rgba(74,123,245,0.5)'
const EDGE_DIM_STROKE = 'rgba(255,255,255,0.06)'
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeMouseHandler,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TableNode } from './TableNode'
import { SelfLoopEdge } from './SelfLoopEdge'
import { computeLayout } from '../lib/layout'
import { useStore } from '../store'
import type { SchemaData, Group, SchemaTable } from '../../types'

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { selfloop: SelfLoopEdge }

function matchesSearch(table: SchemaTable, query: string): boolean {
  const q = query.toLowerCase()
  if (table.name.toLowerCase().includes(q)) return true
  return table.columns.some(c => c.name.toLowerCase().includes(q))
}

function ZoomController() {
  const { zoomToTable, setZoomToTable, fitToNodes, setFitToNodes, fitViewKey } = useStore()
  const { getNode, setCenter, fitView } = useReactFlow()
  const prevFitViewKey = useRef(fitViewKey)

  useEffect(() => {
    if (!zoomToTable) return
    setZoomToTable(null)
    const node = getNode(zoomToTable) as Node & { measured?: { width?: number; height?: number } } | undefined
    if (!node) return
    const w = node.measured?.width ?? 220
    const h = node.measured?.height ?? 80
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.5, duration: 500 })
  }, [zoomToTable, getNode, setCenter, setZoomToTable])

  useEffect(() => {
    if (!fitToNodes) return
    setFitToNodes(null)
    fitView({ nodes: fitToNodes.map(id => ({ id })), duration: 500, padding: 0.2 })
  }, [fitToNodes, setFitToNodes, fitView])

  useEffect(() => {
    if (prevFitViewKey.current === fitViewKey) return
    prevFitViewKey.current = fitViewKey
    fitView({ duration: 400, padding: 0.15 })
  }, [fitViewKey, fitView])

  return null
}

interface CanvasProps {
  schemaData: SchemaData
  groups: Group[]
}

export function Canvas({ schemaData, groups }: CanvasProps) {
  const { selectedTables, hiddenGroups, hiddenTables, autoExpand, layoutKey, layoutType, searchQuery, toggleTable, selectTables, triggerFitView } = useStore()

  const tableToGroup = useMemo(() => {
    const map = new Map<string, Group>()
    for (const group of groups) {
      for (const name of group.tables) map.set(name, group)
    }
    return map
  }, [groups])

  const visibleTables = useMemo(() =>
    schemaData.tables.filter(t => {
      const id = `${t.schema}.${t.name}`
      if (hiddenTables.has(id)) return false
      const group = tableToGroup.get(t.name)
      return !group || !hiddenGroups.has(group.id)
    }),
    [schemaData.tables, tableToGroup, hiddenGroups, hiddenTables]
  )

  const fkNeighbors = useMemo(() => {
    const tableByName = new Map(schemaData.tables.map(t => [t.name, t]))
    const map = new Map<string, Set<string>>()
    for (const fk of schemaData.foreignKeys) {
      const parent = tableByName.get(fk.parentTable)
      const ref = tableByName.get(fk.referencedTable)
      if (!parent || !ref) continue
      const parentId = `${parent.schema}.${parent.name}`
      const refId = `${ref.schema}.${ref.name}`
      if (!map.has(parentId)) map.set(parentId, new Set())
      if (!map.has(refId)) map.set(refId, new Set())
      map.get(parentId)!.add(refId)
      map.get(refId)!.add(parentId)
    }
    return map
  }, [schemaData.tables, schemaData.foreignKeys])

  // ── Async layout ──────────────────────────────────────────────────────────

  type BaseLayout = { nodes: Node[]; edges: Edge[]; fresh: boolean }
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
    return () => { cancelled = true }
  }, [visibleTables, schemaData.foreignKeys, layoutKey, layoutType])

  // ── ReactFlow state ───────────────────────────────────────────────────────

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Track which baseLayout object was last applied so we know if it changed
  const appliedLayoutRef = useRef<BaseLayout | null>(null)

  useEffect(() => {
    const isNewLayout = appliedLayoutRef.current !== baseLayout
    appliedLayoutRef.current = baseLayout

    const hasSelection = selectedTables.size > 0
    const query = searchQuery.length >= 2 ? searchQuery : ''

    setRfNodes(prev => {
      // Fresh layout → use new computed positions; existing table added/removed → preserve dragged positions
      const posMap = (isNewLayout && baseLayout.fresh)
        ? null
        : new Map(prev.map(p => [p.id, p.position]))

      return baseLayout.nodes.map(node => {
        const tableData = (node.data as { table: SchemaTable }).table
        const selected = selectedTables.has(node.id)
        const dim = hasSelection && !selected
        const group = tableToGroup.get(tableData.name) ?? null
        const matched = query ? matchesSearch(tableData, query) : false
        return {
          ...node,
          position: posMap?.get(node.id) ?? node.position,
          data: { table: tableData, group, selected, dim, matched },
        }
      })
    })

    if (isNewLayout && baseLayout.fresh) triggerFitView()

    setRfEdges(baseLayout.edges.map(edge => {
      const srcSel = selectedTables.has(edge.source as string)
      const tgtSel = selectedTables.has(edge.target as string)
      const active = selectedTables.size === 0 || (srcSel && tgtSel)
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
  }, [baseLayout, selectedTables, tableToGroup, searchQuery, setRfNodes, setRfEdges])

  // ── Node click ────────────────────────────────────────────────────────────

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const wasSelected = selectedTables.has(node.id)
    toggleTable(node.id)
    if (!wasSelected && autoExpand) {
      const neighbors = fkNeighbors.get(node.id)
      if (neighbors) selectTables([node.id, ...neighbors])
    }
  }, [toggleTable, autoExpand, fkNeighbors, selectTables, selectedTables])

  return (
    <div style={{
      width: '100%', height: '100%',
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.01}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <ZoomController />
      </ReactFlow>
    </div>
  )
}
