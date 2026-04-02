import { describe, test, expect } from 'bun:test'
import { buildLayout } from './layout'
import type { SchemaTable, ForeignKey } from '../../types'

const tables: SchemaTable[] = [
  { schema: 'dbo', name: 'Orders', columns: [] },
  { schema: 'dbo', name: 'Customers', columns: [] },
]
const fks: ForeignKey[] = [
  { parentTable: 'Orders', parentColumn: 'CustomerId', referencedTable: 'Customers', referencedColumn: 'Id' }
]

describe('buildLayout', () => {
  test('returns one node per table', () => {
    const { nodes } = buildLayout(tables, fks)
    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.id)).toContain('dbo.Orders')
  })

  test('returns one edge per FK', () => {
    const { edges } = buildLayout(tables, fks)
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('dbo.Orders')
    expect(edges[0].target).toBe('dbo.Customers')
  })

  test('nodes have position set by dagre', () => {
    const { nodes } = buildLayout(tables, fks)
    expect(nodes[0].position.x).toBeGreaterThanOrEqual(0)
    expect(nodes[0].position.y).toBeGreaterThanOrEqual(0)
  })
})
