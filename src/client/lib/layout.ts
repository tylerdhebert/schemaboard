import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import type { SchemaTable, ForeignKey } from '../../types'

const NODE_WIDTH = 220
const NODE_HEIGHT_BASE = 44
const ROW_HEIGHT = 24

export function buildLayout(
  tables: SchemaTable[],
  foreignKeys: ForeignKey[]
): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })

  // Store computed heights so we reuse the exact same value for position centering
  const nodeHeights = new Map<string, number>()

  for (const table of tables) {
    const nodeId = `${table.schema}.${table.name}`
    const height = NODE_HEIGHT_BASE + table.columns.length * ROW_HEIGHT + 16
    nodeHeights.set(nodeId, height)
    graph.setNode(nodeId, { width: NODE_WIDTH, height })
  }

  // Use schema-qualified ids for matching to avoid collisions across schemas
  const nodeIds = new Set(tables.map(t => `${t.schema}.${t.name}`))
  const tableByName = new Map(tables.map(t => [t.name, t]))

  for (const fk of foreignKeys) {
    const parentTable = tableByName.get(fk.parentTable)
    const refTable = tableByName.get(fk.referencedTable)
    if (!parentTable || !refTable) continue
    const sourceId = `${parentTable.schema}.${parentTable.name}`
    const targetId = `${refTable.schema}.${refTable.name}`
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) continue
    graph.setEdge(sourceId, targetId)
  }

  dagre.layout(graph)

  const nodes: Node[] = tables.map(table => {
    const nodeId = `${table.schema}.${table.name}`
    const pos = graph.node(nodeId)
    const height = nodeHeights.get(nodeId)!
    return {
      id: nodeId,
      type: 'tableNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - height / 2 },
      data: { table }
    }
  })

  const seenEdges = new Set<string>()
  const edges: Edge[] = []

  for (const fk of foreignKeys) {
    const parentTable = tableByName.get(fk.parentTable)
    const refTable = tableByName.get(fk.referencedTable)
    if (!parentTable || !refTable) continue
    const sourceId = `${parentTable.schema}.${parentTable.name}`
    const targetId = `${refTable.schema}.${refTable.name}`
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) continue

    // Include both columns in dedup key to preserve composite FK scenarios
    const edgeId = `${sourceId}->${targetId}-${fk.parentColumn}-${fk.referencedColumn}`
    if (seenEdges.has(edgeId)) continue
    seenEdges.add(edgeId)

    edges.push({
      id: edgeId,
      source: sourceId,
      target: targetId,
      label: fk.parentColumn,
      type: sourceId === targetId ? 'selfloop' : 'smoothstep',
      style: { strokeDasharray: '5 3' }
    })
  }

  return { nodes, edges }
}
