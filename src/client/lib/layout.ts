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

  for (const table of tables) {
    const height = NODE_HEIGHT_BASE + table.columns.length * ROW_HEIGHT + 16
    graph.setNode(`${table.schema}.${table.name}`, { width: NODE_WIDTH, height })
  }

  const tableNames = new Set(tables.map(t => t.name))
  for (const fk of foreignKeys) {
    if (!tableNames.has(fk.parentTable) || !tableNames.has(fk.referencedTable)) continue
    const parentTable = tables.find(t => t.name === fk.parentTable)!
    const refTable = tables.find(t => t.name === fk.referencedTable)!
    graph.setEdge(
      `${parentTable.schema}.${parentTable.name}`,
      `${refTable.schema}.${refTable.name}`
    )
  }

  dagre.layout(graph)

  const nodes: Node[] = tables.map(table => {
    const nodeId = `${table.schema}.${table.name}`
    const pos = graph.node(nodeId)
    return {
      id: nodeId,
      type: 'tableNode',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - pos.height / 2 },
      data: { table }
    }
  })

  const seenEdges = new Set<string>()
  const edges: Edge[] = []

  for (const fk of foreignKeys) {
    if (!tableNames.has(fk.parentTable) || !tableNames.has(fk.referencedTable)) continue
    const parentTable = tables.find(t => t.name === fk.parentTable)!
    const refTable = tables.find(t => t.name === fk.referencedTable)!
    const edgeId = `${parentTable.schema}.${parentTable.name}->${refTable.schema}.${refTable.name}-${fk.parentColumn}`
    if (seenEdges.has(edgeId)) continue
    seenEdges.add(edgeId)
    edges.push({
      id: edgeId,
      source: `${parentTable.schema}.${parentTable.name}`,
      target: `${refTable.schema}.${refTable.name}`,
      label: fk.parentColumn,
      type: 'smoothstep',
      style: { strokeDasharray: '5 3' }
    })
  }

  return { nodes, edges }
}
