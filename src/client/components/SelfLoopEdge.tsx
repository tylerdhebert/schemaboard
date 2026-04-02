import type { EdgeProps } from '@xyflow/react'
import { useInternalNode, BaseEdge } from '@xyflow/react'

export function SelfLoopEdge({ id, source, style, label, markerEnd }: EdgeProps) {
  const node = useInternalNode(source)
  if (!node) return null

  const x = node.internals.positionAbsolute.x + (node.measured?.width ?? 220)
  const y = node.internals.positionAbsolute.y + (node.measured?.height ?? 80) / 2

  // Bezier loop off the right side of the node
  const path = `M ${x} ${y - 8} C ${x + 40} ${y - 32}, ${x + 40} ${y + 32}, ${x} ${y + 8}`

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
      label={label}
      labelX={x + 44}
      labelY={y}
    />
  )
}
