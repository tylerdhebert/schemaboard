import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import type {
  SimulationNodeDatum, SimulationLinkDatum,
} from 'd3-force'
import type { SchemaTable, ForeignKey, LayoutType } from '../../types'

const NODE_WIDTH = 220
const NODE_HEIGHT_BASE = 44
const ROW_HEIGHT = 24

function nodeHeight(table: SchemaTable) {
  return NODE_HEIGHT_BASE + table.columns.length * ROW_HEIGHT + 16
}

function buildEdges(tables: SchemaTable[], foreignKeys: ForeignKey[]): Edge[] {
  const nodeIds = new Set(tables.map(t => `${t.schema}.${t.name}`))
  const tableByName = new Map(tables.map(t => [t.name, t]))
  const seen = new Set<string>()
  const edges: Edge[] = []

  for (const fk of foreignKeys) {
    const p = tableByName.get(fk.parentTable)
    const r = tableByName.get(fk.referencedTable)
    if (!p || !r) continue
    const src = `${p.schema}.${p.name}`
    const tgt = `${r.schema}.${r.name}`
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue
    const edgeId = `${src}->${tgt}-${fk.parentColumn}-${fk.referencedColumn}`
    if (seen.has(edgeId)) continue
    seen.add(edgeId)
    edges.push({
      id: edgeId,
      source: src,
      target: tgt,
      label: fk.parentColumn,
      type: src === tgt ? 'selfloop' : 'smoothstep',
      style: { strokeDasharray: '5 3' },
    })
  }

  return edges
}

// ── Dagre ──────────────────────────────────────────────────────────────────

function buildDagreLayout(tables: SchemaTable[], foreignKeys: ForeignKey[]) {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 40 })

  const heights = new Map<string, number>()
  for (const t of tables) {
    const id = `${t.schema}.${t.name}`
    const h = nodeHeight(t)
    heights.set(id, h)
    graph.setNode(id, { width: NODE_WIDTH, height: h })
  }

  const nodeIds = new Set(tables.map(t => `${t.schema}.${t.name}`))
  const tableByName = new Map(tables.map(t => [t.name, t]))
  for (const fk of foreignKeys) {
    const p = tableByName.get(fk.parentTable)
    const r = tableByName.get(fk.referencedTable)
    if (!p || !r) continue
    const src = `${p.schema}.${p.name}`
    const tgt = `${r.schema}.${r.name}`
    if (nodeIds.has(src) && nodeIds.has(tgt)) graph.setEdge(src, tgt)
  }

  dagre.layout(graph)

  const nodes: Node[] = tables.map(t => {
    const id = `${t.schema}.${t.name}`
    const pos = graph.node(id)
    const h = heights.get(id)!
    return { id, type: 'tableNode', position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - h / 2 }, data: { table: t } }
  })

  return { nodes, edges: buildEdges(tables, foreignKeys) }
}

// ── d3-force ───────────────────────────────────────────────────────────────

interface ForceNode extends SimulationNodeDatum {
  id: string
  width: number
  height: number
  table: SchemaTable
}

interface ForceLink extends SimulationLinkDatum<ForceNode> {
  source: string | ForceNode
  target: string | ForceNode
}

async function buildForceLayout(tables: SchemaTable[], foreignKeys: ForeignKey[]) {
  const {
    forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  } = await import('d3-force')
  const tableByName = new Map(tables.map(t => [t.name, t]))
  const nodeIds = new Set(tables.map(t => `${t.schema}.${t.name}`))

  // Start nodes in a circle for a stable initial configuration
  const simNodes: ForceNode[] = tables.map((t, i) => {
    const angle = (2 * Math.PI * i) / tables.length
    const r = Math.max(250, tables.length * 25)
    return {
      id: `${t.schema}.${t.name}`,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      width: NODE_WIDTH,
      height: nodeHeight(t),
      table: t,
    }
  })

  const simLinks: ForceLink[] = []
  for (const fk of foreignKeys) {
    const p = tableByName.get(fk.parentTable)
    const r = tableByName.get(fk.referencedTable)
    if (!p || !r) continue
    const src = `${p.schema}.${p.name}`
    const tgt = `${r.schema}.${r.name}`
    if (nodeIds.has(src) && nodeIds.has(tgt)) simLinks.push({ source: src, target: tgt })
  }

  const simulation = forceSimulation<ForceNode>(simNodes)
    .force('link', forceLink<ForceNode, ForceLink>(simLinks).id(d => d.id).distance(300).strength(0.3))
    .force('charge', forceManyBody<ForceNode>().strength(-900))
    .force('center', forceCenter<ForceNode>(0, 0))
    .force('collide', forceCollide<ForceNode>().radius(d => Math.max(d.width, d.height) / 2 + 28))
    .stop()

  for (let i = 0; i < 300; i++) simulation.tick()

  const nodes: Node[] = simNodes.map(n => ({
    id: n.id,
    type: 'tableNode',
    position: { x: (n.x ?? 0) - NODE_WIDTH / 2, y: (n.y ?? 0) - n.height / 2 },
    data: { table: n.table },
  }))

  return { nodes, edges: buildEdges(tables, foreignKeys) }
}

// ── ELK ────────────────────────────────────────────────────────────────────

async function buildElkLayout(tables: SchemaTable[], foreignKeys: ForeignKey[]) {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js')
  const elk = new ELK()
  const tableByName = new Map(tables.map(t => [t.name, t]))
  const nodeIds = new Set(tables.map(t => `${t.schema}.${t.name}`))

  const heights = new Map<string, number>()
  const elkNodes = tables.map(t => {
    const id = `${t.schema}.${t.name}`
    const h = nodeHeight(t)
    heights.set(id, h)
    return { id, width: NODE_WIDTH, height: h }
  })

  const seen = new Set<string>()
  const elkEdges: { id: string; sources: string[]; targets: string[] }[] = []
  let ei = 0
  for (const fk of foreignKeys) {
    const p = tableByName.get(fk.parentTable)
    const r = tableByName.get(fk.referencedTable)
    if (!p || !r) continue
    const src = `${p.schema}.${p.name}`
    const tgt = `${r.schema}.${r.name}`
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue
    const key = `${src}->${tgt}`
    if (seen.has(key)) continue
    seen.add(key)
    elkEdges.push({ id: `e${ei++}`, sources: [src], targets: [tgt] })
  }

  const result = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '40',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: elkNodes,
    edges: elkEdges,
  })

  const tableById = new Map(tables.map(t => [`${t.schema}.${t.name}`, t]))
  const nodes: Node[] = (result.children ?? []).map(n => ({
    id: n.id!,
    type: 'tableNode',
    position: { x: n.x!, y: n.y! },
    data: { table: tableById.get(n.id!)! },
  }))

  return { nodes, edges: buildEdges(tables, foreignKeys) }
}

// ── Unified entry point ────────────────────────────────────────────────────

export async function computeLayout(
  type: LayoutType,
  tables: SchemaTable[],
  foreignKeys: ForeignKey[],
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (tables.length === 0) return { nodes: [], edges: [] }
  if (type === 'force') return buildForceLayout(tables, foreignKeys)
  if (type === 'elk') return buildElkLayout(tables, foreignKeys)
  return buildDagreLayout(tables, foreignKeys)
}
