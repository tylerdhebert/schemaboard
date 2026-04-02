import { useCallback, useMemo, useEffect } from 'react'

const EDGE_ACTIVE_STROKE = 'rgba(74,123,245,0.5)'
const EDGE_DIM_STROKE = 'rgba(255,255,255,0.06)'
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TableNode } from './TableNode'
import { SelfLoopEdge } from './SelfLoopEdge'
import { buildLayout } from '../lib/layout'
import { useStore } from '../store'
import type { SchemaData, Group } from '../../types'

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { selfloop: SelfLoopEdge }

interface CanvasProps {
  schemaData: SchemaData
  groups: Group[]
}

export function Canvas({ schemaData, groups }: CanvasProps) {
  const { selectedTables, hiddenGroups, autoExpand, toggleTable, selectTables } = useStore()

  const tableToGroup = useMemo(() => {
    const map = new Map<string, Group>()
    for (const group of groups) {
      for (const tableName of group.tables) map.set(tableName, group)
    }
    return map
  }, [groups])

  const visibleTables = useMemo(() =>
    schemaData.tables.filter(t => {
      const group = tableToGroup.get(t.name)
      return !group || !hiddenGroups.has(group.id)
    }),
    [schemaData.tables, tableToGroup, hiddenGroups]
  )

  // Keyed by qualified node ID ("schema.tableName") for consistent matching
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

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildLayout(visibleTables, schemaData.foreignKeys),
    [visibleTables, schemaData.foreignKeys]
  )

  const hasSelection = selectedTables.size > 0

  const enrichedNodes = useMemo(() => layoutNodes.map(node => {
    const tableData = (node.data as { table: { name: string } }).table
    const selected = selectedTables.has(node.id)
    const dim = hasSelection && !selected
    const group = tableToGroup.get(tableData.name) ?? null
    return { ...node, data: { ...node.data, group, selected, dim } }
  }), [layoutNodes, selectedTables, hasSelection, tableToGroup])

  const enrichedEdges = useMemo(() => layoutEdges.map(edge => {
    const sourceSelected = selectedTables.has(edge.source)
    const targetSelected = selectedTables.has(edge.target)
    const active = !hasSelection || (sourceSelected && targetSelected)
    return {
      ...edge,
      style: {
        ...edge.style,
        stroke: active ? EDGE_ACTIVE_STROKE : EDGE_DIM_STROKE,
        strokeWidth: active ? 1.5 : 1,
      },
      animated: false,
    }
  }), [layoutEdges, selectedTables, hasSelection])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(enrichedNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(enrichedEdges)

  // Sync enriched nodes/edges into React Flow state when upstream data changes.
  // Preserve user-dragged positions — only use layout positions for nodes not yet in RF state.
  useEffect(() => {
    setRfNodes(prev => {
      const posMap = new Map(prev.map(n => [n.id, n.position]))
      return enrichedNodes.map(n => ({ ...n, position: posMap.get(n.id) ?? n.position }))
    })
  }, [enrichedNodes, setRfNodes])
  useEffect(() => { setRfEdges(enrichedEdges) }, [enrichedEdges, setRfEdges])

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
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      />

    </div>
  )
}
