import { describe, test, expect } from 'bun:test'
import { computeLayout } from './layout'
import type { SchemaTable, ForeignKey } from '../../types'

const tables: SchemaTable[] = [
  {
    schema: 'dbo',
    name: 'Orders',
    columns: [{
      name: 'CustomerId',
      dataType: 'int',
      maxLength: null,
      numericPrecision: null,
      numericScale: null,
      isNullable: false,
      isPK: false,
      isFK: true,
      referencesTable: 'Customers',
      referencesColumn: 'Id',
    }],
  },
  {
    schema: 'dbo',
    name: 'Customers',
    columns: [{
      name: 'Id',
      dataType: 'int',
      maxLength: null,
      numericPrecision: null,
      numericScale: null,
      isNullable: false,
      isPK: true,
      isFK: false,
      referencesTable: null,
      referencesColumn: null,
    }],
  },
]
const fks: ForeignKey[] = [
  { parentTable: 'Orders', parentColumn: 'CustomerId', referencedTable: 'Customers', referencedColumn: 'Id' }
]

describe('computeLayout', () => {
  test('dagre: returns one node per table', async () => {
    const { nodes } = await computeLayout('dagre', tables, fks)
    expect(nodes).toHaveLength(2)
    expect(nodes.map((n: { id: string }) => n.id)).toContain('dbo.Orders')
  })

  test('dagre: returns one edge per FK', async () => {
    const { edges } = await computeLayout('dagre', tables, fks)
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('dbo.Orders')
    expect(edges[0].target).toBe('dbo.Customers')
  })

  test('dagre: annotates FK edges with inferred cardinality', async () => {
    const { edges } = await computeLayout('dagre', tables, fks)
    expect(edges[0].data).toEqual(expect.objectContaining({
      parentColumn: 'CustomerId',
      sourceCardinality: 'many',
      targetCardinality: '1',
    }))
  })

  test('dagre: nodes have position set', async () => {
    const { nodes } = await computeLayout('dagre', tables, fks)
    expect(nodes[0].position.x).toBeDefined()
    expect(nodes[0].position.y).toBeDefined()
  })

  test('force: spreads nodes in all directions', async () => {
    const { nodes } = await computeLayout('force', tables, fks)
    expect(nodes).toHaveLength(2)
    // Force layout should not stack everything at (0,0)
    const positions = nodes.map((n: { position: { x: number; y: number } }) => n.position)
    expect(positions[0].x).not.toBe(positions[1].x)
  })
})
