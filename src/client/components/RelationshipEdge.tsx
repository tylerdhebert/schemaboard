import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import styles from './Canvas.module.css'
import { createCardinalityMarkers } from './canvas/edgeCardinality'

type Cardinality = '1' | 'many'

type RelationshipEdgeData = {
  parentColumn?: string
  sourceCardinality?: Cardinality
  targetCardinality?: Cardinality
  energized?: boolean
}

export function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const edgeData = (data ?? {}) as RelationshipEdgeData
  const { defs, markerFor } = createCardinalityMarkers(id, style)

  return (
    <>
      {defs}
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerStart={markerFor(edgeData.sourceCardinality)}
        markerEnd={markerFor(edgeData.targetCardinality) ?? markerEnd}
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
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {edgeData.parentColumn}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
