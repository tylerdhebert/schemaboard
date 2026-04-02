import { useCallback, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TableNode } from './TableNode'
import { buildLayout } from '../lib/layout'
import { useStore } from '../store'
import type { SchemaData, Group } from '../../types'

const nodeTypes = { tableNode: TableNode }

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

  // Map tableName → Set of neighbor tableNames via FK relationships
  const fkNeighbors = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const fk of schemaData.foreignKeys) {
      if (!map.has(fk.parentTable)) map.set(fk.parentTable, new Set())
      if (!map.has(fk.referencedTable)) map.set(fk.referencedTable, new Set())
      map.get(fk.parentTable)!.add(fk.referencedTable)
      map.get(fk.referencedTable)!.add(fk.parentTable)
    }
    return map
  }, [schemaData.foreignKeys])

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
        stroke: active ? 'rgba(74,123,245,0.5)' : 'rgba(255,255,255,0.06)',
        strokeWidth: active ? 1.5 : 1,
      },
      animated: false,
    }
  }), [layoutEdges, selectedTables, hasSelection])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(enrichedNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(enrichedEdges)

  // Sync enriched nodes/edges into React Flow state when upstream data changes
  useEffect(() => { setRfNodes(enrichedNodes) }, [enrichedNodes, setRfNodes])
  useEffect(() => { setRfEdges(enrichedEdges) }, [enrichedEdges, setRfEdges])

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    toggleTable(node.id)

    if (autoExpand) {
      // node.id is "schema.tableName" — extract tableName for neighbor lookup
      const tableName = node.id.split('.').slice(1).join('.')
      const neighbors = fkNeighbors.get(tableName)
      if (neighbors) {
        const neighborIds = [...neighbors]
          .map(neighborName => schemaData.tables.find(t => t.name === neighborName))
          .filter((t): t is NonNullable<typeof t> => t != null)
          .map(t => `${t.schema}.${t.name}`)
        selectTables([node.id, ...neighborIds])
      }
    }
  }, [toggleTable, autoExpand, fkNeighbors, schemaData.tables, selectTables])

  return (
    <div style={{ flex: 1, background: 'var(--canvas)' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(255,255,255,0.07)"
          gap={22}
          size={1}
        />
      </ReactFlow>
    </div>
  )
}
