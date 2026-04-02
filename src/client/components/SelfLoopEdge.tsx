import type { EdgeProps } from '@xyflow/react'
import { useInternalNode, BaseEdge } from '@xyflow/react'

export function SelfLoopEdge({ id, source, style, label, markerEnd }: EdgeProps) {
  const node = useInternalNode(source)
  if (!node) return null

  const x = node.internals.positionAbsolute.x + (node.measured?.width ?? 220)
  const y = node.internals.positionAbsolute.y + (node.measured?.height ?? 80) / 2

  // Bezier loop off the right side of the node
  const path = `M ${x} ${y - 14} C ${x + 70} ${y - 60}, ${x + 70} ${y + 60}, ${x} ${y + 14}`

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
      label={label}
      labelX={x + 76}
      labelY={y}
    />
  )
}
