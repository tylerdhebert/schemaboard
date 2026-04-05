import type { EdgeProps } from '@xyflow/react'
import { useInternalNode, BaseEdge, EdgeLabelRenderer } from '@xyflow/react'
import styles from './Canvas.module.css'

type SelfLoopEdgeData = {
  parentColumn?: string
  energized?: boolean
}

function getHandleCenter(
  node: NonNullable<ReturnType<typeof useInternalNode>>,
  type: 'source' | 'target',
  handleId?: string | null,
) {
  const handles = node.internals.handleBounds?.[type]
  const handle = handles?.find(candidate => candidate.id === handleId) ?? null
  if (!handle) return null

  return {
    x: node.internals.positionAbsolute.x + handle.x + handle.width / 2,
    y: node.internals.positionAbsolute.y + handle.y + handle.height / 2,
  }
}

export function SelfLoopEdge({ id, source, style, markerEnd, data, sourceHandleId, targetHandleId }: EdgeProps) {
  const node = useInternalNode(source)
  if (!node) return null

  const rightX = node.internals.positionAbsolute.x + (node.measured?.width ?? 220)
  const centerY = node.internals.positionAbsolute.y + (node.measured?.height ?? 80) / 2
  const sourcePoint = getHandleCenter(node, 'source', sourceHandleId) ?? { x: rightX, y: centerY - 8 }
  const targetPoint = getHandleCenter(node, 'target', targetHandleId) ?? { x: rightX, y: centerY + 8 }
  const edgeData = (data ?? {}) as SelfLoopEdgeData

  const horizontalOffset = 56
  const verticalBend = Math.max(24, Math.abs(targetPoint.y - sourcePoint.y) * 0.55 + 18)
  const path = `M ${rightX} ${sourcePoint.y} C ${rightX + horizontalOffset} ${sourcePoint.y - verticalBend}, ${rightX + horizontalOffset} ${targetPoint.y + verticalBend}, ${rightX} ${targetPoint.y}`

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerEnd={markerEnd}
      />
      {edgeData.energized && (
        <>
          <path d={path} className={styles.edgeEnergyGlow} />
          <path d={path} className={styles.edgeEnergyPulse} />
        </>
      )}
      <EdgeLabelRenderer>
        {edgeData.parentColumn && (
          <div
            className={`${styles.edgeBadge} ${styles.edgeColumnBadge} ${edgeData.energized ? styles.edgeColumnBadgeEnergized : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${rightX + 48}px, ${(sourcePoint.y + targetPoint.y) / 2}px)`,
            }}
          >
            {edgeData.parentColumn}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
