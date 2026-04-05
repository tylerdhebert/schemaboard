import type { EdgeProps } from '@xyflow/react'
import { useInternalNode, BaseEdge, EdgeLabelRenderer } from '@xyflow/react'
import styles from './Canvas.module.css'

type SelfLoopEdgeData = {
  parentColumn?: string
  energized?: boolean
}

export function SelfLoopEdge({ id, source, style, markerEnd, data }: EdgeProps) {
  const node = useInternalNode(source)
  if (!node) return null

  const x = node.internals.positionAbsolute.x + (node.measured?.width ?? 220)
  const y = node.internals.positionAbsolute.y + (node.measured?.height ?? 80) / 2
  const edgeData = (data ?? {}) as SelfLoopEdgeData

  // Bezier loop off the right side of the node
  const path = `M ${x} ${y - 8} C ${x + 40} ${y - 32}, ${x + 40} ${y + 32}, ${x} ${y + 8}`

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
              transform: `translate(-50%, -50%) translate(${x + 44}px, ${y}px)`,
            }}
          >
            {edgeData.parentColumn}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
