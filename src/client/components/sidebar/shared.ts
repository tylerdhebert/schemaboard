import type { SchemaTable } from '../../../types'
import { tableIdFromSchemaParts } from '../../hooks/useSelectionContext'

export type DropPosition = 'before' | 'after'

export type DragItem =
  | { type: 'group'; groupId: string }
  | { type: 'group-table'; groupId: string; tableId: string }
  | { type: 'ungrouped-table'; tableId: string }

export type DragTarget =
  | { type: 'group'; groupId: string; position: DropPosition }
  | { type: 'group-table'; groupId: string; tableId: string; position: DropPosition }
  | { type: 'ungrouped-table'; tableId: string; position: DropPosition }

export function tableIdFromTable(table: SchemaTable): string {
  return tableIdFromSchemaParts(table.schema, table.name)
}

export function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function reorderList(items: string[], draggedId: string, targetId: string, position: DropPosition): string[] {
  if (draggedId === targetId) return items
  const withoutDragged = items.filter(item => item !== draggedId)
  const targetIndex = withoutDragged.indexOf(targetId)
  if (targetIndex === -1) return items
  const next = [...withoutDragged]
  next.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, draggedId)
  return next
}
