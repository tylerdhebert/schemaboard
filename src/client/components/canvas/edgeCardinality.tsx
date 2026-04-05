import type { CSSProperties, JSX } from 'react'

type Cardinality = '1' | 'many'

function strokeColor(style: CSSProperties | undefined) {
  return typeof style?.stroke === 'string' ? style.stroke : 'rgba(74,123,245,0.5)'
}

function strokeWidth(style: CSSProperties | undefined) {
  return typeof style?.strokeWidth === 'number' ? Math.max(style.strokeWidth, 1.5) : 1.5
}

export function createCardinalityMarkers(
  edgeId: string,
  style?: CSSProperties,
): {
  defs: JSX.Element
  markerFor: (cardinality: Cardinality | undefined) => string | undefined
} {
  const safeId = edgeId.replace(/[^a-zA-Z0-9_-]/g, '-')
  const color = strokeColor(style)
  const width = strokeWidth(style)
  const oneId = `${safeId}-cardinality-one`
  const manyId = `${safeId}-cardinality-many`

  return {
    defs: (
      <defs>
        <marker
          id={oneId}
          viewBox="0 0 24 24"
          markerWidth="24"
          markerHeight="24"
          refX="12"
          refY="12"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 12 2 L 12 22"
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
          />
        </marker>
        <marker
          id={manyId}
          viewBox="0 0 24 24"
          markerWidth="30"
          markerHeight="30"
          refX="12"
          refY="12"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path
            d="M 8 12 L 24 1 M 8 12 L 24 12 M 8 12 L 24 23"
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
    ),
    markerFor: cardinality => {
      if (cardinality === '1') return `url(#${oneId})`
      if (cardinality === 'many') return `url(#${manyId})`
      return undefined
    },
  }
}
